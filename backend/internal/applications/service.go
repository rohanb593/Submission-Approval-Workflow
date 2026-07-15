// Package applications contains the business logic for creating, editing,
// listing, and transitioning applications. Handlers in internal/httpapi stay
// thin wrappers around this package; this is where DB access, ownership
// checks, and audit-log writes live.
package applications

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"github.com/rohanb2005uk/submission-approval-workflow/backend/internal/models"
	"github.com/rohanb2005uk/submission-approval-workflow/backend/internal/workflow"
)

var (
	// ErrNotFound means no application exists with the given ID.
	ErrNotFound = errors.New("application not found")
	// ErrNotDraft means the caller tried to edit an application that has
	// already left DRAFT status.
	ErrNotDraft = errors.New("application can only be edited while in DRAFT status")
)

// Re-exported so callers only need to import this package for the
// authorization errors a service call can return, alongside ErrNotFound and
// ErrNotDraft above.
var (
	ErrForbidden         = workflow.ErrForbidden
	ErrCommentRequired   = workflow.ErrCommentRequired
	ErrIllegalTransition = workflow.ErrIllegalTransition
)

var validCategories = map[string]bool{
	"travel":    true,
	"equipment": true,
	"training":  true,
	"other":     true,
}

// ValidationError describes one or more invalid input fields on a
// create/update request. It is distinct from the authorization/state errors
// above because it always maps to 400, never 403/404/409.
type ValidationError struct {
	Fields map[string]string
}

func (e *ValidationError) Error() string {
	return fmt.Sprintf("validation failed: %v", e.Fields)
}

// CreateInput is the caller-supplied data for a new draft application.
type CreateInput struct {
	Title       string
	Category    string
	Description string
	Amount      *float64
}

// UpdateInput is the caller-supplied data for editing a draft. It fully
// replaces the editable fields (title, category, description, amount).
type UpdateInput struct {
	Title       string
	Category    string
	Description string
	Amount      *float64
}

func validate(title, category string) error {
	fields := map[string]string{}
	if strings.TrimSpace(title) == "" {
		fields["title"] = "title is required"
	}
	if !validCategories[category] {
		fields["category"] = "category must be one of: travel, equipment, training, other"
	}
	if len(fields) > 0 {
		return &ValidationError{Fields: fields}
	}
	return nil
}

type Service struct {
	db *gorm.DB
}

func New(db *gorm.DB) *Service {
	return &Service{db: db}
}

// Create persists a new DRAFT application owned by ownerID.
func (s *Service) Create(ctx context.Context, ownerID uuid.UUID, input CreateInput) (*models.Application, error) {
	if err := validate(input.Title, input.Category); err != nil {
		return nil, err
	}

	app := models.Application{
		OwnerID:     ownerID,
		Title:       input.Title,
		Category:    input.Category,
		Description: input.Description,
		Amount:      input.Amount,
		Status:      string(workflow.StatusDraft),
	}
	if err := s.db.WithContext(ctx).Create(&app).Error; err != nil {
		return nil, fmt.Errorf("creating application: %w", err)
	}
	return &app, nil
}

// Get returns an application and its full audit trail, ordered oldest first.
func (s *Service) Get(ctx context.Context, id uuid.UUID) (*models.Application, []models.AuditLogEntry, error) {
	app, err := s.fetch(ctx, s.db, id)
	if err != nil {
		return nil, nil, err
	}

	var entries []models.AuditLogEntry
	if err := s.db.WithContext(ctx).
		Preload("Actor").
		Where("application_id = ?", id).
		Order("created_at asc").
		Find(&entries).Error; err != nil {
		return nil, nil, fmt.Errorf("loading audit log: %w", err)
	}

	return app, entries, nil
}

// List returns applications visible to the given actor. Requesters only see
// their own applications; reviewers and admins see every application.
// statusFilter, if non-empty, restricts the result to that status.
func (s *Service) List(ctx context.Context, actorID uuid.UUID, actorRole workflow.Role, statusFilter string) ([]models.Application, error) {
	q := s.db.WithContext(ctx).Model(&models.Application{})
	if actorRole == workflow.RoleRequester {
		q = q.Where("owner_id = ?", actorID)
	}
	if statusFilter != "" {
		q = q.Where("status = ?", statusFilter)
	}

	var apps []models.Application
	if err := q.Order("created_at desc").Find(&apps).Error; err != nil {
		return nil, fmt.Errorf("listing applications: %w", err)
	}
	return apps, nil
}

// UpdateDraft edits the editable fields of an application. Only the owner
// may do this, and only while the application is still DRAFT.
func (s *Service) UpdateDraft(ctx context.Context, id uuid.UUID, actorID uuid.UUID, input UpdateInput) (*models.Application, error) {
	if err := validate(input.Title, input.Category); err != nil {
		return nil, err
	}

	app, err := s.fetch(ctx, s.db, id)
	if err != nil {
		return nil, err
	}
	if app.OwnerID != actorID {
		return nil, fmt.Errorf("%w: only the owner can edit this application", ErrForbidden)
	}
	if app.Status != string(workflow.StatusDraft) {
		return nil, ErrNotDraft
	}

	app.Title = input.Title
	app.Category = input.Category
	app.Description = input.Description
	app.Amount = input.Amount
	if err := s.db.WithContext(ctx).Save(app).Error; err != nil {
		return nil, fmt.Errorf("saving application: %w", err)
	}
	return app, nil
}

// Transition attempts to move an application to a new status via the given
// action, on behalf of actorID/actorRole. The status update and its audit
// log entry are written atomically. Errors from the workflow package
// (ErrForbidden, ErrIllegalTransition, ErrCommentRequired) are propagated
// unwrapped so callers can match them with errors.Is.
func (s *Service) Transition(ctx context.Context, id uuid.UUID, actorID uuid.UUID, actorRole workflow.Role, action workflow.Action, comment string) (*models.Application, error) {
	var result models.Application

	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		app, err := s.fetch(ctx, tx, id)
		if err != nil {
			return err
		}

		isOwner := app.OwnerID == actorID
		newStatus, err := workflow.Transition(workflow.Status(app.Status), action, actorRole, isOwner, comment)
		if err != nil {
			return err
		}

		oldStatus := app.Status
		app.Status = string(newStatus)
		if err := tx.Save(app).Error; err != nil {
			return fmt.Errorf("saving application: %w", err)
		}

		var commentPtr *string
		if trimmed := strings.TrimSpace(comment); trimmed != "" {
			commentPtr = &trimmed
		}
		entry := models.AuditLogEntry{
			ApplicationID: app.ID,
			ActorID:       actorID,
			FromStatus:    oldStatus,
			ToStatus:      string(newStatus),
			Comment:       commentPtr,
		}
		if err := tx.Create(&entry).Error; err != nil {
			return fmt.Errorf("writing audit log: %w", err)
		}

		result = *app
		return nil
	})
	if err != nil {
		return nil, err
	}
	return &result, nil
}

func (s *Service) fetch(ctx context.Context, db *gorm.DB, id uuid.UUID) (*models.Application, error) {
	var app models.Application
	err := db.WithContext(ctx).First(&app, "id = ?", id).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("loading application: %w", err)
	}
	return &app, nil
}
