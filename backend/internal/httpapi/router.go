// Package httpapi wires the HTTP surface of the service: routing,
// authentication middleware, request/response encoding, and translating
// applications-package errors into HTTP status codes. It holds no business
// logic of its own beyond that translation.
package httpapi

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	chimiddleware "github.com/go-chi/chi/v5/middleware"
	"github.com/redis/go-redis/v9"
	"gorm.io/gorm"

	"github.com/rohanb2005uk/submission-approval-workflow/backend/internal/applications"
	"github.com/rohanb2005uk/submission-approval-workflow/backend/internal/mailer"
	"github.com/rohanb2005uk/submission-approval-workflow/backend/internal/workflow"
)

// NewRouter builds the complete HTTP router for the API. corsOrigin is the
// single origin (e.g. the frontend's dev server URL) allowed to call this
// API from a browser.
func NewRouter(db *gorm.DB, redisClient *redis.Client, jwtSecret string, corsOrigin string, mailSender mailer.Mailer, enable2FA bool) http.Handler {
	h := &handlers{
		db:        db,
		redis:     redisClient,
		apps:      applications.New(db),
		secret:    jwtSecret,
		mailer:    mailSender,
		enable2FA: enable2FA,
	}

	r := chi.NewRouter()
	r.Use(chimiddleware.Logger)
	r.Use(chimiddleware.Recoverer)
	r.Use(CORS(corsOrigin))

	r.Get("/healthz", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})

	r.Post("/auth/login", h.login)
	r.Post("/auth/login/verify", h.verifyLogin)

	r.Route("/applications", func(r chi.Router) {
		r.Use(RequireAuth(jwtSecret))
		r.Use(h.LogActivity)

		r.With(RequireRole(workflow.RoleRequester)).Post("/", h.createApplication)
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

	r.Route("/activity", func(r chi.Router) {
		r.Use(RequireAuth(jwtSecret))
		r.Use(h.LogActivity)
		r.Use(RequireRole(workflow.RoleAdmin))

		r.Get("/", h.listActivity)
	})

	r.Route("/admin/users", func(r chi.Router) {
		r.Use(RequireAuth(jwtSecret))
		r.Use(h.LogActivity)
		r.Use(RequireRole(workflow.RoleAdmin))

		r.Get("/", h.listUsers)
		r.Post("/", h.createUser)

		r.Route("/{id}", func(r chi.Router) {
			r.Put("/role", h.updateUserRole)
			r.Delete("/", h.deleteUser)
		})
	})

	return r
}
