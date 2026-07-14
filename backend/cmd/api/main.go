package main

import (
	"context"
	"log"

	"github.com/joho/godotenv"

	"github.com/rohanb2005uk/submission-approval-workflow/backend/internal/config"
	"github.com/rohanb2005uk/submission-approval-workflow/backend/internal/db"
)

func main() {
	if err := godotenv.Load(); err != nil {
		log.Println("no .env file found, relying on process environment")
	}

	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("loading config: %v", err)
	}

	ctx := context.Background()
	pool, err := db.NewPool(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("connecting to database: %v", err)
	}
	defer pool.Close()

	log.Println("connected to database successfully")

	// The chi router / HTTP server is added in Day 2 once the API endpoints exist.
}
