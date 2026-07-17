package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"strings"

	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
	"gorm.io/gorm"

	"github.com/rohanb2005uk/submission-approval-workflow/backend/internal/auth"
	"github.com/rohanb2005uk/submission-approval-workflow/backend/internal/models"
	"github.com/rohanb2005uk/submission-approval-workflow/backend/internal/workflow"
)

type loginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type verifyLoginRequest struct {
	ChallengeID string `json:"challenge_id"`
	Code        string `json:"code"`
}

// loginResponse covers both login() and verifyLogin(): when 2FA is enabled,
// login() returns only ChallengeID and verifyLogin() later fills in Token
// and User; when 2FA is disabled, login() populates Token and User directly
// and ChallengeID is omitted.
type loginResponse struct {
	ChallengeID string        `json:"challenge_id,omitempty"`
	Token       string        `json:"token,omitempty"`
	User        *userResponse `json:"user,omitempty"`
}

type userResponse struct {
	ID    string `json:"id"`
	Email string `json:"email"`
	Role  string `json:"role"`
}

// loginRateLimitKey namespaces the failed-login counter for one email in
// Redis. Lowercased so "User@x.com" and "user@x.com" share one counter.
func loginRateLimitKey(email string) string {
	return "ratelimit:login:" + strings.ToLower(email)
}

// otpChallengeKey namespaces a pending 2FA challenge's Redis hash.
func otpChallengeKey(challengeID uuid.UUID) string {
	return "otp:challenge:" + challengeID.String()
}

// login checks the user's password and, if it's correct, emails a 6-digit
// code and returns a challenge ID rather than a token. The JWT is only
// issued once that code is confirmed via verifyLogin.
func (h *handlers) login(w http.ResponseWriter, r *http.Request) {
	var req loginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	if strings.TrimSpace(req.Email) == "" || req.Password == "" {
		writeError(w, http.StatusBadRequest, "email and password are required")
		return
	}

	ctx := r.Context()
	rateLimitKey := loginRateLimitKey(req.Email)

	attempts, err := h.redis.Get(ctx, rateLimitKey).Int()
	if err != nil && !errors.Is(err, redis.Nil) {
		log.Printf("checking login rate limit for %s: %v", req.Email, err)
	}
	if attempts >= maxLoginAttempts {
		h.recordSessionEvent(ctx, nil, req.Email, "", "login", false, r)
		writeError(w, http.StatusTooManyRequests, "too many failed login attempts - try again later")
		return
	}

	var user models.User
	err = h.db.WithContext(ctx).Where("email = ?", req.Email).First(&user).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		h.registerFailedLogin(ctx, rateLimitKey)
		h.recordSessionEvent(ctx, nil, req.Email, "", "login", false, r)
		writeError(w, http.StatusUnauthorized, "invalid email or password")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "looking up user")
		return
	}

	if !auth.CheckPassword(user.PasswordHash, req.Password) {
		h.registerFailedLogin(ctx, rateLimitKey)
		h.recordSessionEvent(ctx, &user.ID, user.Email, user.Role, "login", false, r)
		writeError(w, http.StatusUnauthorized, "invalid email or password")
		return
	}

	// Correct password: clear the counter so a legitimate user who mistyped
	// it a couple of times isn't left with a partially-used allowance.
	if err := h.redis.Del(ctx, rateLimitKey).Err(); err != nil {
		log.Printf("clearing login rate limit for %s: %v", req.Email, err)
	}

	if !h.enable2FA {
		token, err := auth.GenerateToken(user.ID, user.Role, h.secret, tokenTTL)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "issuing token")
			return
		}
		// No 2FA step follows, so the password check is the whole login.
		h.recordSessionEvent(ctx, &user.ID, user.Email, user.Role, "login", true, r)
		writeJSON(w, http.StatusOK, loginResponse{
			Token: token,
			User: &userResponse{
				ID:    user.ID.String(),
				Email: user.Email,
				Role:  user.Role,
			},
		})
		return
	}

	code, err := auth.GenerateOTP()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "generating verification code")
		return
	}

	challengeID := uuid.New()
	challengeKey := otpChallengeKey(challengeID)
	if err := h.redis.HSet(ctx, challengeKey, map[string]any{
		"user_id":   user.ID.String(),
		"code_hash": auth.HashOTP(code),
		"attempts":  0,
	}).Err(); err != nil {
		writeError(w, http.StatusInternalServerError, "creating verification challenge")
		return
	}
	if err := h.redis.Expire(ctx, challengeKey, otpTTL).Err(); err != nil {
		writeError(w, http.StatusInternalServerError, "creating verification challenge")
		return
	}

	body := fmt.Sprintf(
		"Your verification code is %s. It expires in %d minutes.\n\nIf you didn't try to sign in, you can ignore this email.",
		code, int(otpTTL.Minutes()),
	)
	if err := h.mailer.Send(user.Email, "Your sign-in verification code", body); err != nil {
		log.Printf("sending verification email to %s: %v", user.Email, err)
		writeError(w, http.StatusInternalServerError, "sending verification email")
		return
	}

	writeJSON(w, http.StatusOK, loginResponse{ChallengeID: challengeID.String()})
}

// registerFailedLogin increments the rate-limit counter for key, starting
// its expiry window on the first failure in the current window. Redis being
// unreachable fails open (logs and continues) rather than blocking login
// entirely on a rate-limiter outage.
func (h *handlers) registerFailedLogin(ctx context.Context, key string) {
	n, err := h.redis.Incr(ctx, key).Result()
	if err != nil {
		log.Printf("recording failed login for %s: %v", key, err)
		return
	}
	if n == 1 {
		if err := h.redis.Expire(ctx, key, loginRateLimitWindow).Err(); err != nil {
			log.Printf("setting login rate limit expiry for %s: %v", key, err)
		}
	}
}

// verifyLogin confirms the emailed code for a pending challenge and, on
// success, issues the JWT that login used to return directly.
func (h *handlers) verifyLogin(w http.ResponseWriter, r *http.Request) {
	var req verifyLoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	if strings.TrimSpace(req.Code) == "" {
		writeError(w, http.StatusBadRequest, "code is required")
		return
	}
	challengeID, err := uuid.Parse(req.ChallengeID)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "invalid or expired code")
		return
	}

	ctx := r.Context()
	challengeKey := otpChallengeKey(challengeID)

	data, err := h.redis.HGetAll(ctx, challengeKey).Result()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "looking up challenge")
		return
	}
	if len(data) == 0 {
		// Redis returns an empty map for a missing key - covers both
		// "never existed" and "expired", exactly like the old
		// consumed/expired/not-found checks combined.
		writeError(w, http.StatusUnauthorized, "invalid or expired code")
		return
	}

	// Best-effort identity for logging a failed attempt below - if the
	// challenge's user_id can't be resolved, the failure is simply not
	// logged rather than recording a blank-identity row.
	lookupChallengeUser := func() (*uuid.UUID, string, string) {
		id, err := uuid.Parse(data["user_id"])
		if err != nil {
			return nil, "", ""
		}
		var u models.User
		if err := h.db.WithContext(ctx).Where("id = ?", id).First(&u).Error; err != nil {
			return nil, "", ""
		}
		return &u.ID, u.Email, u.Role
	}

	attempts, _ := strconv.Atoi(data["attempts"])
	if attempts >= maxOTPAttempts {
		h.redis.Del(ctx, challengeKey)
		if uid, email, role := lookupChallengeUser(); email != "" {
			h.recordSessionEvent(ctx, uid, email, role, "login", false, r)
		}
		writeError(w, http.StatusUnauthorized, "invalid or expired code")
		return
	}

	if !auth.CheckOTP(data["code_hash"], req.Code) {
		if err := h.redis.HIncrBy(ctx, challengeKey, "attempts", 1).Err(); err != nil {
			writeError(w, http.StatusInternalServerError, "recording attempt")
			return
		}
		if uid, email, role := lookupChallengeUser(); email != "" {
			h.recordSessionEvent(ctx, uid, email, role, "login", false, r)
		}
		writeError(w, http.StatusUnauthorized, "invalid or expired code")
		return
	}

	// Correct code: delete the challenge immediately so it can't be replayed
	// even within its remaining TTL.
	if err := h.redis.Del(ctx, challengeKey).Err(); err != nil {
		writeError(w, http.StatusInternalServerError, "consuming challenge")
		return
	}

	userID, err := uuid.Parse(data["user_id"])
	if err != nil {
		writeError(w, http.StatusInternalServerError, "reading challenge")
		return
	}

	var user models.User
	if err := h.db.WithContext(ctx).Where("id = ?", userID).First(&user).Error; err != nil {
		writeError(w, http.StatusInternalServerError, "looking up user")
		return
	}

	token, err := auth.GenerateToken(user.ID, user.Role, h.secret, tokenTTL)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "issuing token")
		return
	}
	h.recordSessionEvent(ctx, &user.ID, user.Email, user.Role, "login", true, r)

	writeJSON(w, http.StatusOK, loginResponse{
		Token: token,
		User: &userResponse{
			ID:    user.ID.String(),
			Email: user.Email,
			Role:  user.Role,
		},
	})
}

// recordSessionEvent writes one Session Audit row. Best-effort: a logging
// failure is logged itself and otherwise ignored, since it must never block
// or fail the login/logout it's recording.
func (h *handlers) recordSessionEvent(
	ctx context.Context,
	userID *uuid.UUID,
	email, role, event string,
	success bool,
	r *http.Request,
) {
	entry := models.SessionLogEntry{
		UserID:    userID,
		Email:     email,
		Role:      role,
		Event:     event,
		Success:   success,
		Browser:   browserFromUserAgent(r.UserAgent()),
		IPAddress: clientIP(r),
		UserAgent: r.UserAgent(),
	}
	if err := h.db.WithContext(ctx).Create(&entry).Error; err != nil {
		log.Printf("session log: failed to record %s event: %v", event, err)
		return
	}
	h.redis.Incr(ctx, sessionAuditVersionKey)
}

// logout records that the authenticated caller ended their session. The
// frontend clears its local token regardless of this call's outcome, so a
// failure here only means a missed audit row, never a stuck session.
func (h *handlers) logout(w http.ResponseWriter, r *http.Request) {
	actor, _ := actorFromContext(r.Context())

	var user models.User
	if err := h.db.WithContext(r.Context()).Where("id = ?", actor.UserID).First(&user).Error; err != nil {
		writeError(w, http.StatusInternalServerError, "looking up user")
		return
	}

	h.recordSessionEvent(r.Context(), &user.ID, user.Email, user.Role, "logout", true, r)
	writeJSON(w, http.StatusNoContent, nil)
}

type signupRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

// signupRateLimitKey namespaces the signup-attempt counter for one IP.
func signupRateLimitKey(ip string) string {
	return "ratelimit:signup:" + ip
}

// signup lets anyone create their own account - always as a requester, the
// only role a public, unauthenticated caller can ever grant themselves.
// Reviewer/admin accounts still require an existing admin (see createUser).
// IP-rate-limited the same way login is, since - unlike every other write
// endpoint in this API - it has no auth in front of it at all.
func (h *handlers) signup(w http.ResponseWriter, r *http.Request) {
	var req signupRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}

	ctx := r.Context()
	ip := clientIP(r)
	rateLimitKey := signupRateLimitKey(ip)

	attempts, err := h.redis.Get(ctx, rateLimitKey).Int()
	if err != nil && !errors.Is(err, redis.Nil) {
		log.Printf("checking signup rate limit for %s: %v", ip, err)
	}
	if attempts >= maxSignupAttempts {
		writeError(w, http.StatusTooManyRequests, "too many signup attempts - try again later")
		return
	}

	fields := map[string]string{}
	email := strings.TrimSpace(req.Email)
	if email == "" {
		fields["email"] = "email is required"
	}
	if len(req.Password) < 8 {
		fields["password"] = "password must be at least 8 characters"
	}
	if len(fields) > 0 {
		h.registerFailedSignup(ctx, rateLimitKey)
		writeValidationError(w, fields)
		return
	}

	hash, err := auth.HashPassword(req.Password)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "hashing password")
		return
	}

	user := models.User{Email: email, PasswordHash: hash, Role: string(workflow.RoleRequester)}
	if err := h.db.WithContext(ctx).Create(&user).Error; err != nil {
		if isUniqueViolation(err) {
			h.registerFailedSignup(ctx, rateLimitKey)
			writeValidationError(w, map[string]string{"email": "an account with this email already exists"})
			return
		}
		writeError(w, http.StatusInternalServerError, "creating account")
		return
	}
	h.invalidateUsersCache(ctx)
	h.recordSystemAuditEvent(ctx, user.ID, "user.signed_up", "USER", user.Email)

	writeJSON(w, http.StatusCreated, userResponse{
		ID:    user.ID.String(),
		Email: user.Email,
		Role:  user.Role,
	})
}

// registerFailedSignup mirrors registerFailedLogin's counter-with-expiry
// pattern for the separate signup rate limit.
func (h *handlers) registerFailedSignup(ctx context.Context, key string) {
	n, err := h.redis.Incr(ctx, key).Result()
	if err != nil {
		log.Printf("recording failed signup for %s: %v", key, err)
		return
	}
	if n == 1 {
		if err := h.redis.Expire(ctx, key, signupRateLimitWindow).Err(); err != nil {
			log.Printf("setting signup rate limit expiry for %s: %v", key, err)
		}
	}
}
