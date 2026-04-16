package db

import (
	"database/sql"
	"log"
	"sync"
	"time"

	_ "github.com/lib/pq"
)

var (
	instance *sql.DB
	once     sync.Once
)

// Init opens the database connection and verifies it with a ping.
// Uses sync.Once so the connection is created exactly once.
func Init(dsn string) *sql.DB {
	once.Do(func() {
		var err error

		// Retry loop — PostgreSQL might still be initializing on first boot
		for i := 0; i < 10; i++ {
			instance, err = sql.Open("postgres", dsn)
			if err == nil {
				err = instance.Ping()
			}
			if err == nil {
				break
			}
			log.Printf("DB not ready (attempt %d/10): %v — retrying in 2s", i+1, err)
			time.Sleep(2 * time.Second)
		}

		if err != nil {
			log.Fatalf("Could not connect to database: %v", err)
		}

		instance.SetMaxOpenConns(10)
		instance.SetMaxIdleConns(5)
		log.Println("Database connected")
	})

	return instance
}

// Get returns the singleton database connection.
func Get() *sql.DB {
	return instance
}
