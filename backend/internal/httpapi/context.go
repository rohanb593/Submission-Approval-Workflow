package httpapi

import (
	"context"

	"github.com/google/uuid"

	"github.com/rohanb2005uk/submission-approval-workflow/backend/internal/workflow"
)

// Actor identifies the authenticated caller of a request, as decoded from
// their JWT by RequireAuth.
type Actor struct {
	UserID uuid.UUID
	Role   workflow.Role
}

type contextKey int

const actorContextKey contextKey = iota

func contextWithActor(ctx context.Context, actor Actor) context.Context {
	return context.WithValue(ctx, actorContextKey, actor)
}

// actorFromContext returns the authenticated actor for this request. It only
// returns ok=false if called on a route not wrapped by RequireAuth, which is
// a programming error, not a request-time condition.
func actorFromContext(ctx context.Context) (Actor, bool) {
	actor, ok := ctx.Value(actorContextKey).(Actor)
	return actor, ok
}
