// Package models defines the GORM structs that are the source of truth for
// the database schema. AutoMigrate (called once at startup, see cmd/api)
// reconciles the actual database against these definitions.
package models

import (
	"time"

	"github.com/google/uuid"
)

type User struct {
	ID           uuid.UUID `gorm:"type:uuid;primaryKey;default:gen_random_uuid()"`
	Email        string    `gorm:"not null;uniqueIndex"`
	PasswordHash string    `gorm:"not null"`
	Role         string    `gorm:"not null;check:role IN ('requester','reviewer','admin')"`
	CreatedAt    time.Time
}

type Application struct {
	ID             uuid.UUID `gorm:"type:uuid;primaryKey;default:gen_random_uuid()"`
	OwnerID        uuid.UUID `gorm:"type:uuid;not null;index"`
	Owner          User      `gorm:"foreignKey:OwnerID;references:ID;constraint:OnDelete:RESTRICT"`
	Title          string    `gorm:"not null"`
	Category       string    `gorm:"not null;check:category IN ('travel','equipment','training','other')"`
	Description    string    `gorm:"not null;default:''"`
	Amount         *float64
	AttachmentPath *string
	Status         string `gorm:"not null;default:DRAFT;index;check:status IN ('DRAFT','SUBMITTED','UNDER_REVIEW','APPROVED','REJECTED')"`
	CreatedAt      time.Time
	UpdatedAt      time.Time
}

type AuditLogEntry struct {
	ID            uuid.UUID   `gorm:"type:uuid;primaryKey;default:gen_random_uuid()"`
	ApplicationID uuid.UUID   `gorm:"type:uuid;not null;index"`
	Application   Application `gorm:"foreignKey:ApplicationID;references:ID;constraint:OnDelete:RESTRICT"`
	ActorID       uuid.UUID   `gorm:"type:uuid;not null;index"`
	Actor         User        `gorm:"foreignKey:ActorID;references:ID;constraint:OnDelete:RESTRICT"`
	FromStatus    string      `gorm:"not null"`
	ToStatus      string      `gorm:"not null"`
	Comment       *string
	CreatedAt     time.Time
}

func (AuditLogEntry) TableName() string {
	return "application_audit_log"
}

// ActivityLogEntry records one authenticated HTTP request, for the
// admin-only Activity Audit view. Unlike AuditLogEntry (business-level
// status transitions on an application), this is transport-level: every
// request an authenticated user makes, regardless of what it touches.
type ActivityLogEntry struct {
	ID            uuid.UUID `gorm:"type:uuid;primaryKey;default:gen_random_uuid()"`
	ActorID       uuid.UUID `gorm:"type:uuid;not null;index"`
	Actor         User      `gorm:"foreignKey:ActorID;references:ID;constraint:OnDelete:RESTRICT"`
	Method        string    `gorm:"not null"`
	Path          string    `gorm:"not null"`
	StatusCode    int       `gorm:"not null"`
	DurationMs    int64     `gorm:"not null"`
	Browser       string
	IPAddress     string
	UserAgent     string
	Referer       string
	ContentLength int64
	CreatedAt     time.Time `gorm:"index"`
}

func (ActivityLogEntry) TableName() string {
	return "activity_log"
}

// SessionLogEntry records one login or logout event, for the admin-only
// Session Audit view. UserID/Role are nullable/blank because a failed login
// (unknown email or wrong password) never resolves to a real account, and
// even when it does, the email/role are captured as they were at the time
// rather than joined live - so a later role change or account deletion
// doesn't rewrite history.
type SessionLogEntry struct {
	ID        uuid.UUID  `gorm:"type:uuid;primaryKey;default:gen_random_uuid()"`
	UserID    *uuid.UUID `gorm:"type:uuid;index"`
	Email     string     `gorm:"not null"`
	Role      string
	Event     string `gorm:"not null;check:event IN ('login','logout')"`
	Success   bool   `gorm:"not null"`
	Browser   string
	IPAddress string
	UserAgent string
	CreatedAt time.Time `gorm:"index"`
}

func (SessionLogEntry) TableName() string {
	return "session_log"
}

// SystemAuditLogEntry records an administrative action (user/role
// management), for the admin-only System Audit view. ResourceLabel is
// denormalized (the affected email at the time) for the same reason as
// SessionLogEntry.Email - it must survive the resource being deleted later.
type SystemAuditLogEntry struct {
	ID            uuid.UUID `gorm:"type:uuid;primaryKey;default:gen_random_uuid()"`
	ActorID       uuid.UUID `gorm:"type:uuid;not null;index"`
	Actor         User      `gorm:"foreignKey:ActorID;references:ID;constraint:OnDelete:RESTRICT"`
	Event         string    `gorm:"not null"`
	ResourceType  string    `gorm:"not null"`
	ResourceLabel string    `gorm:"not null"`
	CreatedAt     time.Time `gorm:"index"`
}

func (SystemAuditLogEntry) TableName() string {
	return "system_audit_log"
}

// Notification is an in-app notification delivered to one user, created
// whenever an application they care about changes status: the owner is
// notified of a decision on their submission, and reviewers/admins are
// notified when a new application needs review.
type Notification struct {
	ID            uuid.UUID   `gorm:"type:uuid;primaryKey;default:gen_random_uuid()"`
	RecipientID   uuid.UUID   `gorm:"type:uuid;not null;index"`
	Recipient     User        `gorm:"foreignKey:RecipientID;references:ID;constraint:OnDelete:RESTRICT"`
	ApplicationID uuid.UUID   `gorm:"type:uuid;not null;index"`
	Application   Application `gorm:"foreignKey:ApplicationID;references:ID;constraint:OnDelete:RESTRICT"`
	Message       string      `gorm:"not null"`
	Read          bool        `gorm:"not null;default:false;index"`
	CreatedAt     time.Time   `gorm:"index"`
}

func (Notification) TableName() string {
	return "notifications"
}
