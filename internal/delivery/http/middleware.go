package http

import (
	"fmt"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

type client struct {
	count    int
	lastSeen time.Time
}

var (
	mu      sync.Mutex
	clients = make(map[string]*client)
)

// Допоміжна функція для отримання ключа
func getJWTSecret() []byte {
	secret := os.Getenv("JWT_SECRET_KEY")
	if secret == "" {
		// Повертаємо дефолтний ключ тільки для локальної розробки, якщо не задано
		return []byte("***REMOVED-JWT-SECRET***")
	}
	return []byte(secret)
}

func AdminMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Доступ заборонено: немає токена"})
			c.Abort()
			return
		}

		parts := strings.Split(authHeader, " ")
		if len(parts) != 2 || parts[0] != "Bearer" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Неправильний формат токена"})
			c.Abort()
			return
		}

		tokenString := parts[1]

		token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, fmt.Errorf("unexpected signing method")
			}
			return getJWTSecret(), nil
		})

		if err != nil || !token.Valid {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Недійсний або прострочений токен"})
			c.Abort()
			return
		}

		claims, ok := token.Claims.(jwt.MapClaims)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Помилка читання даних токена"})
			c.Abort()
			return
		}

		role, ok := claims["role"].(string)
		if !ok || role != "admin" {
			c.JSON(http.StatusForbidden, gin.H{"error": "Доступ заборонено: тільки для адміністраторів"})
			c.Abort()
			return
		}

		c.Next()
	}
}

func (h *Handler) AdminIdentity() gin.HandlerFunc {
	return func(c *gin.Context) {
		userRole, exists := c.Get("userRole")
		if !exists || userRole != "admin" {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "Доступ заборонено: тільки для адміністраторів"})
			return
		}
		c.Next()
	}
}

func AuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Потрібна авторизація"})
			c.Abort()
			return
		}

		parts := strings.Split(authHeader, " ")
		if len(parts) != 2 || parts[0] != "Bearer" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Неправильний формат токена"})
			c.Abort()
			return
		}

		tokenString := parts[1]

		token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
			return getJWTSecret(), nil
		})

		if err != nil || !token.Valid {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Недійсний токен"})
			c.Abort()
			return
		}

		claims, ok := token.Claims.(jwt.MapClaims)
		if ok {
			c.Set("userId", claims["user_id"])
			c.Set("userRole", claims["role"])
		}

		c.Next()
	}
}

func UserOwnershipMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		reqUserID := c.Param("id") // ID з URL (string)
		tokenUserIDVal, exists := c.Get("userId")

		if !exists {
			c.JSON(http.StatusForbidden, gin.H{"error": "Доступ заборонено: немає інформації про користувача"})
			c.Abort()
			return
		}

		// Безпечне перетворення ID з токена у рядок для порівняння
		tokenUserID := fmt.Sprintf("%v", tokenUserIDVal)

		// Якщо користувач не є адміном І його ID не збігається з ID в URL
		if reqUserID != tokenUserID && c.GetString("userRole") != "admin" {
			c.JSON(http.StatusForbidden, gin.H{"error": "Доступ заборонено: ви не можете керувати чужим акаунтом"})
			c.Abort()
			return
		}
		c.Next()
	}
}

func RateLimitAuth() gin.HandlerFunc {
	// Фоновий процес: очищаємо старі IP кожні 2 хвилини, щоб не забивати пам'ять
	go func() {
		for {
			time.Sleep(2 * time.Minute)
			mu.Lock()
			for ip, c := range clients {
				if time.Since(c.lastSeen) > 1*time.Minute {
					delete(clients, ip)
				}
			}
			mu.Unlock()
		}
	}()

	return func(c *gin.Context) {
		ip := c.ClientIP()
		mu.Lock()

		if _, found := clients[ip]; !found {
			// Новий IP
			clients[ip] = &client{count: 1, lastSeen: time.Now()}
		} else {
			cl := clients[ip]
			// Якщо з останнього запиту минуло понад 30 секунд - скидаємо лічильник
			if time.Since(cl.lastSeen) > 30*time.Second {
				cl.count = 0
			}

			cl.lastSeen = time.Now()
			cl.count++

			// Якщо понад 5 запитів
			if cl.count > 5 {
				mu.Unlock()
				c.JSON(http.StatusTooManyRequests, gin.H{"error": "Занадто багато спроб. Зачекайте 30 секунд."})
				c.Abort() // Перериваємо запит
				return
			}
		}
		mu.Unlock()
		c.Next()
	}
}
