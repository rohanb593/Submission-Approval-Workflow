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
		writeError(w, http.StatusTooManyRequests, "too many failed login attempts - try again later")
		return
	}

	var user models.User
	err = h.db.WithContext(ctx).Where("email = ?", req.Email).First(&user).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		h.registerFailedLogin(ctx, rateLimitKey)
		writeError(w, http.StatusUnauthorized, "invalid email or password")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "looking up user")
		return
	}

	if !auth.CheckPassword(user.PasswordHash, req.Password) {
		h.registerFailedLogin(ctx, rateLimitKey)
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

	attempts, _ := strconv.Atoi(data["attempts"])
	if attempts >= maxOTPAttempts {
		h.redis.Del(ctx, challengeKey)
		writeError(w, http.StatusUnauthorized, "invalid or expired code")
		return
	}

	if !auth.CheckOTP(data["code_hash"], req.Code) {
		if err := h.redis.HIncrBy(ctx, challengeKey, "attempts", 1).Err(); err != nil {
			writeError(w, http.StatusInternalServerError, "recording attempt")
			return
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

	writeJSON(w, http.StatusOK, loginResponse{
		Token: token,
		User: &userResponse{
			ID:    user.ID.String(),
			Email: user.Email,
			Role:  user.Role,
		},
	})
}
