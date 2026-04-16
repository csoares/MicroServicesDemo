package handlers

import (
	"database/sql"
	"errors"
	"net/http"

	"github.com/demo/auth-service/models"
	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
)

type registerRequest struct {
	Username string `json:"username" binding:"required"`
	Email    string `json:"email"    binding:"required"`
	Password string `json:"password" binding:"required,min=6"`
}

// Register creates a new user account.
// POST /auth/register
func Register(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req registerRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		// Hash password with bcrypt (cost=12 — slow enough to be secure, fast enough for a demo)
		hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), 12)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to hash password"})
			return
		}

		user, err := models.CreateUser(db, req.Username, req.Email, string(hash))
		if err != nil {
			if errors.Is(err, models.ErrDuplicateEmail) {
				c.JSON(http.StatusConflict, gin.H{"error": "email already registered"})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": "could not create user"})
			return
		}

		c.JSON(http.StatusCreated, gin.H{
			"message":  "user created",
			"user_id":  user.ID,
			"username": user.Username,
		})
	}
}
