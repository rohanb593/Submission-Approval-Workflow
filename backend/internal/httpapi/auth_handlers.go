package httpapi

import (
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"
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

	var user models.User
	err := h.db.WithContext(r.Context()).Where("email = ?", req.Email).First(&user).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		writeError(w, http.StatusUnauthorized, "invalid email or password")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "looking up user")
		return
	}

	if !auth.CheckPassword(user.PasswordHash, req.Password) {
		writeError(w, http.StatusUnauthorized, "invalid email or password")
		return
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

	challenge := models.TwoFactorChallenge{
		UserID:    user.ID,
		CodeHash:  auth.HashOTP(code),
		ExpiresAt: time.Now().Add(otpTTL),
	}
	if err := h.db.WithContext(r.Context()).Create(&challenge).Error; err != nil {
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

	writeJSON(w, http.StatusOK, loginResponse{ChallengeID: challenge.ID.String()})
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

	var challenge models.TwoFactorChallenge
	err = h.db.WithContext(r.Context()).Where("id = ?", challengeID).First(&challenge).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		writeError(w, http.StatusUnauthorized, "invalid or expired code")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "looking up challenge")
		return
	}

	if challenge.ConsumedAt != nil || time.Now().After(challenge.ExpiresAt) || challenge.Attempts >= maxOTPAttempts {
		writeError(w, http.StatusUnauthorized, "invalid or expired code")
		return
	}

	if !auth.CheckOTP(challenge.CodeHash, req.Code) {
		if err := h.db.WithContext(r.Context()).
			Model(&challenge).
			Update("attempts", challenge.Attempts+1).Error; err != nil {
			writeError(w, http.StatusInternalServerError, "recording attempt")
			return
		}
		writeError(w, http.StatusUnauthorized, "invalid or expired code")
		return
	}

	now := time.Now()
	if err := h.db.WithContext(r.Context()).
		Model(&challenge).
		Update("consumed_at", now).Error; err != nil {
		writeError(w, http.StatusInternalServerError, "consuming challenge")
		return
	}

	var user models.User
	if err := h.db.WithContext(r.Context()).Where("id = ?", challenge.UserID).First(&user).Error; err != nil {
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
