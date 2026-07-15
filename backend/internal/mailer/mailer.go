// Package mailer sends transactional email via the Resend HTTPS API.
package mailer

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

// requestTimeout bounds the whole call to Resend so a network hiccup fails
// fast instead of hanging the caller.
const requestTimeout = 15 * time.Second

// Config holds the Resend API connection details for the mailer.
type Config struct {
	APIKey string
	// From is the display name/address used in the message's From header,
	// e.g. "Submission Approval Workflow <onboarding@resend.dev>". Resend
	// requires this to be either its shared onboarding@resend.dev test
	// sender or an address on a domain verified with Resend.
	From string
}

// Mailer sends a plain-text email. Implementations must be safe for
// concurrent use.
type Mailer interface {
	Send(to, subject, body string) error
}

// ResendMailer sends mail over HTTPS via Resend (https://resend.com)
// instead of raw SMTP. Raw SMTP (ports 25/465/587) is commonly blocked
// outbound on PaaS hosts as an anti-abuse measure — Railway included — so
// email goes out over HTTPS instead, which is never blocked.
type ResendMailer struct {
	cfg    Config
	client *http.Client
}

func New(cfg Config) *ResendMailer {
	return &ResendMailer{cfg: cfg, client: &http.Client{Timeout: requestTimeout}}
}

type resendRequest struct {
	From    string   `json:"from"`
	To      []string `json:"to"`
	Subject string   `json:"subject"`
	Text    string   `json:"text"`
}

func (m *ResendMailer) Send(to, subject, body string) error {
	reqBody, err := json.Marshal(resendRequest{
		From:    m.cfg.From,
		To:      []string{to},
		Subject: subject,
		Text:    body,
	})
	if err != nil {
		return fmt.Errorf("encoding resend request: %w", err)
	}

	req, err := http.NewRequest(http.MethodPost, "https://api.resend.com/emails", bytes.NewReader(reqBody))
	if err != nil {
		return fmt.Errorf("building resend request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+m.cfg.APIKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := m.client.Do(req)
	if err != nil {
		return fmt.Errorf("calling resend: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		respBody, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("resend returned %d: %s", resp.StatusCode, string(respBody))
	}
	return nil
}
