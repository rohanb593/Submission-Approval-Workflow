package httpapi

import (
	"net/http"
	"strings"

	"github.com/rohanb2005uk/submission-approval-workflow/backend/internal/auth"
	"github.com/rohanb2005uk/submission-approval-workflow/backend/internal/workflow"
)

// RequireAuth verifies the request's Bearer JWT and attaches the resulting
// Actor to the request context for downstream handlers. It is the only
// place authentication is checked; per-action authorization (role, ownership)
// is left to the workflow package and the applications service, so there is
// a single source of truth for "who can do what".
func RequireAuth(secret string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			header := r.Header.Get("Authorization")
			token, ok := strings.CutPrefix(header, "Bearer ")
			if !ok || strings.TrimSpace(token) == "" {
				writeError(w, http.StatusUnauthorized, "missing or malformed Authorization header")
				return
			}

			claims, err := auth.ParseToken(token, secret)
			if err != nil {
				writeError(w, http.StatusUnauthorized, "invalid or expired token")
				return
			}

			actor := Actor{UserID: claims.UserID, Role: workflow.Role(claims.Role)}
			r = r.WithContext(contextWithActor(r.Context(), actor))
			next.ServeHTTP(w, r)
		})
	}
}

// RequireRole rejects the request with 403 unless the authenticated actor
// has the given role. It must run after RequireAuth. Used only for rules
// that fall outside the state machine itself, such as "only applicants may
// create applications".
func RequireRole(role workflow.Role) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			actor, ok := actorFromContext(r.Context())
			if !ok || actor.Role != role {
				writeError(w, http.StatusForbidden, "you do not have permission to perform this action")
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}
