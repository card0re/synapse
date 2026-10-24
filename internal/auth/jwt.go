package auth

import (
	"errors"
	"os"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// GenerateToken. Роль не приходить аргументом і не читається з колонки
// users.role — вона виводиться з підтвердженої пошти (див. EffectiveRole), щоб
// існувало рівно одне місце, яке вирішує, хто адмін. verifiedEmail передає
// лише Google-вхід; решта шляхів передає порожній рядок.
//
// Пошта кладеться в токен тільки для адміна: за нею перевірка впізнає, що
// токен видано вже за новим правилом. Старі токени, видані за колонкою role,
// цього клейма не мають і адмінських прав не дають, не чекаючи свого строку.
func GenerateToken(userID string, verifiedEmail string) (string, error) {
	secret := os.Getenv("JWT_SECRET_KEY")
	if secret == "" {
		return "", errors.New("JWT_SECRET_KEY не задан в .env")
	}

	claims := jwt.MapClaims{
		"user_id": userID,
		"role":    EffectiveRole(verifiedEmail),
		"exp":     time.Now().Add(time.Hour * 72).Unix(),
	}
	if IsAdminEmail(verifiedEmail) {
		claims["email"] = strings.TrimSpace(verifiedEmail)
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(secret))
}
