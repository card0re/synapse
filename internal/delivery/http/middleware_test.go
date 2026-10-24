package http

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/card0re/synapse/internal/domain"
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
		email      string
		want       int
	}{
		{"власник проходить", "id", "/users/:id", "/users/u-1", "u-1", "user", "", http.StatusOK},
		{"чужий акаунт — 403", "id", "/users/:id", "/users/u-2", "u-1", "user", "", http.StatusForbidden},
		// адміном робить пошта, а не роль: роль без неї обходу не дає
		{"адмін проходить скрізь", "id", "/users/:id", "/users/u-2", "u-1", "admin", "owner@example.com", http.StatusOK},
		{"роль admin без пошти — 403", "id", "/users/:id", "/users/u-2", "u-1", "admin", "", http.StatusForbidden},
		{"параметр :userId теж охороняється", "userId", "/users/profile/:userId", "/users/profile/u-2", "u-1", "user", "", http.StatusForbidden},
		{"параметр :user_id теж охороняється", "user_id", "/deals/incoming/:user_id", "/deals/incoming/u-2", "u-1", "user", "", http.StatusForbidden},
		{"невідомий параметр не відкриває доступ", "nope", "/users/:id", "/users/u-1", "u-1", "user", "", http.StatusForbidden},
	}

	t.Setenv("ADMIN_EMAIL", "owner@example.com")

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			r := gin.New()
			r.GET(tc.route, func(c *gin.Context) {
				c.Set("userId", tc.tokenUser)
				c.Set("userRole", tc.role)
				c.Set("userEmail", tc.email)
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

type adminStub struct {
	domain.UserUseCase
	user *domain.User
}

func (s adminStub) GetUserByID(context.Context, string) (*domain.User, error) {
	if s.user == nil {
		return nil, errors.New("немає такого користувача")
	}
	return s.user, nil
}

// Адміністратор рівно один, і визначає його пошта. Роль у токені сама по собі
// більше нічого не відкриває: інакше адмінку діставав би кожен, кому колонку
// users.role виставив інший адмін або хто дописав її прямо в базі.
func TestRequireAdminBindsToOneEmail(t *testing.T) {
	t.Setenv("JWT_SECRET_KEY", testSecret)
	t.Setenv("ADMIN_EMAIL", "owner@example.com")
	exp := time.Now().Add(time.Hour).Unix()

	dbUser := func(email string, banned bool) *domain.User {
		return &domain.User{ID: "u-1", Email: &email, IsBanned: banned}
	}
	adminClaims := func() jwt.MapClaims {
		return jwt.MapClaims{"user_id": "u-1", "role": "admin", "email": "owner@example.com", "exp": exp}
	}

	for _, tc := range []struct {
		name   string
		claims jwt.MapClaims
		user   *domain.User
		want   int
	}{
		{"звичайний користувач", jwt.MapClaims{"user_id": "u-1", "role": "user", "exp": exp}, dbUser("owner@example.com", false), http.StatusForbidden},
		{"старий токен: роль є, пошти немає", jwt.MapClaims{"user_id": "u-1", "role": "admin", "exp": exp}, dbUser("owner@example.com", false), http.StatusForbidden},
		{"чужа пошта в токені", jwt.MapClaims{"user_id": "u-1", "role": "admin", "email": "someone@example.com", "exp": exp}, dbUser("someone@example.com", false), http.StatusForbidden},
		{"у базі вже інша пошта", adminClaims(), dbUser("someone@example.com", false), http.StatusForbidden},
		{"акаунт без пошти", adminClaims(), &domain.User{ID: "u-1"}, http.StatusForbidden},
		{"користувача не знайдено", adminClaims(), nil, http.StatusForbidden},
		{"адміна забанено", adminClaims(), dbUser("owner@example.com", true), http.StatusForbidden},
		{"справжній адмін", adminClaims(), dbUser("owner@example.com", false), http.StatusOK},
		{"пошта в іншому регістрі", jwt.MapClaims{"user_id": "u-1", "role": "admin", "email": "Owner@Example.com", "exp": exp}, dbUser("OWNER@example.com", false), http.StatusOK},
	} {
		t.Run(tc.name, func(t *testing.T) {
			h := NewHandler(adminStub{user: tc.user})

			r := gin.New()
			r.GET("/a", AuthMiddleware(), h.RequireAdmin(), func(c *gin.Context) { c.Status(http.StatusOK) })
			req := httptest.NewRequest(http.MethodGet, "/a", nil)
			req.Header.Set("Authorization", "Bearer "+sign(t, jwt.SigningMethodHS256, []byte(testSecret), tc.claims))
			w := httptest.NewRecorder()
			r.ServeHTTP(w, req)

			if w.Code != tc.want {
				t.Errorf("отримано %d, очікувалось %d", w.Code, tc.want)
			}
		})
	}
}

// Адмін обходить перевірку власника акаунта, тож роль без пошти не повинна
// давати і цього обходу — інакше старий токен так і редагував би чужі профілі.
func TestOwnershipBypassNeedsTheAdminEmail(t *testing.T) {
	t.Setenv("JWT_SECRET_KEY", testSecret)
	t.Setenv("ADMIN_EMAIL", "owner@example.com")
	exp := time.Now().Add(time.Hour).Unix()

	for _, tc := range []struct {
		name   string
		claims jwt.MapClaims
		want   int
	}{
		{"роль без пошти", jwt.MapClaims{"user_id": "me", "role": "admin", "exp": exp}, http.StatusForbidden},
		{"роль і пошта адміна", jwt.MapClaims{"user_id": "me", "role": "admin", "email": "owner@example.com", "exp": exp}, http.StatusOK},
	} {
		t.Run(tc.name, func(t *testing.T) {
			r := gin.New()
			r.GET("/u/:id", AuthMiddleware(), UserOwnershipMiddleware("id"), func(c *gin.Context) { c.Status(http.StatusOK) })
			req := httptest.NewRequest(http.MethodGet, "/u/stranger", nil)
			req.Header.Set("Authorization", "Bearer "+sign(t, jwt.SigningMethodHS256, []byte(testSecret), tc.claims))
			w := httptest.NewRecorder()
			r.ServeHTTP(w, req)

			if w.Code != tc.want {
				t.Errorf("отримано %d, очікувалось %d", w.Code, tc.want)
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
