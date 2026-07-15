// Command seed resets the database to exactly three fixed test users (one
// requester, one reviewer, one admin) used to log in and drive the
// workflow. It is destructive: every application, audit log entry, and user
// is deleted before the three are recreated, so re-run it whenever you want
// a clean slate rather than to top up existing data.
package main

import (
	"log"

	"github.com/joho/godotenv"

	"github.com/rohanb2005uk/submission-approval-workflow/backend/internal/auth"
	"github.com/rohanb2005uk/submission-approval-workflow/backend/internal/config"
	"github.com/rohanb2005uk/submission-approval-workflow/backend/internal/db"
	"github.com/rohanb2005uk/submission-approval-workflow/backend/internal/models"
)

const seedPassword = "password123"

func main() {
	if err := godotenv.Load(); err != nil {
		log.Println("no .env file found, relying on process environment")
	}

	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("loading config: %v", err)
	}

	conn, err := db.Connect(cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("connecting to database: %v", err)
	}

	if err := db.AutoMigrate(conn); err != nil {
		log.Fatalf("running automigrate: %v", err)
	}

	for _, table := range []string{"application_audit_log", "applications", "users"} {
		if err := conn.Exec("TRUNCATE TABLE " + table + " CASCADE").Error; err != nil {
			log.Fatalf("truncating %s: %v", table, err)
		}
	}

	seedUsers := []models.User{
		{Email: "requester@example.com", Role: "requester"},
		{Email: "reviewer@example.com", Role: "reviewer"},
		{Email: "admin@example.com", Role: "admin"},
	}

	for _, u := range seedUsers {
		hash, err := auth.HashPassword(seedPassword)
		if err != nil {
			log.Fatalf("hashing password for %s: %v", u.Email, err)
		}
		u.PasswordHash = hash

		if err := conn.Create(&u).Error; err != nil {
			log.Fatalf("seeding user %s: %v", u.Email, err)
		}
		log.Printf("created user: %s (role=%s)", u.Email, u.Role)
	}

	log.Printf("seed complete. test password for all users: %s", seedPassword)
}
