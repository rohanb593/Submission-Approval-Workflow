// Package config loads process configuration from environment variables.
package config

import (
	"fmt"
	"os"
)

type Config struct {
	Port         string
	DatabaseURL  string
	JWTSecret    string
	CORSOrigin   string
	// Enable2FA gates the email-OTP step of login. When false, login()
	// issues a token immediately after the password check instead of
	// creating a challenge and emailing a code; verifyLogin and the rest of
	// the OTP machinery stay in place, unused, for when this flips back on.
	Enable2FA    bool
	SMTPHost     string
	SMTPPort     string
	SMTPUsername string
	SMTPPassword string
	SMTPFrom     string
}

func Load() (Config, error) {
	cfg := Config{
		Port:         getEnv("PORT", "8080"),
		DatabaseURL:  os.Getenv("DATABASE_URL"),
		JWTSecret:    os.Getenv("JWT_SECRET"),
		CORSOrigin:   getEnv("CORS_ORIGIN", "http://localhost:3000"),
		Enable2FA:    getEnv("ENABLE_2FA", "false") == "true",
		SMTPHost:     getEnv("SMTP_HOST", "smtp.gmail.com"),
		SMTPPort:     getEnv("SMTP_PORT", "587"),
		SMTPUsername: os.Getenv("SMTP_USERNAME"),
		SMTPPassword: os.Getenv("SMTP_PASSWORD"),
		SMTPFrom:     os.Getenv("SMTP_FROM"),
	}

	if cfg.DatabaseURL == "" {
		return Config{}, fmt.Errorf("DATABASE_URL is required")
	}
	if cfg.JWTSecret == "" {
		return Config{}, fmt.Errorf("JWT_SECRET is required")
	}
	// SMTP creds are only needed to send the OTP email, so only require them
	// when 2FA is actually enabled.
	if cfg.Enable2FA {
		if cfg.SMTPUsername == "" {
			return Config{}, fmt.Errorf("SMTP_USERNAME is required")
		}
		if cfg.SMTPPassword == "" {
			return Config{}, fmt.Errorf("SMTP_PASSWORD is required")
		}
	}
	if cfg.SMTPFrom == "" {
		cfg.SMTPFrom = cfg.SMTPUsername
	}

	return cfg, nil
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
