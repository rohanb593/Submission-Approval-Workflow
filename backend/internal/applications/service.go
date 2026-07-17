// Package applications contains the business logic for creating, editing,
// listing, and transitioning applications. Handlers in internal/httpapi stay
// thin wrappers around this package; this is where DB access, ownership
// checks, and audit-log writes live.
package applications

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
	"gorm.io/gorm"

	"github.com/rohanb2005uk/submission-approval-workflow/backend/internal/mailer"
	"github.com/rohanb2005uk/submission-approval-workflow/backend/internal/models"
	"github.com/rohanb2005uk/submission-approval-workflow/backend/internal/workflow"
)

// listCacheTTL/getCacheTTL bound how long a cached response can outlive its
// version counter's reach - a safety net for garbage collection, not the
// primary invalidation mechanism (that's the version bump on every write).
const (
	listCacheTTL = 5 * time.Minute
	getCacheTTL  = 5 * time.Minute
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
	db          *gorm.DB
	redis       *redis.Client
	mailer      mailer.Mailer
	notifyEmail bool
}

// New builds the applications Service. mailSender/notifyEmail drive
// status-change email notifications (see notifyStatusChange); an in-app
// Notification row is always created regardless of notifyEmail.
func New(db *gorm.DB, redisClient *redis.Client, mailSender mailer.Mailer, notifyEmail bool) *Service {
	return &Service{db: db, redis: redisClient, mailer: mailSender, notifyEmail: notifyEmail}
}

// cachedApplicationDetail is what Get() stores in Redis: the application
// plus its audit trail, so a cache hit skips both queries at once.
type cachedApplicationDetail struct {
	Application models.Application
	AuditLog    []models.AuditLogEntry
}

// cachedApplicationList is what List() stores in Redis: one page of
// applications plus the total row count the query matched (pre-pagination),
// so a cache hit skips both the page query and the count query at once.
type cachedApplicationList struct {
	Applications []models.Application
	Total        int64
}

// listScope groups List() results the way visibility actually splits them:
// requesters only ever see their own applications, so their cache is scoped
// per-owner; reviewers/admins see everything, so they share one "all" scope.
func listScope(actorID uuid.UUID, actorRole workflow.Role) string {
	if actorRole == workflow.RoleRequester {
		return "owner:" + actorID.String()
	}
	return "all"
}

func listVersionKey(scope string) string {
	return "cache:v:applications:" + scope
}

func listCacheKey(scope, statusFilter, search string, page, pageSize int, version int64) string {
	return fmt.Sprintf("cache:applications:list:%s:%s:%s:p%d:z%d:v%d", scope, statusFilter, search, page, pageSize, version)
}

func countsCacheKey(scope string, version int64) string {
	return fmt.Sprintf("cache:applications:counts:%s:v%d", scope, version)
}

func getCacheKey(id uuid.UUID) string {
	return "cache:applications:get:" + id.String()
}

// invalidateCaches drops app's cached Get() entry and bumps both list
// version counters it could appear under (the global "all" scope reviewers
// and admins see, and its owner's scope), so every previously cached list
// response becomes unreachable immediately - no need to know every status
// filter combination that might have been cached.
func (s *Service) invalidateCaches(ctx context.Context, app *models.Application) {
	s.redis.Del(ctx, getCacheKey(app.ID))
	s.redis.Incr(ctx, listVersionKey("all"))
	s.redis.Incr(ctx, listVersionKey("owner:"+app.OwnerID.String()))
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
	s.invalidateCaches(ctx, &app)
	return &app, nil
}

// Get returns an application and its full audit trail, ordered oldest first.
func (s *Service) Get(ctx context.Context, id uuid.UUID) (*models.Application, []models.AuditLogEntry, error) {
	key := getCacheKey(id)
	if cached, err := s.redis.Get(ctx, key).Bytes(); err == nil {
		var payload cachedApplicationDetail
		if jsonErr := json.Unmarshal(cached, &payload); jsonErr == nil {
			return &payload.Application, payload.AuditLog, nil
		}
	}

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

	if encoded, err := json.Marshal(cachedApplicationDetail{Application: *app, AuditLog: entries}); err == nil {
		s.redis.Set(ctx, key, encoded, getCacheTTL)
	}

	return app, entries, nil
}

// List returns one page of applications visible to the given actor.
// Requesters only see their own applications; reviewers and admins see
// every application. statusFilter, if non-empty, restricts the result to
// that status; search, if non-empty, matches (case-insensitively) against
// title or description. page is 1-indexed. It also returns the total number
// of matching rows (before pagination), for the caller to compute page
// count.
func (s *Service) List(ctx context.Context, actorID uuid.UUID, actorRole workflow.Role, statusFilter, search string, page, pageSize int) ([]models.Application, int64, error) {
	scope := listScope(actorID, actorRole)
	version, _ := s.redis.Get(ctx, listVersionKey(scope)).Int64()
	key := listCacheKey(scope, statusFilter, search, page, pageSize, version)

	if cached, err := s.redis.Get(ctx, key).Bytes(); err == nil {
		var payload cachedApplicationList
		if jsonErr := json.Unmarshal(cached, &payload); jsonErr == nil {
			return payload.Applications, payload.Total, nil
		}
	}

	// A function, not a shared *gorm.DB, so Count() and Find() each start
	// from the same base conditions instead of one mutating the other's
	// chain.
	baseQuery := func() *gorm.DB {
		q := s.db.WithContext(ctx).Model(&models.Application{})
		if actorRole == workflow.RoleRequester {
			q = q.Where("owner_id = ?", actorID)
		}
		if statusFilter != "" {
			q = q.Where("status = ?", statusFilter)
		}
		if search != "" {
			pattern := "%" + search + "%"
			q = q.Where("title ILIKE ? OR description ILIKE ?", pattern, pattern)
		}
		return q
	}

	var total int64
	if err := baseQuery().Count(&total).Error; err != nil {
		return nil, 0, fmt.Errorf("counting applications: %w", err)
	}

	var apps []models.Application
	if err := baseQuery().
		Order("created_at desc").
		Offset((page - 1) * pageSize).
		Limit(pageSize).
		Find(&apps).Error; err != nil {
		return nil, 0, fmt.Errorf("listing applications: %w", err)
	}

	if encoded, err := json.Marshal(cachedApplicationList{Applications: apps, Total: total}); err == nil {
		s.redis.Set(ctx, key, encoded, listCacheTTL)
	}

	return apps, total, nil
}

// Counts returns how many applications visible to the given actor are in
// each status, ignoring any status/search/page filter — it powers the
// dashboard stat cards, which always summarize the actor's whole visible
// set regardless of what's currently filtered or paginated in the table.
func (s *Service) Counts(ctx context.Context, actorID uuid.UUID, actorRole workflow.Role) (map[string]int64, error) {
	scope := listScope(actorID, actorRole)
	version, _ := s.redis.Get(ctx, listVersionKey(scope)).Int64()
	key := countsCacheKey(scope, version)

	if cached, err := s.redis.Get(ctx, key).Bytes(); err == nil {
		var counts map[string]int64
		if jsonErr := json.Unmarshal(cached, &counts); jsonErr == nil {
			return counts, nil
		}
	}

	q := s.db.WithContext(ctx).Model(&models.Application{})
	if actorRole == workflow.RoleRequester {
		q = q.Where("owner_id = ?", actorID)
	}

	var rows []struct {
		Status string
		Count  int64
	}
	if err := q.Select("status, count(*) as count").Group("status").Find(&rows).Error; err != nil {
		return nil, fmt.Errorf("counting applications by status: %w", err)
	}

	counts := make(map[string]int64, len(rows))
	for _, row := range rows {
		counts[row.Status] = row.Count
	}

	if encoded, err := json.Marshal(counts); err == nil {
		s.redis.Set(ctx, key, encoded, listCacheTTL)
	}

	return counts, nil
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
	s.invalidateCaches(ctx, app)
	return app, nil
}

// Transition attempts to move an application to a new status via the given
// action, on behalf of actorID/actorRole. The status update and its audit
// log entry are written atomically. Errors from the workflow package
// (ErrForbidden, ErrIllegalTransition, ErrCommentRequired) are propagated
// unwrapped so callers can match them with errors.Is.
func (s *Service) Transition(ctx context.Context, id uuid.UUID, actorID uuid.UUID, actorRole workflow.Role, action workflow.Action, comment string) (*models.Application, error) {
	var result models.Application
	var targets []notificationTarget

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

		targets, err = notificationTargets(tx, app, action, newStatus, actorID, comment)
		if err != nil {
			return fmt.Errorf("determining notification recipients: %w", err)
		}
		for _, target := range targets {
			notif := models.Notification{
				RecipientID:   target.Recipient.ID,
				ApplicationID: app.ID,
				Message:       target.Message,
			}
			if err := tx.Create(&notif).Error; err != nil {
				return fmt.Errorf("creating notification: %w", err)
			}
		}

		result = *app
		return nil
	})
	if err != nil {
		return nil, err
	}
	s.invalidateCaches(ctx, &result)
	// Bumps the admin-only Submission Audit view's cache - this is the only
	// place an AuditLogEntry row gets written. Must match
	// submissionAuditVersionKey in internal/httpapi/audit_handlers.go.
	s.redis.Incr(ctx, "cache:v:audit:submissions")
	// Email delivery happens after the transaction commits: it's an
	// outbound network call, and the status change (plus its in-app
	// Notification row) must not be held hostage - or rolled back - by a
	// slow or failing mail provider.
	s.sendNotificationEmails(targets)
	return &result, nil
}

// notificationTarget pairs a recipient with the message they should be
// notified with, for both the in-app Notification row and the optional
// email.
type notificationTarget struct {
	Recipient models.User
	Message   string
}

// notificationTargets decides who should be notified about a transition and
// what to tell them. A submit (first submission or a resubmission after
// being returned) notifies every reviewer/admin that a new application
// needs review; every other transition notifies the application's owner of
// the decision, unless the actor performing it is the owner themselves
// (an admin acting on their own application).
func notificationTargets(tx *gorm.DB, app *models.Application, action workflow.Action, newStatus workflow.Status, actorID uuid.UUID, comment string) ([]notificationTarget, error) {
	if action == workflow.ActionSubmit {
		var reviewers []models.User
		if err := tx.Where("role IN ?", []string{string(workflow.RoleReviewer), string(workflow.RoleAdmin)}).
			Find(&reviewers).Error; err != nil {
			return nil, fmt.Errorf("loading reviewers: %w", err)
		}
		message := fmt.Sprintf("New application %q needs review.", app.Title)
		targets := make([]notificationTarget, len(reviewers))
		for i, reviewer := range reviewers {
			targets[i] = notificationTarget{Recipient: reviewer, Message: message}
		}
		return targets, nil
	}

	if app.OwnerID == actorID {
		return nil, nil
	}
	var owner models.User
	if err := tx.First(&owner, "id = ?", app.OwnerID).Error; err != nil {
		return nil, fmt.Errorf("loading application owner: %w", err)
	}
	return []notificationTarget{{Recipient: owner, Message: statusChangeMessage(app.Title, action, newStatus, comment)}}, nil
}

func statusChangeMessage(title string, action workflow.Action, newStatus workflow.Status, comment string) string {
	switch action {
	case workflow.ActionStartReview:
		return fmt.Sprintf("Your application %q is now under review.", title)
	case workflow.ActionApprove:
		return fmt.Sprintf("Your application %q was approved.", title)
	case workflow.ActionReject:
		return fmt.Sprintf("Your application %q was rejected: %s", title, comment)
	case workflow.ActionReturnForChanges:
		return fmt.Sprintf("Your application %q was returned for changes: %s", title, comment)
	default:
		return fmt.Sprintf("Your application %q changed status to %s.", title, newStatus)
	}
}

// sendNotificationEmails best-effort emails each notification target. A
// mailer failure - or email notifications simply being disabled - never
// fails the call: the transition already committed and the in-app
// Notification row is the row of record, email is a delivery bonus.
func (s *Service) sendNotificationEmails(targets []notificationTarget) {
	if !s.notifyEmail || s.mailer == nil {
		return
	}
	for _, target := range targets {
		if err := s.mailer.Send(target.Recipient.Email, "Submission status update", target.Message); err != nil {
			log.Printf("sending notification email to %s: %v", target.Recipient.Email, err)
		}
	}
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
