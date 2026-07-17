package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgconn"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"github.com/rohanb2005uk/submission-approval-workflow/backend/internal/auth"
	"github.com/rohanb2005uk/submission-approval-workflow/backend/internal/models"
	"github.com/rohanb2005uk/submission-approval-workflow/backend/internal/workflow"
)

// usersListCacheTTL bounds how long a cached user list can outlive the
// version counter's reach - a garbage-collection safety net, not the
// primary invalidation (that's the version bump on every write below).
const usersListCacheTTL = 5 * time.Minute

const usersListVersionKey = "cache:v:users"

func usersListCacheKey(version int64) string {
	return fmt.Sprintf("cache:users:list:v%d", version)
}

// invalidateUsersCache bumps the version counter so every previously cached
// user list becomes unreachable immediately; old entries expire on their own
// via usersListCacheTTL.
func (h *handlers) invalidateUsersCache(ctx context.Context) {
	h.redis.Incr(ctx, usersListVersionKey)
}

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
	ctx := r.Context()
	version, _ := h.redis.Get(ctx, usersListVersionKey).Int64()
	key := usersListCacheKey(version)

	if cached, err := h.redis.Get(ctx, key).Bytes(); err == nil {
		var resp []userAdminResponse
		if jsonErr := json.Unmarshal(cached, &resp); jsonErr == nil {
			writeJSON(w, http.StatusOK, resp)
			return
		}
	}

	var users []models.User
	if err := h.db.WithContext(ctx).Order("created_at asc").Find(&users).Error; err != nil {
		writeError(w, http.StatusInternalServerError, "listing users")
		return
	}

	resp := make([]userAdminResponse, len(users))
	for i, u := range users {
		resp[i] = toUserAdminResponse(u)
	}

	if encoded, err := json.Marshal(resp); err == nil {
		h.redis.Set(ctx, key, encoded, usersListCacheTTL)
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
	actor, _ := actorFromContext(r.Context())

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
	h.invalidateUsersCache(r.Context())
	h.recordSystemAuditEvent(r.Context(), actor.UserID, "user.created", "USER", user.Email)

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
	h.invalidateUsersCache(r.Context())
	h.recordSystemAuditEvent(r.Context(), actor.UserID, "user.role_changed", "USER", user.Email)

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

	// Clauses(clause.Returning{}) gets the row's data back from the DELETE
	// itself (RETURNING *), rather than a separate lookup query, so the
	// email is available for the system audit entry below even though the
	// row is already gone by the time we'd otherwise fetch it.
	var deleted models.User
	result := h.db.WithContext(r.Context()).Clauses(clause.Returning{}).Where("id = ?", id).Delete(&deleted)
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
	h.invalidateUsersCache(r.Context())
	h.recordSystemAuditEvent(r.Context(), actor.UserID, "user.deleted", "USER", deleted.Email)

	writeJSON(w, http.StatusNoContent, nil)
}

// recordSystemAuditEvent writes one System Audit row for an administrative
// action. Best-effort, matching recordSessionEvent: a logging failure must
// never fail the admin action it's recording.
func (h *handlers) recordSystemAuditEvent(ctx context.Context, actorID uuid.UUID, event, resourceType, resourceLabel string) {
	entry := models.SystemAuditLogEntry{
		ActorID:       actorID,
		Event:         event,
		ResourceType:  resourceType,
		ResourceLabel: resourceLabel,
	}
	if err := h.db.WithContext(ctx).Create(&entry).Error; err != nil {
		log.Printf("system audit log: failed to record %s event: %v", event, err)
		return
	}
	h.redis.Incr(ctx, systemAuditVersionKey)
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
