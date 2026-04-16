package config

import (
	"fmt"
	"os"
)

// Config holds all environment-driven settings for the auth service.
type Config struct {
	DBHost     string
	DBPort     string
	DBUser     string
	DBPassword string
	DBName     string
	DSN        string // computed from above
	JWTSecret  string
	Port       string
}

// Load reads configuration from environment variables.
func Load() *Config {
	cfg := &Config{
		DBHost:     getEnv("DB_HOST", "localhost"),
		DBPort:     getEnv("DB_PORT", "5432"),
		DBUser:     getEnv("DB_USER", "demo"),
		DBPassword: getEnv("DB_PASSWORD", "demo123"),
		DBName:     getEnv("DB_NAME", "auth_db"),
		JWTSecret:  getEnv("JWT_SECRET", "dev-secret"),
		Port:       getEnv("PORT", "8001"),
	}

	cfg.DSN = fmt.Sprintf(
		"host=%s port=%s user=%s password=%s dbname=%s sslmode=disable",
		cfg.DBHost, cfg.DBPort, cfg.DBUser, cfg.DBPassword, cfg.DBName,
	)

	return cfg
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
