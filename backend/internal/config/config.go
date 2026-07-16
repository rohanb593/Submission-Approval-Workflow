// Package config loads process configuration from environment variables.
package config

import (
	"fmt"
	"os"
)

type Config struct {
	Port        string
	DatabaseURL string
	RedisURL    string
	JWTSecret   string
	CORSOrigin  string
	// Enable2FA gates the email-OTP step of login. When false, login()
	// issues a token immediately after the password check instead of
	// creating a challenge and emailing a code; verifyLogin and the rest of
	// the OTP machinery stay in place, unused, for when this flips back on.
	Enable2FA    bool
	ResendAPIKey string
	EmailFrom    string
	// NotifyEmail gates whether a status-change notification also goes out
	// by email (via Resend) in addition to the in-app Notification row,
	// which is always created regardless of this flag.
	NotifyEmail bool
}

func Load() (Config, error) {
	cfg := Config{
		Port:         getEnv("PORT", "8080"),
		DatabaseURL:  os.Getenv("DATABASE_URL"),
		RedisURL:     getEnv("REDIS_URL", "redis://localhost:6379"),
		JWTSecret:    os.Getenv("JWT_SECRET"),
		CORSOrigin:   getEnv("CORS_ORIGIN", "http://localhost:3000"),
		Enable2FA:    getEnv("ENABLE_2FA", "false") == "true",
		ResendAPIKey: os.Getenv("RESEND_API_KEY"),
		EmailFrom:    getEnv("EMAIL_FROM", "Submission Approval Workflow <onboarding@resend.dev>"),
		NotifyEmail:  getEnv("ENABLE_EMAIL_NOTIFICATIONS", "false") == "true",
	}

	if cfg.DatabaseURL == "" {
		return Config{}, fmt.Errorf("DATABASE_URL is required")
	}
	if cfg.JWTSecret == "" {
		return Config{}, fmt.Errorf("JWT_SECRET is required")
	}
	// Only needed to send the OTP/notification emails, so only require it
	// when one of those features is actually enabled.
	if (cfg.Enable2FA || cfg.NotifyEmail) && cfg.ResendAPIKey == "" {
		return Config{}, fmt.Errorf("RESEND_API_KEY is required")
	}

	return cfg, nil
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
