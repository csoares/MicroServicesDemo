package router

import (
	"database/sql"
	"net/http"

	"github.com/demo/auth-service/handlers"
	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

// Setup creates and configures the Gin router.
func Setup(db *sql.DB, jwtSecret string) *gin.Engine {
	r := gin.Default()

	// CORS — allow all origins for classroom simplicity.
	// Note: Nginx reverse-proxy makes CORS unnecessary in production,
	// but this lets students call the service directly during development.
	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"*"},
		AllowMethods:     []string{"GET", "POST", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
		AllowCredentials: false,
	}))

	// Health check — useful for Docker healthchecks and service discovery demos
	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok", "service": "auth-service"})
	})

	auth := r.Group("/auth")
	{
		auth.POST("/register", handlers.Register(db))
		auth.POST("/login", handlers.Login(db, jwtSecret))
		auth.GET("/validate", handlers.Validate(jwtSecret))
	}

	return r
}
