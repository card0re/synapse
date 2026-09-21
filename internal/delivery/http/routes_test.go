package http

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

// Перевіряємо справжню таблицю маршрутів, а не окремий middleware: саме тут
// колись загубилась перевірка власника на /users/profile/:userId і на угодах.
// userUC = nil безпечний — якщо тест доходить до самої ручки, він падає з
// паніки, і це теж сигнал, що маршрут не охороняється.
func TestOwnedRoutesRejectOtherUsers(t *testing.T) {
	t.Setenv("JWT_SECRET_KEY", testSecret)

	token := sign(t, jwt.SigningMethodHS256, []byte(testSecret), jwt.MapClaims{
		"user_id": "11111111-1111-1111-1111-111111111111",
		"role":    "user",
		"exp":     time.Now().Add(time.Hour).Unix(),
	})
	const victim = "22222222-2222-2222-2222-222222222222"

	owned := []struct{ method, path string }{
		{http.MethodGet, "/api/users/" + victim + "/chats"},
		{http.MethodGet, "/api/users/" + victim + "/chat-preferences"},
		{http.MethodPut, "/api/users/" + victim + "/fullname"},
		{http.MethodPost, "/api/users/" + victim + "/telegram-link"},
		{http.MethodGet, "/api/users/profile/" + victim},
		{http.MethodPut, "/api/users/profile/" + victim},
		{http.MethodGet, "/api/deals/incoming/" + victim},
		{http.MethodGet, "/api/deals/outgoing/" + victim},
	}

	router := gin.New()
	NewHandler(nil).InitRoutes(router)

	for _, r := range owned {
		t.Run(r.method+" "+r.path, func(t *testing.T) {
			req := httptest.NewRequest(r.method, r.path, strings.NewReader("{}"))
			req.Header.Set("Authorization", "Bearer "+token)
			req.Header.Set("Content-Type", "application/json")

			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			if w.Code != http.StatusForbidden {
				t.Errorf("чужий акаунт віддав %d, а мав 403 — маршрут без перевірки власника", w.Code)
			}
		})
	}
}

// Адмінські ручки не повинні відкриватись звичайному користувачу.
func TestAdminRoutesRejectPlainUser(t *testing.T) {
	t.Setenv("JWT_SECRET_KEY", testSecret)

	token := sign(t, jwt.SigningMethodHS256, []byte(testSecret), jwt.MapClaims{
		"user_id": "11111111-1111-1111-1111-111111111111",
		"role":    "user",
		"exp":     time.Now().Add(time.Hour).Unix(),
	})

	router := gin.New()
	NewHandler(nil).InitRoutes(router)

	for _, path := range []string{"/api/admin/stats", "/api/admin/deals", "/api/admin/reports"} {
		t.Run(path, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, path, nil)
			req.Header.Set("Authorization", "Bearer "+token)
			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)
			if w.Code != http.StatusForbidden {
				t.Errorf("роль user отримала %d на %s, а мала 403", w.Code, path)
			}
		})
	}
}
