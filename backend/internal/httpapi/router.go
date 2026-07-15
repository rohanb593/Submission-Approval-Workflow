// Package httpapi wires the HTTP surface of the service: routing,
// authentication middleware, request/response encoding, and translating
// applications-package errors into HTTP status codes. It holds no business
// logic of its own beyond that translation.
package httpapi

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	chimiddleware "github.com/go-chi/chi/v5/middleware"
	"gorm.io/gorm"

	"github.com/rohanb2005uk/submission-approval-workflow/backend/internal/applications"
	"github.com/rohanb2005uk/submission-approval-workflow/backend/internal/workflow"
)

// NewRouter builds the complete HTTP router for the API. corsOrigin is the
// single origin (e.g. the frontend's dev server URL) allowed to call this
// API from a browser.
func NewRouter(db *gorm.DB, jwtSecret string, corsOrigin string) http.Handler {
	h := &handlers{
		db:     db,
		apps:   applications.New(db),
		secret: jwtSecret,
	}

	r := chi.NewRouter()
	r.Use(chimiddleware.Logger)
	r.Use(chimiddleware.Recoverer)
	r.Use(CORS(corsOrigin))

	r.Get("/healthz", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})

	r.Post("/auth/login", h.login)

	r.Route("/applications", func(r chi.Router) {
		r.Use(RequireAuth(jwtSecret))

		r.With(RequireRole(workflow.RoleApplicant)).Post("/", h.createApplication)
		r.Get("/", h.listApplications)

		r.Route("/{id}", func(r chi.Router) {
			r.Get("/", h.getApplication)
			r.Put("/", h.updateApplication)
			r.Post("/submit", h.transition(workflow.ActionSubmit))
			r.Post("/start-review", h.transition(workflow.ActionStartReview))
			r.Post("/approve", h.transition(workflow.ActionApprove))
			r.Post("/reject", h.transition(workflow.ActionReject))
			r.Post("/return", h.transition(workflow.ActionReturnForChanges))
		})
	})

	return r
}
