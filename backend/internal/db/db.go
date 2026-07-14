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
func AutoMigrate(db *gorm.DB) error {
	return db.AutoMigrate(&models.User{}, &models.Application{}, &models.AuditLogEntry{})
}
