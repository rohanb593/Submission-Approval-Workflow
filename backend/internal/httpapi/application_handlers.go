package httpapi

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/rohanb2005uk/submission-approval-workflow/backend/internal/applications"
	"github.com/rohanb2005uk/submission-approval-workflow/backend/internal/models"
	"github.com/rohanb2005uk/submission-approval-workflow/backend/internal/workflow"
)

var validStatuses = map[string]bool{
	string(workflow.StatusDraft):       true,
	string(workflow.StatusSubmitted):   true,
	string(workflow.StatusUnderReview): true,
	string(workflow.StatusApproved):    true,
	string(workflow.StatusRejected):    true,
}

type applicationResponse struct {
	ID          string    `json:"id"`
	OwnerID     string    `json:"owner_id"`
	Title       string    `json:"title"`
	Category    string    `json:"category"`
	Description string    `json:"description"`
	Amount      *float64  `json:"amount"`
	Status      string    `json:"status"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

func toApplicationResponse(app *models.Application) applicationResponse {
	return applicationResponse{
		ID:          app.ID.String(),
		OwnerID:     app.OwnerID.String(),
		Title:       app.Title,
		Category:    app.Category,
		Description: app.Description,
		Amount:      app.Amount,
		Status:      app.Status,
		CreatedAt:   app.CreatedAt,
		UpdatedAt:   app.UpdatedAt,
	}
}

type auditEntryResponse struct {
	ID         string    `json:"id"`
	ActorID    string    `json:"actor_id"`
	ActorEmail string    `json:"actor_email"`
	FromStatus string    `json:"from_status"`
	ToStatus   string    `json:"to_status"`
	Comment    *string   `json:"comment"`
	CreatedAt  time.Time `json:"created_at"`
}

func toAuditEntryResponse(e models.AuditLogEntry) auditEntryResponse {
	return auditEntryResponse{
		ID:         e.ID.String(),
		ActorID:    e.ActorID.String(),
		ActorEmail: e.Actor.Email,
		FromStatus: e.FromStatus,
		ToStatus:   e.ToStatus,
		Comment:    e.Comment,
		CreatedAt:  e.CreatedAt,
	}
}

type applicationDetailResponse struct {
	applicationResponse
	AuditLog []auditEntryResponse `json:"audit_log"`
}

type applicationRequest struct {
	Title       string   `json:"title"`
	Category    string   `json:"category"`
	Description string   `json:"description"`
	Amount      *float64 `json:"amount"`
}

type transitionRequest struct {
	Comment string `json:"comment"`
}

// decodeJSONBody decodes dst from the request body, treating an empty body
// as a no-op (leaving dst at its zero value) rather than an error — several
// transition endpoints (submit, start-review, approve) have no required
// fields, so callers may send no body at all.
func decodeJSONBody(r *http.Request, dst any) error {
	if err := json.NewDecoder(r.Body).Decode(dst); err != nil && !errors.Is(err, io.EOF) {
		return err
	}
	return nil
}

func idFromPath(r *http.Request) (uuid.UUID, error) {
	return uuid.Parse(chi.URLParam(r, "id"))
}

// handleServiceError maps an error returned by internal/applications to the
// appropriate HTTP status code and structured error body.
func handleServiceError(w http.ResponseWriter, err error) {
	var validationErr *applications.ValidationError
	switch {
	case errors.As(err, &validationErr):
		writeValidationError(w, validationErr.Fields)
	case errors.Is(err, applications.ErrNotFound):
		writeError(w, http.StatusNotFound, "application not found")
	case errors.Is(err, applications.ErrForbidden):
		writeError(w, http.StatusForbidden, err.Error())
	case errors.Is(err, applications.ErrCommentRequired):
		writeError(w, http.StatusBadRequest, err.Error())
	case errors.Is(err, applications.ErrIllegalTransition):
		writeError(w, http.StatusConflict, err.Error())
	case errors.Is(err, applications.ErrNotDraft):
		writeError(w, http.StatusConflict, err.Error())
	default:
		writeError(w, http.StatusInternalServerError, "internal server error")
	}
}

func (h *handlers) createApplication(w http.ResponseWriter, r *http.Request) {
	actor, _ := actorFromContext(r.Context())

	var req applicationRequest
	if err := decodeJSONBody(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}

	app, err := h.apps.Create(r.Context(), actor.UserID, applications.CreateInput{
		Title:       req.Title,
		Category:    req.Category,
		Description: req.Description,
		Amount:      req.Amount,
	})
	if err != nil {
		handleServiceError(w, err)
		return
	}

	writeJSON(w, http.StatusCreated, toApplicationResponse(app))
}

func (h *handlers) listApplications(w http.ResponseWriter, r *http.Request) {
	actor, _ := actorFromContext(r.Context())

	status := r.URL.Query().Get("status")
	if status != "" && !validStatuses[status] {
		writeError(w, http.StatusBadRequest, "unknown status filter")
		return
	}

	apps, err := h.apps.List(r.Context(), actor.UserID, actor.Role, status)
	if err != nil {
		handleServiceError(w, err)
		return
	}

	resp := make([]applicationResponse, len(apps))
	for i, app := range apps {
		resp[i] = toApplicationResponse(&app)
	}
	writeJSON(w, http.StatusOK, resp)
}

func (h *handlers) getApplication(w http.ResponseWriter, r *http.Request) {
	actor, _ := actorFromContext(r.Context())

	id, err := idFromPath(r)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid application id")
		return
	}

	app, entries, err := h.apps.Get(r.Context(), id)
	if err != nil {
		handleServiceError(w, err)
		return
	}

	// An applicant may only view their own application; a reviewer may view any.
	if actor.Role == workflow.RoleApplicant && app.OwnerID != actor.UserID {
		writeError(w, http.StatusForbidden, "you do not have permission to view this application")
		return
	}

	auditResp := make([]auditEntryResponse, len(entries))
	for i, e := range entries {
		auditResp[i] = toAuditEntryResponse(e)
	}

	writeJSON(w, http.StatusOK, applicationDetailResponse{
		applicationResponse: toApplicationResponse(app),
		AuditLog:            auditResp,
	})
}

func (h *handlers) updateApplication(w http.ResponseWriter, r *http.Request) {
	actor, _ := actorFromContext(r.Context())

	id, err := idFromPath(r)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid application id")
		return
	}

	var req applicationRequest
	if err := decodeJSONBody(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}

	app, err := h.apps.UpdateDraft(r.Context(), id, actor.UserID, applications.UpdateInput{
		Title:       req.Title,
		Category:    req.Category,
		Description: req.Description,
		Amount:      req.Amount,
	})
	if err != nil {
		handleServiceError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, toApplicationResponse(app))
}

// transition returns a handler that performs the given workflow action on
// the application in the URL path, using an optional comment from the body.
func (h *handlers) transition(action workflow.Action) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		actor, _ := actorFromContext(r.Context())

		id, err := idFromPath(r)
		if err != nil {
			writeError(w, http.StatusBadRequest, "invalid application id")
			return
		}

		var req transitionRequest
		if err := decodeJSONBody(r, &req); err != nil {
			writeError(w, http.StatusBadRequest, "invalid JSON body")
			return
		}

		app, err := h.apps.Transition(r.Context(), id, actor.UserID, actor.Role, action, req.Comment)
		if err != nil {
			handleServiceError(w, err)
			return
		}

		writeJSON(w, http.StatusOK, toApplicationResponse(app))
	}
}
