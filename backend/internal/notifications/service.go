// Package notifications is the read/ack side of in-app notifications: it
// lists a user's notifications and lets them mark one, or all, as read.
// The write side (deciding who gets notified about what) lives in
// internal/applications, alongside the status transitions that trigger it.
package notifications

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"github.com/rohanb2005uk/submission-approval-workflow/backend/internal/models"
)

// listLimit caps how many notifications List returns - recent enough to be
// useful for a dropdown/panel, not a full paginated history.
const listLimit = 50

// ErrNotFound means no notification with that ID exists for the given
// recipient - either it truly doesn't exist, or it belongs to someone else,
// which callers should treat identically to avoid leaking existence.
var ErrNotFound = errors.New("notification not found")

type Service struct {
	db *gorm.DB
}

func New(db *gorm.DB) *Service {
	return &Service{db: db}
}

// List returns recipientID's most recent notifications, newest first,
// alongside their total unread count (which is not bounded by listLimit).
func (s *Service) List(ctx context.Context, recipientID uuid.UUID) ([]models.Notification, int64, error) {
	var entries []models.Notification
	if err := s.db.WithContext(ctx).
		Where("recipient_id = ?", recipientID).
		Order("created_at desc").
		Limit(listLimit).
		Find(&entries).Error; err != nil {
		return nil, 0, fmt.Errorf("listing notifications: %w", err)
	}

	var unread int64
	if err := s.db.WithContext(ctx).Model(&models.Notification{}).
		Where("recipient_id = ? AND read = false", recipientID).
		Count(&unread).Error; err != nil {
		return nil, 0, fmt.Errorf("counting unread notifications: %w", err)
	}

	return entries, unread, nil
}

// MarkRead marks a single notification read, scoped to recipientID so one
// user can never mark - or even confirm the existence of - another user's
// notification.
func (s *Service) MarkRead(ctx context.Context, id, recipientID uuid.UUID) error {
	res := s.db.WithContext(ctx).Model(&models.Notification{}).
		Where("id = ? AND recipient_id = ?", id, recipientID).
		Update("read", true)
	if res.Error != nil {
		return fmt.Errorf("marking notification read: %w", res.Error)
	}
	if res.RowsAffected == 0 {
		return ErrNotFound
	}
	return nil
}

// MarkAllRead marks every unread notification belonging to recipientID as
// read.
func (s *Service) MarkAllRead(ctx context.Context, recipientID uuid.UUID) error {
	if err := s.db.WithContext(ctx).Model(&models.Notification{}).
		Where("recipient_id = ? AND read = false", recipientID).
		Update("read", true).Error; err != nil {
		return fmt.Errorf("marking all notifications read: %w", err)
	}
	return nil
}
