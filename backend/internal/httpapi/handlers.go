package httpapi

import (
	"time"

	"gorm.io/gorm"

	"github.com/rohanb2005uk/submission-approval-workflow/backend/internal/applications"
)

// tokenTTL is how long an issued JWT remains valid.
const tokenTTL = 24 * time.Hour

// handlers holds the dependencies shared by every HTTP handler.
type handlers struct {
	db     *gorm.DB
	apps   *applications.Service
	secret string
}
