// Package mailer sends transactional email over SMTP.
package mailer

import (
	"fmt"
	"net/smtp"
)

// Config holds the SMTP connection details for the mailer.
type Config struct {
	Host     string
	Port     string
	Username string
	Password string
	// From is the display name/address used in the message's From header,
	// e.g. "Submission Approval Workflow <you@gmail.com>". The envelope
	// sender and AUTH identity are always Username, since Gmail requires
	// the authenticated account and envelope sender to match.
	From string
}

// Mailer sends a plain-text email. Implementations must be safe for
// concurrent use.
type Mailer interface {
	Send(to, subject, body string) error
}

// SMTPMailer sends mail through an SMTP server using STARTTLS, e.g. Gmail's
// smtp.gmail.com:587 with an account App Password.
type SMTPMailer struct {
	cfg Config
}

func New(cfg Config) *SMTPMailer {
	return &SMTPMailer{cfg: cfg}
}

func (m *SMTPMailer) Send(to, subject, body string) error {
	addr := fmt.Sprintf("%s:%s", m.cfg.Host, m.cfg.Port)
	auth := smtp.PlainAuth("", m.cfg.Username, m.cfg.Password, m.cfg.Host)

	msg := fmt.Sprintf(
		"From: %s\r\nTo: %s\r\nSubject: %s\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=\"UTF-8\"\r\n\r\n%s\r\n",
		m.cfg.From, to, subject, body,
	)

	// smtp.SendMail negotiates STARTTLS automatically when the server
	// advertises it (Gmail does on port 587) before issuing AUTH.
	return smtp.SendMail(addr, auth, m.cfg.Username, []string{to}, []byte(msg))
}
