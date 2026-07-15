package httpapi

import (
	"log"
	"net"
	"net/http"
	"strings"
	"time"

	"github.com/rohanb2005uk/submission-approval-workflow/backend/internal/models"
)

type statusRecorder struct {
	http.ResponseWriter
	status int
}

func (r *statusRecorder) WriteHeader(status int) {
	r.status = status
	r.ResponseWriter.WriteHeader(status)
}

// LogActivity records one row per request into activity_log, for the
// admin-only Activity Audit view. It must sit after RequireAuth in the
// middleware chain — requests with no actor in context (auth failures)
// are silently skipped, since only authenticated movements are logged.
func (h *handlers) LogActivity(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		rec := &statusRecorder{ResponseWriter: w, status: http.StatusOK}
		next.ServeHTTP(rec, r)

		actor, ok := actorFromContext(r.Context())
		if !ok {
			return
		}

		entry := models.ActivityLogEntry{
			ActorID:       actor.UserID,
			Method:        r.Method,
			Path:          r.URL.RequestURI(),
			StatusCode:    rec.status,
			DurationMs:    time.Since(start).Milliseconds(),
			Browser:       browserFromUserAgent(r.UserAgent()),
			IPAddress:     clientIP(r),
			UserAgent:     r.UserAgent(),
			Referer:       r.Referer(),
			ContentLength: r.ContentLength,
		}
		if err := h.db.Create(&entry).Error; err != nil {
			log.Printf("activity log: failed to record request: %v", err)
		}
	})
}

func clientIP(r *http.Request) string {
	if fwd := r.Header.Get("X-Forwarded-For"); fwd != "" {
		return strings.TrimSpace(strings.Split(fwd, ",")[0])
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}

func browserFromUserAgent(ua string) string {
	switch {
	case strings.Contains(ua, "Edg/"):
		return "Edge"
	case strings.Contains(ua, "Chrome/"):
		return "Chrome"
	case strings.Contains(ua, "Firefox/"):
		return "Firefox"
	case strings.Contains(ua, "Safari/") && !strings.Contains(ua, "Chrome"):
		return "Safari"
	case ua == "":
		return "Unknown"
	default:
		return "Other"
	}
}
