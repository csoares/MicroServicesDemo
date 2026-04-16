package main

import (
	"log"

	"github.com/demo/auth-service/config"
	"github.com/demo/auth-service/db"
	"github.com/demo/auth-service/router"
)

func main() {
	// Load config from environment
	cfg := config.Load()

	// Connect to PostgreSQL
	database := db.Init(cfg.DSN)

	// Build the Gin router
	r := router.Setup(database, cfg.JWTSecret)

	log.Printf("auth-service listening on :%s", cfg.Port)
	if err := r.Run(":" + cfg.Port); err != nil {
		log.Fatalf("Server error: %v", err)
	}
}
