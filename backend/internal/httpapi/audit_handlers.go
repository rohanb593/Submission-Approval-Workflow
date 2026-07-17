package httpapi

import (
	"net/http"
	"strings"
	"time"

	"gorm.io/gorm"

	"github.com/rohanb2005uk/submission-approval-workflow/backend/internal/models"
)

type submissionAuditResponse struct {
	ID               string    `json:"id"`
	ApplicationID    string    `json:"application_id"`
	ApplicationTitle string    `json:"application_title"`
	ActorID          string    `json:"actor_id"`
	ActorEmail       string    `json:"actor_email"`
	ActorRole        string    `json:"actor_role"`
	FromStatus       string    `json:"from_status"`
	ToStatus         string    `json:"to_status"`
	Comment          *string   `json:"comment"`
	CreatedAt        time.Time `json:"created_at"`
}

type submissionAuditListResponse struct {
	Entries  []submissionAuditResponse `json:"entries"`
	Total    int64                     `json:"total"`
	Page     int                       `json:"page"`
	PageSize int                       `json:"page_size"`
}

// listSubmissionAudit returns the application status-transition log across
// every submission (not just one), for the admin-only Submission Audit view.
// Unlike getApplication's per-application audit_log, this needs actual SQL
// joins - not just Preload - so search can filter on the actor's email and
// the application's title in the same query that computes the total count.
func (h *handlers) listSubmissionAudit(w http.ResponseWriter, r *http.Request) {
	search := strings.TrimSpace(r.URL.Query().Get("search"))
	page := parsePositiveInt(r.URL.Query().Get("page"), 1)
	pageSize := parsePositiveInt(r.URL.Query().Get("page_size"), defaultPageSize)
	if pageSize > maxPageSize {
		pageSize = maxPageSize
	}

	baseQuery := func() *gorm.DB {
		q := h.db.WithContext(r.Context()).
			Model(&models.AuditLogEntry{}).
			Joins("JOIN users ON users.id = application_audit_log.actor_id").
			Joins("JOIN applications ON applications.id = application_audit_log.application_id")
		if search != "" {
			pattern := "%" + search + "%"
			q = q.Where(
				"users.email ILIKE ? OR applications.title ILIKE ? OR application_audit_log.comment ILIKE ?",
				pattern, pattern, pattern,
			)
		}
		return q
	}

	var total int64
	if err := baseQuery().Count(&total).Error; err != nil {
		writeError(w, http.StatusInternalServerError, "counting submission audit log")
		return
	}

	var entries []models.AuditLogEntry
	if err := baseQuery().
		Preload("Actor").
		Preload("Application").
		Order("application_audit_log.created_at desc").
		Offset((page - 1) * pageSize).
		Limit(pageSize).
		Find(&entries).Error; err != nil {
		writeError(w, http.StatusInternalServerError, "listing submission audit log")
		return
	}

	resp := make([]submissionAuditResponse, len(entries))
	for i, e := range entries {
		resp[i] = submissionAuditResponse{
			ID:               e.ID.String(),
			ApplicationID:    e.ApplicationID.String(),
			ApplicationTitle: e.Application.Title,
			ActorID:          e.ActorID.String(),
			ActorEmail:       e.Actor.Email,
			ActorRole:        e.Actor.Role,
			FromStatus:       e.FromStatus,
			ToStatus:         e.ToStatus,
			Comment:          e.Comment,
			CreatedAt:        e.CreatedAt,
		}
	}
	writeJSON(w, http.StatusOK, submissionAuditListResponse{
		Entries: resp, Total: total, Page: page, PageSize: pageSize,
	})
}

type sessionAuditResponse struct {
	ID        string    `json:"id"`
	UserID    *string   `json:"user_id"`
	Email     string    `json:"email"`
	Role      string    `json:"role"`
	Event     string    `json:"event"`
	Success   bool      `json:"success"`
	Browser   string    `json:"browser"`
	IPAddress string    `json:"ip_address"`
	UserAgent string    `json:"user_agent"`
	CreatedAt time.Time `json:"created_at"`
}

type sessionAuditListResponse struct {
	Entries  []sessionAuditResponse `json:"entries"`
	Total    int64                  `json:"total"`
	Page     int                    `json:"page"`
	PageSize int                    `json:"page_size"`
}

// listSessionAudit returns login/logout events, for the admin-only Session
// Audit view. event and result are optional exact-match filters on top of
// the free-text search (which matches email or IP).
func (h *handlers) listSessionAudit(w http.ResponseWriter, r *http.Request) {
	search := strings.TrimSpace(r.URL.Query().Get("search"))
	eventFilter := r.URL.Query().Get("event")
	resultFilter := r.URL.Query().Get("result")
	page := parsePositiveInt(r.URL.Query().Get("page"), 1)
	pageSize := parsePositiveInt(r.URL.Query().Get("page_size"), defaultPageSize)
	if pageSize > maxPageSize {
		pageSize = maxPageSize
	}

	baseQuery := func() *gorm.DB {
		q := h.db.WithContext(r.Context()).Model(&models.SessionLogEntry{})
		if search != "" {
			pattern := "%" + search + "%"
			q = q.Where("email ILIKE ? OR ip_address ILIKE ?", pattern, pattern)
		}
		if eventFilter == "login" || eventFilter == "logout" {
			q = q.Where("event = ?", eventFilter)
		}
		switch resultFilter {
		case "success":
			q = q.Where("success = ?", true)
		case "failed":
			q = q.Where("success = ?", false)
		}
		return q
	}

	var total int64
	if err := baseQuery().Count(&total).Error; err != nil {
		writeError(w, http.StatusInternalServerError, "counting session audit log")
		return
	}

	var entries []models.SessionLogEntry
	if err := baseQuery().
		Order("created_at desc").
		Offset((page - 1) * pageSize).
		Limit(pageSize).
		Find(&entries).Error; err != nil {
		writeError(w, http.StatusInternalServerError, "listing session audit log")
		return
	}

	resp := make([]sessionAuditResponse, len(entries))
	for i, e := range entries {
		var userID *string
		if e.UserID != nil {
			s := e.UserID.String()
			userID = &s
		}
		resp[i] = sessionAuditResponse{
			ID:        e.ID.String(),
			UserID:    userID,
			Email:     e.Email,
			Role:      e.Role,
			Event:     e.Event,
			Success:   e.Success,
			Browser:   e.Browser,
			IPAddress: e.IPAddress,
			UserAgent: e.UserAgent,
			CreatedAt: e.CreatedAt,
		}
	}
	writeJSON(w, http.StatusOK, sessionAuditListResponse{
		Entries: resp, Total: total, Page: page, PageSize: pageSize,
	})
}

type systemAuditResponse struct {
	ID            string    `json:"id"`
	Event         string    `json:"event"`
	ResourceType  string    `json:"resource_type"`
	ResourceLabel string    `json:"resource_label"`
	ActorID       string    `json:"actor_id"`
	ActorEmail    string    `json:"actor_email"`
	ActorRole     string    `json:"actor_role"`
	CreatedAt     time.Time `json:"created_at"`
}

type systemAuditListResponse struct {
	Entries  []systemAuditResponse `json:"entries"`
	Total    int64                 `json:"total"`
	Page     int                   `json:"page"`
	PageSize int                   `json:"page_size"`
}

// listSystemAudit returns administrative user/role-management events, for
// the admin-only System Audit view. There is no "result" filter here - every
// row is by definition an action that already succeeded (see
// recordSystemAuditEvent, called only after the underlying DB write commits).
func (h *handlers) listSystemAudit(w http.ResponseWriter, r *http.Request) {
	search := strings.TrimSpace(r.URL.Query().Get("search"))
	eventFilter := r.URL.Query().Get("event")
	page := parsePositiveInt(r.URL.Query().Get("page"), 1)
	pageSize := parsePositiveInt(r.URL.Query().Get("page_size"), defaultPageSize)
	if pageSize > maxPageSize {
		pageSize = maxPageSize
	}

	baseQuery := func() *gorm.DB {
		q := h.db.WithContext(r.Context()).
			Model(&models.SystemAuditLogEntry{}).
			Joins("JOIN users ON users.id = system_audit_log.actor_id")
		if search != "" {
			pattern := "%" + search + "%"
			q = q.Where(
				"users.email ILIKE ? OR system_audit_log.resource_label ILIKE ? OR system_audit_log.event ILIKE ?",
				pattern, pattern, pattern,
			)
		}
		if eventFilter != "" {
			q = q.Where("system_audit_log.event = ?", eventFilter)
		}
		return q
	}

	var total int64
	if err := baseQuery().Count(&total).Error; err != nil {
		writeError(w, http.StatusInternalServerError, "counting system audit log")
		return
	}

	var entries []models.SystemAuditLogEntry
	if err := baseQuery().
		Preload("Actor").
		Order("system_audit_log.created_at desc").
		Offset((page - 1) * pageSize).
		Limit(pageSize).
		Find(&entries).Error; err != nil {
		writeError(w, http.StatusInternalServerError, "listing system audit log")
		return
	}

	resp := make([]systemAuditResponse, len(entries))
	for i, e := range entries {
		resp[i] = systemAuditResponse{
			ID:            e.ID.String(),
			Event:         e.Event,
			ResourceType:  e.ResourceType,
			ResourceLabel: e.ResourceLabel,
			ActorID:       e.ActorID.String(),
			ActorEmail:    e.Actor.Email,
			ActorRole:     e.Actor.Role,
			CreatedAt:     e.CreatedAt,
		}
	}
	writeJSON(w, http.StatusOK, systemAuditListResponse{
		Entries: resp, Total: total, Page: page, PageSize: pageSize,
	})
}
