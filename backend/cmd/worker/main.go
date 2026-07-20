// Command worker consumes notification-email jobs published to RabbitMQ by
// the API process and sends them via the configured mailer. It runs as a
// separate long-lived process from cmd/api, so a slow or failing mail
// provider never blocks an approval/rejection request.
package main

import (
	"context"
	"encoding/json"
	"log"
	"time"

	"github.com/joho/godotenv"

	"github.com/rohanb2005uk/submission-approval-workflow/backend/internal/config"
	"github.com/rohanb2005uk/submission-approval-workflow/backend/internal/mailer"
	"github.com/rohanb2005uk/submission-approval-workflow/backend/internal/queue"
)

func main() {
	if err := godotenv.Load(); err != nil {
		log.Println("no .env file found, relying on process environment")
	}

	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("loading config: %v", err)
	}

	conn, ch, err := queue.Connect(cfg.RabbitMQURL)
	if err != nil {
		log.Fatalf("connecting to rabbitmq: %v", err)
	}
	defer conn.Close()
	defer ch.Close()
	log.Println("connected to rabbitmq successfully")

	mailSender := mailer.New(mailer.Config{
		APIKey: cfg.ResendAPIKey,
		From:   cfg.EmailFrom,
	})

	publisher := queue.NewPublisher(ch)

	deliveries, err := queue.Consume(ch)
	if err != nil {
		log.Fatalf("consuming notification email queue: %v", err)
	}

	log.Printf("worker started, waiting for jobs on %q", queue.NotificationEmailQueue)
	for d := range deliveries {
		var msg queue.NotificationEmail
		if err := json.Unmarshal(d.Body, &msg); err != nil {
			log.Printf("discarding malformed notification email job: %v", err)
			// Malformed payloads can never succeed - ack (not nack) so they
			// don't loop forever between the queue and this worker.
			d.Ack(false)
			continue
		}

		if err := mailSender.Send(msg.To, msg.Subject, msg.Body); err != nil {
			attempt := queue.DeliveryAttempt(d) + 1
			log.Printf("sending notification email to %s (attempt %d): %v", msg.To, attempt, err)
			// Ack the original delivery and republish ourselves (rather
			// than Nack-requeue) so we control the retry count via
			// attemptHeader: a permanently failing address - e.g. Resend
			// rejecting the recipient - gets capped at maxDeliveryAttempts
			// instead of looping against the mail provider forever.
			d.Ack(false)
			// Linear backoff (1s, 2s, 3s, ...) so a permanent failure
			// doesn't fire all maxDeliveryAttempts retries back-to-back.
			time.Sleep(time.Duration(attempt) * time.Second)
			landedOn, pubErr := publisher.RetryNotificationEmail(context.Background(), msg, attempt)
			if pubErr != nil {
				log.Printf("re-publishing notification email for %s: %v", msg.To, pubErr)
				continue
			}
			if landedOn == queue.NotificationEmailFailedQueue {
				log.Printf("giving up on notification email to %s after %d attempts, moved to %q", msg.To, attempt, landedOn)
			}
			continue
		}

		log.Printf("sent notification email to %s", msg.To)
		d.Ack(false)
	}
}
