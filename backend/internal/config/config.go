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
}

func Load() (Config, error) {
	cfg := Config{
		Port:        getEnv("PORT", "8080"),
		DatabaseURL: os.Getenv("DATABASE_URL"),
		JWTSecret:   os.Getenv("JWT_SECRET"),
		CORSOrigin:  getEnv("CORS_ORIGIN", "http://localhost:3000"),
	}

	if cfg.DatabaseURL == "" {
		return Config{}, fmt.Errorf("DATABASE_URL is required")
	}
	if cfg.JWTSecret == "" {
		return Config{}, fmt.Errorf("JWT_SECRET is required")
	}

	return cfg, nil
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
