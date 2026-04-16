package handlers

import (
	"net/http"

	"github.com/demo/auth-service/middleware"
	"github.com/gin-gonic/gin"
)

// Validate checks a Bearer JWT and returns the embedded user info.
// This is called by other microservices (e.g. gallery-service) to verify tokens
// without sharing the JWT secret — a simple service-to-service auth pattern.
//
// GET /auth/validate
// Header: Authorization: Bearer <token>
func Validate(jwtSecret string) gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "missing Authorization header"})
			return
		}

		claims, err := middleware.ParseToken(authHeader, jwtSecret)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid or expired token"})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"valid":    true,
			"user_id":  claims.UserID,
			"username": claims.Username,
		})
	}
}
