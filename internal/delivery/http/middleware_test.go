package http

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

const testSecret = "test-secret-not-used-anywhere-real"

func init() { gin.SetMode(gin.TestMode) }

func sign(t *testing.T, method jwt.SigningMethod, key any, claims jwt.MapClaims) string {
	t.Helper()
	s, err := jwt.NewWithClaims(method, claims).SignedString(key)
	if err != nil {
		t.Fatal(err)
	}
	return s
}

// Три маршрути називають параметр з ID по-різному (:id, :userId, :user_id).
// Поки перевірка була прибита до "id", половина з них лишалась без охорони —
// будь-який залогінений користувач редагував чужий профіль.
func TestUserOwnershipMiddleware(t *testing.T) {
	cases := []struct {
		name       string
		param      string
		route      string
		requestURL string
		tokenUser  string
		role       string
		want       int
	}{
		{"власник проходить", "id", "/users/:id", "/users/u-1", "u-1", "user", http.StatusOK},
		{"чужий акаунт — 403", "id", "/users/:id", "/users/u-2", "u-1", "user", http.StatusForbidden},
		{"адмін проходить скрізь", "id", "/users/:id", "/users/u-2", "u-1", "admin", http.StatusOK},
		{"параметр :userId теж охороняється", "userId", "/users/profile/:userId", "/users/profile/u-2", "u-1", "user", http.StatusForbidden},
		{"параметр :user_id теж охороняється", "user_id", "/deals/incoming/:user_id", "/deals/incoming/u-2", "u-1", "user", http.StatusForbidden},
		{"невідомий параметр не відкриває доступ", "nope", "/users/:id", "/users/u-1", "u-1", "user", http.StatusForbidden},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			r := gin.New()
			r.GET(tc.route, func(c *gin.Context) {
				c.Set("userId", tc.tokenUser)
				c.Set("userRole", tc.role)
				c.Next()
			}, UserOwnershipMiddleware(tc.param), func(c *gin.Context) {
				c.Status(http.StatusOK)
			})

			w := httptest.NewRecorder()
			r.ServeHTTP(w, httptest.NewRequest(http.MethodGet, tc.requestURL, nil))
			if w.Code != tc.want {
				t.Errorf("отримано %d, очікувалось %d", w.Code, tc.want)
			}
		})
	}
}

// Алгоритмічна плутанина: якщо не звіряти метод підпису, токен, підписаний
// "none" або іншим алгоритмом, приймається як валідний.
func TestAuthMiddlewareRejectsBadTokens(t *testing.T) {
	t.Setenv("JWT_SECRET_KEY", testSecret)
	valid := jwt.MapClaims{"user_id": "u-1", "role": "user", "exp": time.Now().Add(time.Hour).Unix()}

	cases := []struct {
		name   string
		header string
		want   int
	}{
		{"валідний HS256", "Bearer " + sign(t, jwt.SigningMethodHS256, []byte(testSecret), valid), http.StatusOK},
		{"без заголовка", "", http.StatusUnauthorized},
		{"не Bearer", "Token abc", http.StatusUnauthorized},
		{"чужий секрет", "Bearer " + sign(t, jwt.SigningMethodHS256, []byte("wrong"), valid), http.StatusUnauthorized},
		{"alg=none", "Bearer " + sign(t, jwt.SigningMethodNone, jwt.UnsafeAllowNoneSignatureType, valid), http.StatusUnauthorized},
		{"прострочений", "Bearer " + sign(t, jwt.SigningMethodHS256, []byte(testSecret),
			jwt.MapClaims{"user_id": "u-1", "exp": time.Now().Add(-time.Hour).Unix()}), http.StatusUnauthorized},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			r := gin.New()
			r.GET("/x", AuthMiddleware(), func(c *gin.Context) { c.Status(http.StatusOK) })

			req := httptest.NewRequest(http.MethodGet, "/x", nil)
			if tc.header != "" {
				req.Header.Set("Authorization", tc.header)
			}
			w := httptest.NewRecorder()
			r.ServeHTTP(w, req)
			if w.Code != tc.want {
				t.Errorf("отримано %d, очікувалось %d", w.Code, tc.want)
			}
		})
	}
}

// AdminMiddleware — друга, незалежна перевірка ролі перед адмінськими ручками.
func TestAdminMiddlewareRequiresAdminRole(t *testing.T) {
	t.Setenv("JWT_SECRET_KEY", testSecret)
	exp := time.Now().Add(time.Hour).Unix()

	for _, tc := range []struct {
		role string
		want int
	}{{"admin", http.StatusOK}, {"user", http.StatusForbidden}} {
		t.Run(tc.role, func(t *testing.T) {
			tok := sign(t, jwt.SigningMethodHS256, []byte(testSecret),
				jwt.MapClaims{"user_id": "u-1", "role": tc.role, "exp": exp})

			r := gin.New()
			r.GET("/a", AdminMiddleware(), func(c *gin.Context) { c.Status(http.StatusOK) })
			req := httptest.NewRequest(http.MethodGet, "/a", nil)
			req.Header.Set("Authorization", "Bearer "+tok)
			w := httptest.NewRecorder()
			r.ServeHTTP(w, req)
			if w.Code != tc.want {
				t.Errorf("роль %s: отримано %d, очікувалось %d", tc.role, w.Code, tc.want)
			}
		})
	}
}

// Зайва кома в CORS_ORIGINS давала порожній origin, на якому gin-contrib/cors
// панікує при старті й забирає з собою весь сервіс.
func TestAllowedOriginsIgnoresBlanks(t *testing.T) {
	t.Setenv("CORS_ORIGINS", " https://preview.example , , https://staging.example ,")

	got := AllowedOrigins()
	want := []string{
		"https://synapse.tel",
		"https://www.synapse.tel",
		"https://preview.example",
		"https://staging.example",
	}

	if len(got) != len(want) {
		t.Fatalf("отримано %v, очікувалось %v", got, want)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Errorf("origin %d: %q, очікувалось %q", i, got[i], want[i])
		}
	}

	t.Setenv("CORS_ORIGINS", "")
	if len(AllowedOrigins()) != 2 {
		t.Error("без CORS_ORIGINS мають лишитись тільки два продакшн-origin")
	}
}
