// Package queue manages the connection to RabbitMQ and the jobs published
// there. Today that's just outbound notification emails, so an
// approve/reject/return request doesn't have to wait on the mail provider
// before it can respond.
package queue

import (
	"context"
	"encoding/json"
	"fmt"

	amqp "github.com/rabbitmq/amqp091-go"
)

// NotificationEmailQueue is the durable queue notification emails are
// published to and consumed from. Must match between Publisher and any
// consumer.
const NotificationEmailQueue = "notification_emails"

// NotificationEmailFailedQueue collects notification emails that failed to
// send maxDeliveryAttempts times in a row - e.g. Resend permanently
// rejecting the recipient. Messages land here instead of being retried
// forever, so a bad address can't turn into an infinite hot loop against
// the mail provider.
const NotificationEmailFailedQueue = "notification_emails_failed"

// maxDeliveryAttempts bounds how many times the worker will retry sending a
// single notification email before giving up and dead-lettering it.
const maxDeliveryAttempts = 5

// attemptHeader is the AMQP message header used to track how many times a
// notification email has been attempted, across requeues.
const attemptHeader = "x-attempt"

// Connect opens a connection and channel to RabbitMQ and declares the
// queues this service uses.
func Connect(url string) (*amqp.Connection, *amqp.Channel, error) {
	conn, err := amqp.Dial(url)
	if err != nil {
		return nil, nil, fmt.Errorf("dialing rabbitmq: %w", err)
	}

	ch, err := conn.Channel()
	if err != nil {
		conn.Close()
		return nil, nil, fmt.Errorf("opening channel: %w", err)
	}

	for _, name := range []string{NotificationEmailQueue, NotificationEmailFailedQueue} {
		if _, err := ch.QueueDeclare(
			name,
			true,  // durable: survives a broker restart
			false, // auto-delete
			false, // exclusive
			false, // no-wait
			nil,
		); err != nil {
			ch.Close()
			conn.Close()
			return nil, nil, fmt.Errorf("declaring queue %s: %w", name, err)
		}
	}

	return conn, ch, nil
}

// NotificationEmail is the payload published for each outbound
// notification email.
type NotificationEmail struct {
	To      string `json:"to"`
	Subject string `json:"subject"`
	Body    string `json:"body"`
}

// Consume subscribes to the notification email queue and returns a channel
// of deliveries. Each amqp.Delivery must be Ack'd (on success or once
// handed off elsewhere, e.g. dead-lettered) or Nack'd (on a transport-level
// failure) by the caller - see cmd/worker for how retries are driven off
// attemptHeader instead of AMQP-level requeueing, so a permanently failing
// message doesn't retry forever.
func Consume(ch *amqp.Channel) (<-chan amqp.Delivery, error) {
	// prefetch of 1: don't hand this worker a second email job until it has
	// acked the first, so a slow Resend call doesn't let a backlog build up
	// unseen on one worker while others sit idle.
	if err := ch.Qos(1, 0, false); err != nil {
		return nil, fmt.Errorf("setting qos: %w", err)
	}
	deliveries, err := ch.Consume(
		NotificationEmailQueue,
		"",    // consumer tag: auto-generated
		false, // auto-ack: false, we ack explicitly after sending
		false, // exclusive
		false, // no-local (unused by RabbitMQ)
		false, // no-wait
		nil,
	)
	if err != nil {
		return nil, fmt.Errorf("consuming queue %s: %w", NotificationEmailQueue, err)
	}
	return deliveries, nil
}

// Publisher publishes jobs onto RabbitMQ queues.
type Publisher struct {
	ch *amqp.Channel
}

func NewPublisher(ch *amqp.Channel) *Publisher {
	return &Publisher{ch: ch}
}

// PublishNotificationEmail enqueues an email to be sent asynchronously by
// the worker process. Delivery is persistent, so a message survives a
// broker restart between being published and being consumed.
func (p *Publisher) PublishNotificationEmail(ctx context.Context, msg NotificationEmail) error {
	return p.publish(ctx, NotificationEmailQueue, msg, 0)
}

// RetryNotificationEmail re-publishes msg after a failed delivery attempt.
// attempt is the number of attempts made so far (including the one that
// just failed); once it reaches maxDeliveryAttempts the message goes to
// NotificationEmailFailedQueue instead of back onto the main queue.
// Reports which queue it ended up on, for logging.
func (p *Publisher) RetryNotificationEmail(ctx context.Context, msg NotificationEmail, attempt int) (queue string, err error) {
	if attempt >= maxDeliveryAttempts {
		return NotificationEmailFailedQueue, p.publish(ctx, NotificationEmailFailedQueue, msg, attempt)
	}
	return NotificationEmailQueue, p.publish(ctx, NotificationEmailQueue, msg, attempt)
}

func (p *Publisher) publish(ctx context.Context, queueName string, msg NotificationEmail, attempt int) error {
	body, err := json.Marshal(msg)
	if err != nil {
		return fmt.Errorf("marshaling notification email: %w", err)
	}
	return p.ch.PublishWithContext(ctx,
		"",        // default exchange
		queueName, // routing key = queue name on the default exchange
		false,     // mandatory
		false,     // immediate
		amqp.Publishing{
			ContentType:  "application/json",
			DeliveryMode: amqp.Persistent,
			Headers:      amqp.Table{attemptHeader: int32(attempt)},
			Body:         body,
		},
	)
}

// DeliveryAttempt reads how many times this message has already been
// attempted, from attemptHeader. Missing/malformed headers count as the
// first attempt (0 prior attempts).
func DeliveryAttempt(d amqp.Delivery) int {
	v, ok := d.Headers[attemptHeader]
	if !ok {
		return 0
	}
	n, ok := v.(int32)
	if !ok {
		return 0
	}
	return int(n)
}
