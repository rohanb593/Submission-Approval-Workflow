// Package config loads process configuration from environment variables.
package config

import (
	"fmt"
	"os"
)

type Config struct {
	Port        string
	DatabaseURL string
	JWTSecret   string
	CORSOrigin  string
	// Enable2FA gates the email-OTP step of login. When false, login()
	// issues a token immediately after the password check instead of
	// creating a challenge and emailing a code; verifyLogin and the rest of
	// the OTP machinery stay in place, unused, for when this flips back on.
	Enable2FA    bool
	ResendAPIKey string
	EmailFrom    string
}

func Load() (Config, error) {
	cfg := Config{
		Port:         getEnv("PORT", "8080"),
		DatabaseURL:  os.Getenv("DATABASE_URL"),
		JWTSecret:    os.Getenv("JWT_SECRET"),
		CORSOrigin:   getEnv("CORS_ORIGIN", "http://localhost:3000"),
		Enable2FA:    getEnv("ENABLE_2FA", "false") == "true",
		ResendAPIKey: os.Getenv("RESEND_API_KEY"),
		EmailFrom:    getEnv("EMAIL_FROM", "Submission Approval Workflow <onboarding@resend.dev>"),
	}

	if cfg.DatabaseURL == "" {
		return Config{}, fmt.Errorf("DATABASE_URL is required")
	}
	if cfg.JWTSecret == "" {
		return Config{}, fmt.Errorf("JWT_SECRET is required")
	}
	// Only needed to send the OTP email, so only require it when 2FA is
	// actually enabled.
	if cfg.Enable2FA && cfg.ResendAPIKey == "" {
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
