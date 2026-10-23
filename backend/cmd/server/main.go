package main

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strconv"

	"sentinel/internal/auth"
	"sentinel/internal/database"
	"sentinel/internal/metrics"
	"sentinel/internal/ws"

	"github.com/gin-gonic/gin"
)

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "28475"
	}

	dbPath := os.Getenv("DB_PATH")
	if dbPath == "" {
		dbPath = "./data/sentinel.db"
	}

	staticDir := os.Getenv("STATIC_DIR")
	if staticDir == "" {
		staticDir = "./frontend/dist"
	}

	log.Println("--------------------------------------------------")
	log.Println("🚀 Sentinel - Ubuntu Server Monitor Starting")
	log.Printf("📦 Database: %s", dbPath)
	log.Printf("🌐 Port: %s", port)
	log.Println("--------------------------------------------------")

	// 1. Initialize SQLite Database
	db, err := database.InitDB(dbPath)
	if err != nil {
		log.Fatalf("Fatal: failed to initialize database: %v", err)
	}
	defer db.Close()

	// 2. Initialize Metrics Collector & WebSocket Hub
	collector := metrics.NewCollector()
	hub := ws.NewHub(collector)
	go hub.Run()

	// 3. Initialize Auth Handler
	authHandler := auth.NewHandler(db)

	// Set Gin mode
	if os.Getenv("GIN_MODE") == "release" {
		gin.SetMode(gin.ReleaseMode)
	}

	r := gin.Default()

	// CORS Middleware (for local React Vite dev server)
	r.Use(func(c *gin.Context) {
		origin := c.Request.Header.Get("Origin")
		if origin != "" {
			c.Writer.Header().Set("Access-Control-Allow-Origin", origin)
			c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
			c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, accept, origin, Cache-Control, X-Requested-With")
			c.Writer.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS, GET, PUT, DELETE")
		}

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}

		c.Next()
	})

	// API Routes Group
	api := r.Group("/api")
	{
		// Public Auth routes
		authGroup := api.Group("/auth")
		{
			authGroup.POST("/login", authHandler.LoginLimiterMiddleware(), authHandler.Login)
			authGroup.POST("/logout", authHandler.Logout)
		}

		// Protected Auth routes
		protectedAuth := api.Group("/auth")
		protectedAuth.Use(authHandler.AuthMiddleware())
		{
			protectedAuth.GET("/me", authHandler.Me)
			protectedAuth.POST("/change-password", authHandler.ChangePassword)
		}

		// Protected Metrics REST API
		metricsGroup := api.Group("/metrics")
		metricsGroup.Use(authHandler.AuthMiddleware())
		{
			metricsGroup.GET("/summary", func(c *gin.Context) {
				snapshot, err := hub.GetLatestSnapshot()
				if err != nil {
					c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
					return
				}
				c.JSON(http.StatusOK, snapshot)
			})
		}

		// Protected Process Management (Admin & Operator only)
		processGroup := api.Group("/processes")
		processGroup.Use(authHandler.AuthMiddleware(), authHandler.RequireRole("admin", "operator"))
		{
			processGroup.POST("/:pid/kill", func(c *gin.Context) {
				pidStr := c.Param("pid")
				pid, err := strconv.ParseInt(pidStr, 10, 32)
				if err != nil {
					c.JSON(http.StatusBadRequest, gin.H{"error": "Geçersiz PID"})
					return
				}
				if err := metrics.KillProcess(int32(pid)); err != nil {
					c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
					return
				}
				c.JSON(http.StatusOK, gin.H{"message": fmt.Sprintf("Süreç (PID: %d) başarıyla sonlandırıldı.", pid)})
			})
		}

		// Protected Docker Management (Admin & Operator only)
		dockerGroup := api.Group("/docker")
		dockerGroup.Use(authHandler.AuthMiddleware(), authHandler.RequireRole("admin", "operator"))
		{
			dockerClient := collector.GetDockerClient()

			dockerGroup.POST("/containers/:id/restart", func(c *gin.Context) {
				id := c.Param("id")
				if err := dockerClient.RestartContainer(id); err != nil {
					c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
					return
				}
				c.JSON(http.StatusOK, gin.H{"message": fmt.Sprintf("Konteyner (%s) yeniden başlatıldı.", id)})
			})

			dockerGroup.POST("/containers/:id/stop", func(c *gin.Context) {
				id := c.Param("id")
				if err := dockerClient.StopContainer(id); err != nil {
					c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
					return
				}
				c.JSON(http.StatusOK, gin.H{"message": fmt.Sprintf("Konteyner (%s) durduruldu.", id)})
			})

			dockerGroup.POST("/containers/:id/start", func(c *gin.Context) {
				id := c.Param("id")
				if err := dockerClient.StartContainer(id); err != nil {
					c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
					return
				}
				c.JSON(http.StatusOK, gin.H{"message": fmt.Sprintf("Konteyner (%s) başlatıldı.", id)})
			})
		}

		// Protected User & Role Management (Admin only)
		userGroup := api.Group("/users")
		userGroup.Use(authHandler.AuthMiddleware(), authHandler.RequireRole("admin"))
		{
			userGroup.GET("", authHandler.ListUsers)
			userGroup.POST("", authHandler.CreateUser)
			userGroup.DELETE("/:id", authHandler.DeleteUser)
			userGroup.PUT("/:id/role", authHandler.UpdateRole)
		}
	}

	// WebSocket Route (Protected by AuthMiddleware)
	r.GET("/ws", authHandler.AuthMiddleware(), hub.HandleWebSocket)

	// Serve Static Frontend if build exists
	if stat, err := os.Stat(staticDir); err == nil && stat.IsDir() {
		log.Printf("Serving static frontend files from: %s", staticDir)
		r.Static("/assets", filepath.Join(staticDir, "assets"))
		r.StaticFile("/favicon.ico", filepath.Join(staticDir, "favicon.ico"))
		r.StaticFile("/vite.svg", filepath.Join(staticDir, "vite.svg"))

		r.NoRoute(func(c *gin.Context) {
			// Don't intercept /api routes with 404
			if len(c.Request.URL.Path) >= 4 && c.Request.URL.Path[:4] == "/api" {
				c.JSON(http.StatusNotFound, gin.H{"error": "API route not found"})
				return
			}
			c.File(filepath.Join(staticDir, "index.html"))
		})
	} else {
		log.Printf("Static directory '%s' not found. API mode only. Frontend dev server can connect to /api and /ws.", staticDir)
	}

	// Start HTTP Server
	if err := r.Run(":" + port); err != nil {
		log.Fatalf("Server failed to run: %v", err)
	}
}
