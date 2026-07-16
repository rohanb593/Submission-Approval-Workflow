// Package db manages the GORM connection to Postgres.
package db

import (
	"fmt"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"github.com/rohanb2005uk/submission-approval-workflow/backend/internal/models"
)

// Connect opens a GORM connection to Postgres.
func Connect(databaseURL string) (*gorm.DB, error) {
	db, err := gorm.Open(postgres.Open(databaseURL), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Warn),
	})
	if err != nil {
		return nil, fmt.Errorf("opening gorm connection: %w", err)
	}

	sqlDB, err := db.DB()
	if err != nil {
		return nil, fmt.Errorf("getting underlying sql.DB: %w", err)
	}
	if err := sqlDB.Ping(); err != nil {
		return nil, fmt.Errorf("pinging database: %w", err)
	}

	return db, nil
}

// AutoMigrate reconciles the database schema against the model structs.
//
// GORM's AutoMigrate only creates a named check constraint if one by that
// name doesn't already exist; it won't widen an existing one's definition.
// So when the set of allowed roles changes, drop the old constraint first
// and let AutoMigrate recreate it from the current struct tag. Any rows
// left over from before the requester rename are normalized first so they
// don't violate the constraint being re-added.
func AutoMigrate(db *gorm.DB) error {
	if err := db.Exec(`ALTER TABLE IF EXISTS users DROP CONSTRAINT IF EXISTS chk_users_role`).Error; err != nil {
		return fmt.Errorf("dropping stale role constraint: %w", err)
	}
	normalizeLegacyRole := `
		DO $$
		BEGIN
			IF to_regclass('public.users') IS NOT NULL THEN
				UPDATE users SET role = 'requester' WHERE role = 'applicant';
			END IF;
		END $$;
	`
	if err := db.Exec(normalizeLegacyRole).Error; err != nil {
		return fmt.Errorf("normalizing legacy applicant role: %w", err)
	}
	// two_factor_challenges is no longer migrated - 2FA challenges now live in
	// Redis (see internal/httpapi/auth_handlers.go). The old table is left
	// in place rather than dropped here; it's inert, and dropping a table as
	// a side effect of every deploy's auto-migrate is best done deliberately.
	return db.AutoMigrate(
		&models.User{},
		&models.Application{},
		&models.AuditLogEntry{},
		&models.ActivityLogEntry{},
	)
}
