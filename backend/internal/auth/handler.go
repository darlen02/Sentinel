package auth

import (
	"net/http"
	"strconv"
	"strings"
	"time"

	"sentinel/internal/database"
	"sentinel/internal/models"

	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
	"golang.org/x/time/rate"
)

type Handler struct {
	db          *database.DB
	rateLimiter *IPRateLimiter
}

func NewHandler(db *database.DB) *Handler {
	// 5 requests per minute, burst of 8
	limiter := NewIPRateLimiter(rate.Every(12*time.Second), 8)
	return &Handler{
		db:          db,
		rateLimiter: limiter,
	}
}

func (h *Handler) LoginLimiterMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		clientIP := c.ClientIP()
		limiter := h.rateLimiter.GetLimiter(clientIP)
		if !limiter.Allow() {
			c.JSON(http.StatusTooManyRequests, gin.H{
				"error": "Çok fazla giriş denemesi yapıldı. Lütfen biraz bekleyin.",
			})
			c.Abort()
			return
		}
		c.Next()
	}
}

func (h *Handler) AuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		tokenStr := ""

		// 1. Check Authorization Bearer header
		authHeader := c.GetHeader("Authorization")
		if strings.HasPrefix(authHeader, "Bearer ") {
			tokenStr = strings.TrimPrefix(authHeader, "Bearer ")
		}

		// 2. Check httpOnly Cookie if header not present
		if tokenStr == "" {
			if cookie, err := c.Cookie("sentinel_token"); err == nil {
				tokenStr = cookie
			}
		}

		// 3. Check Query parameter (useful for WebSocket connection handshake)
		if tokenStr == "" {
			tokenStr = c.Query("token")
		}

		if tokenStr == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Yetkilendirme gerekli. Lütfen giriş yapınız."})
			c.Abort()
			return
		}

		claims, err := ValidateToken(tokenStr)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Geçersiz veya süresi dolmuş oturum."})
			c.Abort()
			return
		}

		c.Set("userID", claims.UserID)
		c.Set("username", claims.Username)
		c.Set("role", claims.Role)
		c.Next()
	}
}

func (h *Handler) Login(c *gin.Context) {
	var req models.LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Kullanıcı adı ve parola zorunludur."})
		return
	}

	user, err := h.db.GetUserByUsername(req.Username)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Kullanıcı adı veya parola hatalı."})
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Kullanıcı adı veya parola hatalı."})
		return
	}

	token, err := GenerateToken(user.ID, user.Username, user.Role)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Token oluşturulamadı."})
		return
	}

	// Update last login
	_ = h.db.UpdateLastLogin(user.ID)

	// Set secure cookie (24 hours)
	c.SetCookie("sentinel_token", token, 86400, "/", "", false, true)

	c.JSON(http.StatusOK, models.LoginResponse{
		Token: token,
		User:  *user,
	})
}

func (h *Handler) Logout(c *gin.Context) {
	c.SetCookie("sentinel_token", "", -1, "/", "", false, true)
	c.JSON(http.StatusOK, gin.H{"message": "Başarıyla çıkış yapıldı."})
}

func (h *Handler) Me(c *gin.Context) {
	userIDVal, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Yetkisiz erişim."})
		return
	}

	userID := userIDVal.(int64)
	user, err := h.db.GetUserByID(userID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Kullanıcı bulunamadı."})
		return
	}

	c.JSON(http.StatusOK, user)
}

func (h *Handler) ChangePassword(c *gin.Context) {
	userIDVal, _ := c.Get("userID")
	userID := userIDVal.(int64)

	var req models.ChangePasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Lütfen geçerli parolalar giriniz (en az 6 karakter)."})
		return
	}

	user, err := h.db.GetUserByID(userID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Kullanıcı bulunamadı."})
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.CurrentPassword)); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Mevcut parolanız hatalı."})
		return
	}

	newHash, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Parola şifrelenemedi."})
		return
	}

	if err := h.db.UpdatePassword(userID, string(newHash)); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Parola güncellenemedi."})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Parolanız başarıyla güncellendi."})
}

func (h *Handler) RequireRole(allowedRoles ...string) gin.HandlerFunc {
	return func(c *gin.Context) {
		roleVal, exists := c.Get("role")
		if !exists {
			c.JSON(http.StatusForbidden, gin.H{"error": "Rol yetkisi doğrulanamadı."})
			c.Abort()
			return
		}

		userRole := roleVal.(string)
		for _, r := range allowedRoles {
			if r == userRole {
				c.Next()
				return
			}
		}

		c.JSON(http.StatusForbidden, gin.H{"error": "Bu işlem için yetkiniz bulunmamaktadır."})
		c.Abort()
	}
}

func (h *Handler) ListUsers(c *gin.Context) {
	users, err := h.db.GetAllUsers()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Kullanıcılar alınamadı."})
		return
	}
	c.JSON(http.StatusOK, users)
}

func (h *Handler) CreateUser(c *gin.Context) {
	var req models.CreateUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Geçerli kullanıcı adı, parola (en az 6 karakter) ve rol (admin/operator/viewer) giriniz."})
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Parola hashlenemedi."})
		return
	}

	user, err := h.db.CreateUser(req.Username, string(hash), req.Role)
	if err != nil {
		if strings.Contains(err.Error(), "UNIQUE") {
			c.JSON(http.StatusConflict, gin.H{"error": "Bu kullanıcı adı zaten mevcut."})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Kullanıcı oluşturulamadı: " + err.Error()})
		return
	}

	c.JSON(http.StatusCreated, user)
}

func (h *Handler) DeleteUser(c *gin.Context) {
	currentUserID := c.GetInt64("userID")
	idStr := c.Param("id")
	targetID, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Geçersiz kullanıcı ID."})
		return
	}

	if currentUserID == targetID {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Kendi hesabınızı silemezsiniz."})
		return
	}

	if err := h.db.DeleteUser(targetID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Kullanıcı silinemedi."})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Kullanıcı başarıyla silindi."})
}

func (h *Handler) UpdateRole(c *gin.Context) {
	idStr := c.Param("id")
	targetID, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Geçersiz kullanıcı ID."})
		return
	}

	var req models.UpdateUserRoleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Geçerli bir rol seçiniz (admin, operator, viewer)."})
		return
	}

	if err := h.db.UpdateUserRole(targetID, req.Role); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Rol güncellenemedi."})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Kullanıcı rolü başarıyla güncellendi."})
}

