package httpapi

import (
	"net/http"
	"time"

	"github.com/rohanb2005uk/submission-approval-workflow/backend/internal/models"
)

// activityLogLimit caps how many rows the Activity Audit view fetches at
// once. There's no pagination UI yet, so this is simply "recent enough to
// be useful" rather than a real page size.
const activityLogLimit = 200

type activityResponse struct {
	ID            string    `json:"id"`
	ActorID       string    `json:"actor_id"`
	ActorEmail    string    `json:"actor_email"`
	ActorRole     string    `json:"actor_role"`
	Method        string    `json:"method"`
	Path          string    `json:"path"`
	StatusCode    int       `json:"status_code"`
	DurationMs    int64     `json:"duration_ms"`
	Browser       string    `json:"browser"`
	IPAddress     string    `json:"ip_address"`
	UserAgent     string    `json:"user_agent"`
	Referer       string    `json:"referer"`
	ContentLength int64     `json:"content_length"`
	CreatedAt     time.Time `json:"created_at"`
}

func toActivityResponse(e models.ActivityLogEntry) activityResponse {
	return activityResponse{
		ID:            e.ID.String(),
		ActorID:       e.ActorID.String(),
		ActorEmail:    e.Actor.Email,
		ActorRole:     e.Actor.Role,
		Method:        e.Method,
		Path:          e.Path,
		StatusCode:    e.StatusCode,
		DurationMs:    e.DurationMs,
		Browser:       e.Browser,
		IPAddress:     e.IPAddress,
		UserAgent:     e.UserAgent,
		Referer:       e.Referer,
		ContentLength: e.ContentLength,
		CreatedAt:     e.CreatedAt,
	}
}

// listActivity returns the most recent authenticated requests, newest
// first. Filtering by actor/IP/path is left to the frontend, since the
// result set is already capped to activityLogLimit rows.
func (h *handlers) listActivity(w http.ResponseWriter, r *http.Request) {
	var entries []models.ActivityLogEntry
	err := h.db.WithContext(r.Context()).
		Preload("Actor").
		Order("created_at desc").
		Limit(activityLogLimit).
		Find(&entries).Error
	if err != nil {
		writeError(w, http.StatusInternalServerError, "listing activity log")
		return
	}

	resp := make([]activityResponse, len(entries))
	for i, e := range entries {
		resp[i] = toActivityResponse(e)
	}
	writeJSON(w, http.StatusOK, resp)
}
