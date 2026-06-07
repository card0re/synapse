package http

import (
	"context"
	"fmt"
	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/gorilla/websocket"
	"net/http"
	"os"
	"skillswap-irpin/internal/domain"
	"sync"
	"time"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
}

type ChatManager struct {
	clients map[string]map[*websocket.Conn]bool
	mu      sync.Mutex
}

var manager = ChatManager{
	clients: make(map[string]map[*websocket.Conn]bool),
}

var rateLimiter = struct {
	sync.Mutex
	lastMessage map[string]time.Time
}{lastMessage: make(map[string]time.Time)}

func (h *Handler) WebSocketChat(c *gin.Context) {
	tokenString := c.Query("token")
	if tokenString == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Токен не надано"})
		return
	}

	token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method")
		}
		secret := os.Getenv("JWT_SECRET_KEY")
		return []byte(secret), nil
	})

	if err != nil || !token.Valid {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Недійсний токен"})
		return
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Помилка читання токена"})
		return
	}

	userID, ok := claims["user_id"].(string)
	if !ok || userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Невалідний ID користувача"})
		return
	}

	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		return
	}
	defer conn.Close()

	manager.mu.Lock()
	if manager.clients[userID] == nil {
		manager.clients[userID] = make(map[*websocket.Conn]bool)
	}
	manager.clients[userID][conn] = true
	manager.mu.Unlock()

	defer func() {
		manager.mu.Lock()
		delete(manager.clients[userID], conn)
		if len(manager.clients[userID]) == 0 {
			delete(manager.clients, userID)

			rateLimiter.Lock()
			delete(rateLimiter.lastMessage, userID)
			rateLimiter.Unlock()
		}
		manager.mu.Unlock()
	}()

	for {
		var incoming map[string]interface{}
		if err := conn.ReadJSON(&incoming); err != nil {
			break
		}

		action, _ := incoming["action"].(string)
		if action == "" {
			action = "send"
		}

		if action == "send" {
			receiverID, _ := incoming["receiver_id"].(string)

			if h.userUC.IsBlockedBy(context.Background(), userID, receiverID) {
				conn.WriteJSON(map[string]interface{}{"type": "error", "text": "🚫 Неможливо надіслати. Користувач вас заблокував."})
				continue
			}
			if h.userUC.IsBlockedBy(context.Background(), receiverID, userID) {
				conn.WriteJSON(map[string]interface{}{"type": "error", "text": "🚫 Ви заблокували цього користувача. Розблокуйте, щоб писати."})
				continue
			}

			rateLimiter.Lock()
			lastTime := rateLimiter.lastMessage[userID]
			if time.Since(lastTime) < time.Second {
				rateLimiter.Unlock()
				conn.WriteJSON(map[string]interface{}{"type": "error", "text": "⏳ Зачекайте 1 секунду..."})
				continue
			}
			rateLimiter.lastMessage[userID] = time.Now()
			rateLimiter.Unlock()

			text, _ := incoming["text"].(string)
			var replyToID *int64
			var replyToText *string

			if val, ok := incoming["reply_to_id"].(float64); ok && val > 0 {
				id := int64(val)
				replyToID = &id
			}
			if val, ok := incoming["reply_to_text"].(string); ok && val != "" {
				replyToText = &val
			}

			dbMsg := domain.Message{
				SenderID:    userID,
				ReceiverID:  receiverID,
				Text:        text,
				IsRead:      false,
				ReplyToID:   replyToID,
				ReplyToText: replyToText,
			}
			go h.userUC.SaveMessage(context.Background(), dbMsg)

			tempID := time.Now().UnixMilli()
			response := map[string]interface{}{
				"type": "new_message", "id": tempID, "sender_id": userID, "receiver_id": receiverID,
				"text": text, "created_at": time.Now(), "is_read": false, "reaction": "",
				"reply_to_id": replyToID, "reply_to_text": replyToText,
			}
			broadcastToUser(receiverID, response)
			broadcastToUser(userID, response)

		} else if action == "edit" {
			msgID, _ := incoming["id"].(float64)
			newText, _ := incoming["text"].(string)
			receiverID, _ := incoming["receiver_id"].(string)

			response := map[string]interface{}{"type": "edit_message", "id": msgID, "text": newText}
			broadcastToUser(receiverID, response)
			broadcastToUser(userID, response)

		} else if action == "reaction" {
			msgID, _ := incoming["id"].(float64)
			receiverID, _ := incoming["receiver_id"].(string)
			reaction, _ := incoming["reaction"].(string)

			response := map[string]interface{}{"type": "reaction_message", "id": msgID, "reaction": reaction}
			broadcastToUser(receiverID, response)
			broadcastToUser(userID, response)

		} else if action == "typing" {
			receiverID, _ := incoming["receiver_id"].(string)

			response := map[string]interface{}{"type": "typing", "sender_id": userID}
			broadcastToUser(receiverID, response)
		}
	}
}

func broadcastToUser(userID string, payload interface{}) {
	manager.mu.Lock()
	defer manager.mu.Unlock()
	for clientConn := range manager.clients[userID] {
		clientConn.WriteJSON(payload)
	}
}
