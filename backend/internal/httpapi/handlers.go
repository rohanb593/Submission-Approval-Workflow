package httpapi

import (
	"time"

	"gorm.io/gorm"

	"github.com/rohanb2005uk/submission-approval-workflow/backend/internal/applications"
	"github.com/rohanb2005uk/submission-approval-workflow/backend/internal/mailer"
)

// tokenTTL is how long an issued JWT remains valid.
const tokenTTL = 24 * time.Hour

// otpTTL is how long an emailed 2FA code remains valid.
const otpTTL = 10 * time.Minute

// maxOTPAttempts is how many wrong codes a challenge tolerates before it's
// dead and the user has to log in again for a fresh one.
const maxOTPAttempts = 5

// handlers holds the dependencies shared by every HTTP handler.
type handlers struct {
	db        *gorm.DB
	apps      *applications.Service
	secret    string
	mailer    mailer.Mailer
	enable2FA bool
}
