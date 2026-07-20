package main

import (
	"log"
	"net/http"

	"github.com/joho/godotenv"

	"github.com/rohanb2005uk/submission-approval-workflow/backend/internal/config"
	"github.com/rohanb2005uk/submission-approval-workflow/backend/internal/db"
	"github.com/rohanb2005uk/submission-approval-workflow/backend/internal/httpapi"
	"github.com/rohanb2005uk/submission-approval-workflow/backend/internal/mailer"
	"github.com/rohanb2005uk/submission-approval-workflow/backend/internal/queue"
	"github.com/rohanb2005uk/submission-approval-workflow/backend/internal/redis"
)

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
	log.Println("connected to database successfully")

	if err := db.AutoMigrate(conn); err != nil {
		log.Fatalf("running automigrate: %v", err)
	}
	log.Println("schema migrated successfully")

	redisClient, err := redis.Connect(cfg.RedisURL)
	if err != nil {
		log.Fatalf("connecting to redis: %v", err)
	}
	log.Println("connected to redis successfully")

	rabbitConn, rabbitCh, err := queue.Connect(cfg.RabbitMQURL)
	if err != nil {
		log.Fatalf("connecting to rabbitmq: %v", err)
	}
	defer rabbitConn.Close()
	defer rabbitCh.Close()
	log.Println("connected to rabbitmq successfully")
	publisher := queue.NewPublisher(rabbitCh)

	mailSender := mailer.New(mailer.Config{
		APIKey: cfg.ResendAPIKey,
		From:   cfg.EmailFrom,
	})

	router := httpapi.NewRouter(conn, redisClient, publisher, cfg.JWTSecret, cfg.CORSOrigin, mailSender, cfg.Enable2FA, cfg.NotifyEmail)

	log.Printf("listening on :%s", cfg.Port)
	if err := http.ListenAndServe(":"+cfg.Port, router); err != nil {
		log.Fatalf("server error: %v", err)
	}
}
