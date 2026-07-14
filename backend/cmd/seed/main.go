// Command seed creates the fixed test users (one applicant, one reviewer)
// used to log in and drive the workflow. Safe to run multiple times: it
// looks up each user by email first and only creates it if missing.
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

	seedUsers := []models.User{
		{Email: "applicant@example.com", Role: "applicant"},
		{Email: "reviewer@example.com", Role: "reviewer"},
	}

	for _, u := range seedUsers {
		hash, err := auth.HashPassword(seedPassword)
		if err != nil {
			log.Fatalf("hashing password for %s: %v", u.Email, err)
		}
		u.PasswordHash = hash

		result := conn.Where(models.User{Email: u.Email}).FirstOrCreate(&u)
		if result.Error != nil {
			log.Fatalf("seeding user %s: %v", u.Email, result.Error)
		}

		if result.RowsAffected > 0 {
			log.Printf("created user: %s (role=%s)", u.Email, u.Role)
		} else {
			log.Printf("user already exists, skipped: %s", u.Email)
		}
	}

	log.Printf("seed complete. test password for both users: %s", seedPassword)
}
