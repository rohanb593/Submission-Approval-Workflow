package httpapi

import (
	"time"

	"github.com/redis/go-redis/v9"
	"gorm.io/gorm"

	"github.com/rohanb2005uk/submission-approval-workflow/backend/internal/applications"
	"github.com/rohanb2005uk/submission-approval-workflow/backend/internal/mailer"
	"github.com/rohanb2005uk/submission-approval-workflow/backend/internal/notifications"
)

// tokenTTL is how long an issued JWT remains valid.
const tokenTTL = 24 * time.Hour

// otpTTL is how long an emailed 2FA code remains valid. Backed by a Redis key
// with this as its TTL, so an expired challenge is simply gone rather than
// something every read has to check for.
const otpTTL = 10 * time.Minute

// maxOTPAttempts is how many wrong codes a challenge tolerates before it's
// dead and the user has to log in again for a fresh one.
const maxOTPAttempts = 5

// maxLoginAttempts is how many failed passwords one email can rack up before
// login() starts refusing further attempts, regardless of whether the
// password given is correct.
const maxLoginAttempts = 5

// loginRateLimitWindow is how long a failed-login counter survives before
// Redis expires it and the email gets a clean slate.
const loginRateLimitWindow = 15 * time.Minute

// handlers holds the dependencies shared by every HTTP handler.
type handlers struct {
	db            *gorm.DB
	redis         *redis.Client
	apps          *applications.Service
	notifications *notifications.Service
	secret        string
	mailer        mailer.Mailer
	enable2FA     bool
}
