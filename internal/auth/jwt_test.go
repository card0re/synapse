package auth

import (
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

func TestGenerateTokenRoundTrip(t *testing.T) {
	const secret = "test-secret-not-used-anywhere-real"
	t.Setenv("JWT_SECRET_KEY", secret)

	tokenString, err := GenerateToken("u-1", "admin")
	if err != nil {
		t.Fatal(err)
	}

	tok, err := jwt.Parse(tokenString, func(*jwt.Token) (any, error) { return []byte(secret), nil })
	if err != nil || !tok.Valid {
		t.Fatalf("щойно згенерований токен не парситься: %v", err)
	}

	claims := tok.Claims.(jwt.MapClaims)
	if claims["user_id"] != "u-1" || claims["role"] != "admin" {
		t.Errorf("claims поїхали: %v", claims)
	}
	if exp, _ := claims.GetExpirationTime(); exp == nil || time.Until(exp.Time) <= 0 {
		t.Error("токен без терміну дії або вже прострочений")
	}
	if tok.Method.Alg() != jwt.SigningMethodHS256.Alg() {
		t.Errorf("підписано %s, а перевірка на боці middleware чекає HMAC", tok.Method.Alg())
	}
}

// Без секрету краще впасти, ніж підписати токен порожнім ключем:
// саме хардкодний дефолт колись дозволяв підробити адмінський токен.
func TestGenerateTokenFailsWithoutSecret(t *testing.T) {
	t.Setenv("JWT_SECRET_KEY", "")
	if _, err := GenerateToken("u-1", "user"); err == nil {
		t.Fatal("токен згенерувався без JWT_SECRET_KEY")
	}
}
