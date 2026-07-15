package httpapi

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgconn"
	"gorm.io/gorm"

	"github.com/rohanb2005uk/submission-approval-workflow/backend/internal/auth"
	"github.com/rohanb2005uk/submission-approval-workflow/backend/internal/models"
	"github.com/rohanb2005uk/submission-approval-workflow/backend/internal/workflow"
)

var validRoles = map[string]bool{
	string(workflow.RoleRequester): true,
	string(workflow.RoleReviewer):  true,
	string(workflow.RoleAdmin):     true,
}

type userAdminResponse struct {
	ID        string    `json:"id"`
	Email     string    `json:"email"`
	Role      string    `json:"role"`
	CreatedAt time.Time `json:"created_at"`
}

func toUserAdminResponse(u models.User) userAdminResponse {
	return userAdminResponse{
		ID:        u.ID.String(),
		Email:     u.Email,
		Role:      u.Role,
		CreatedAt: u.CreatedAt,
	}
}

// listUsers returns every account, for the admin user-management view.
func (h *handlers) listUsers(w http.ResponseWriter, r *http.Request) {
	var users []models.User
	if err := h.db.WithContext(r.Context()).Order("created_at asc").Find(&users).Error; err != nil {
		writeError(w, http.StatusInternalServerError, "listing users")
		return
	}

	resp := make([]userAdminResponse, len(users))
	for i, u := range users {
		resp[i] = toUserAdminResponse(u)
	}
	writeJSON(w, http.StatusOK, resp)
}

type createUserRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
	Role     string `json:"role"`
}

// createUser is how new accounts are provisioned: there's no public
// self-signup, so an admin creates every user directly with an initial
// password.
func (h *handlers) createUser(w http.ResponseWriter, r *http.Request) {
	var req createUserRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
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
	if !validRoles[req.Role] {
		fields["role"] = "role must be one of requester, reviewer, admin"
	}
	if len(fields) > 0 {
		writeValidationError(w, fields)
		return
	}

	hash, err := auth.HashPassword(req.Password)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "hashing password")
		return
	}

	user := models.User{Email: email, PasswordHash: hash, Role: req.Role}
	if err := h.db.WithContext(r.Context()).Create(&user).Error; err != nil {
		if isUniqueViolation(err) {
			writeValidationError(w, map[string]string{"email": "a user with this email already exists"})
			return
		}
		writeError(w, http.StatusInternalServerError, "creating user")
		return
	}

	writeJSON(w, http.StatusCreated, toUserAdminResponse(user))
}

type updateUserRoleRequest struct {
	Role string `json:"role"`
}

// updateUserRole changes a user's role. Admins cannot change their own role,
// so there's always at least one admin left able to fix a mistake.
func (h *handlers) updateUserRole(w http.ResponseWriter, r *http.Request) {
	actor, _ := actorFromContext(r.Context())

	id, err := idFromPath(r)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid user id")
		return
	}
	if id == actor.UserID {
		writeError(w, http.StatusForbidden, "you cannot change your own role")
		return
	}

	var req updateUserRoleRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	if !validRoles[req.Role] {
		writeValidationError(w, map[string]string{"role": "role must be one of requester, reviewer, admin"})
		return
	}

	var user models.User
	if err := h.db.WithContext(r.Context()).Where("id = ?", id).First(&user).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			writeError(w, http.StatusNotFound, "user not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "looking up user")
		return
	}

	if err := h.db.WithContext(r.Context()).Model(&user).Update("role", req.Role).Error; err != nil {
		writeError(w, http.StatusInternalServerError, "updating role")
		return
	}
	user.Role = req.Role

	writeJSON(w, http.StatusOK, toUserAdminResponse(user))
}

// deleteUser removes an account. Admins cannot delete themselves. Users who
// own applications or audit/activity history can't be deleted either — the
// database's foreign-key constraints (ON DELETE RESTRICT) reject it, which
// is surfaced as a 409 rather than an internal error.
func (h *handlers) deleteUser(w http.ResponseWriter, r *http.Request) {
	actor, _ := actorFromContext(r.Context())

	id, err := idFromPath(r)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid user id")
		return
	}
	if id == actor.UserID {
		writeError(w, http.StatusForbidden, "you cannot delete your own account")
		return
	}

	result := h.db.WithContext(r.Context()).Delete(&models.User{}, "id = ?", id)
	if result.Error != nil {
		if isForeignKeyViolation(result.Error) {
			writeError(w, http.StatusConflict, "cannot delete a user with existing applications or activity history")
			return
		}
		writeError(w, http.StatusInternalServerError, "deleting user")
		return
	}
	if result.RowsAffected == 0 {
		writeError(w, http.StatusNotFound, "user not found")
		return
	}

	writeJSON(w, http.StatusNoContent, nil)
}

func isUniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23505"
}

func isForeignKeyViolation(err error) bool {
	var pgErr *pgconn.PgError
	if !errors.As(err, &pgErr) {
		return false
	}
	// 23503 (foreign_key_violation) is the general FK error class; ON DELETE
	// RESTRICT specifically raises 23001 (restrict_violation) instead.
	return pgErr.Code == "23503" || pgErr.Code == "23001"
}
