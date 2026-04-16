package models

import (
	"database/sql"
	"errors"
	"time"
)

// User represents a registered user.
type User struct {
	ID           int
	Username     string
	Email        string
	PasswordHash string
	CreatedAt    time.Time
}

// ErrDuplicateEmail is returned when the email is already registered.
var ErrDuplicateEmail = errors.New("email already registered")

// CreateUser inserts a new user and returns the created record.
func CreateUser(db *sql.DB, username, email, passwordHash string) (*User, error) {
	user := &User{}
	err := db.QueryRow(
		`INSERT INTO users (username, email, password_hash)
		 VALUES ($1, $2, $3)
		 RETURNING id, username, email, password_hash, created_at`,
		username, email, passwordHash,
	).Scan(&user.ID, &user.Username, &user.Email, &user.PasswordHash, &user.CreatedAt)

	if err != nil {
		// lib/pq surfaces unique-constraint violations as "pq: duplicate key value…"
		if err.Error() != "" && containsDuplicateKey(err.Error()) {
			return nil, ErrDuplicateEmail
		}
		return nil, err
	}

	return user, nil
}

// FindByEmail looks up a user by email address.
func FindByEmail(db *sql.DB, email string) (*User, error) {
	user := &User{}
	err := db.QueryRow(
		`SELECT id, username, email, password_hash, created_at
		 FROM users WHERE email = $1`,
		email,
	).Scan(&user.ID, &user.Username, &user.Email, &user.PasswordHash, &user.CreatedAt)

	if err == sql.ErrNoRows {
		return nil, nil // not found — caller checks for nil
	}
	return user, err
}

func containsDuplicateKey(msg string) bool {
	// Postgres duplicate key error message contains "duplicate key"
	for i := 0; i+12 < len(msg); i++ {
		if msg[i:i+13] == "duplicate key" {
			return true
		}
	}
	return false
}
