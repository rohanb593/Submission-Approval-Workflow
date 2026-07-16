package httpapi

import (
	"errors"
	"net/http"
	"time"

	"github.com/rohanb2005uk/submission-approval-workflow/backend/internal/models"
	"github.com/rohanb2005uk/submission-approval-workflow/backend/internal/notifications"
)

type notificationResponse struct {
	ID            string    `json:"id"`
	ApplicationID string    `json:"application_id"`
	Message       string    `json:"message"`
	Read          bool      `json:"read"`
	CreatedAt     time.Time `json:"created_at"`
}

func toNotificationResponse(n models.Notification) notificationResponse {
	return notificationResponse{
		ID:            n.ID.String(),
		ApplicationID: n.ApplicationID.String(),
		Message:       n.Message,
		Read:          n.Read,
		CreatedAt:     n.CreatedAt,
	}
}

type notificationListResponse struct {
	Notifications []notificationResponse `json:"notifications"`
	UnreadCount   int64                  `json:"unread_count"`
}

// listNotifications returns the authenticated actor's most recent
// notifications, newest first, plus their total unread count.
func (h *handlers) listNotifications(w http.ResponseWriter, r *http.Request) {
	actor, _ := actorFromContext(r.Context())

	entries, unread, err := h.notifications.List(r.Context(), actor.UserID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "listing notifications")
		return
	}

	resp := make([]notificationResponse, len(entries))
	for i, e := range entries {
		resp[i] = toNotificationResponse(e)
	}
	writeJSON(w, http.StatusOK, notificationListResponse{Notifications: resp, UnreadCount: unread})
}

// markNotificationRead marks one of the actor's own notifications read.
func (h *handlers) markNotificationRead(w http.ResponseWriter, r *http.Request) {
	actor, _ := actorFromContext(r.Context())

	id, err := idFromPath(r)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid notification id")
		return
	}

	if err := h.notifications.MarkRead(r.Context(), id, actor.UserID); err != nil {
		if errors.Is(err, notifications.ErrNotFound) {
			writeError(w, http.StatusNotFound, "notification not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "marking notification read")
		return
	}
	writeJSON(w, http.StatusNoContent, nil)
}

// markAllNotificationsRead marks every unread notification belonging to the
// actor as read.
func (h *handlers) markAllNotificationsRead(w http.ResponseWriter, r *http.Request) {
	actor, _ := actorFromContext(r.Context())

	if err := h.notifications.MarkAllRead(r.Context(), actor.UserID); err != nil {
		writeError(w, http.StatusInternalServerError, "marking notifications read")
		return
	}
	writeJSON(w, http.StatusNoContent, nil)
}
