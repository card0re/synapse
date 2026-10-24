package http

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/card0re/synapse/internal/domain"
	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

type feedStub struct{ stubUseCase }

func (feedStub) GetAllFeed(context.Context, string, string, string, string, string, string) ([]domain.FeedItem, error) {
	return nil, nil
}

// Нечислові фільтри раніше доходили до pgx і давали 500 (драйвер не кодує рядок
// у числову колонку). Тепер відсікаємо на вході 400, а валідні проходять.
func TestFeedRejectsNonNumericFilters(t *testing.T) {
	router := gin.New()
	NewHandler(feedStub{}).InitRoutes(router)

	for _, tc := range []struct {
		q    string
		want int
	}{
		{"city_id=abc", http.StatusBadRequest},
		{"max_price=xx", http.StatusBadRequest},
		{"min_price=1.5", http.StatusBadRequest}, // ціна — ціле, не дробове
		{"min_rating=abc", http.StatusBadRequest},
		{"city_id=5&min_price=10&min_rating=4.5", http.StatusOK},
		{"", http.StatusOK},
	} {
		t.Run(tc.q, func(t *testing.T) {
			w := httptest.NewRecorder()
			router.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/api/feed/?"+tc.q, nil))
			if w.Code != tc.want {
				t.Errorf("?%s -> %d, очікувалось %d", tc.q, w.Code, tc.want)
			}
		})
	}
}

// avatar_url/bio — колонки text без межі; аватар на сотні КБ дублювався в кожен
// рядок стрічки й у кеш. Межа binding має відсікати такий ввід 400-ю.
func TestUpdateProfileRejectsOversizeAvatar(t *testing.T) {
	t.Setenv("JWT_SECRET_KEY", testSecret)
	tok := sign(t, jwt.SigningMethodHS256, []byte(testSecret), jwt.MapClaims{
		"user_id": "u-1", "role": "user", "exp": time.Now().Add(time.Hour).Unix(),
	})

	router := gin.New()
	NewHandler(stubUseCase{}).InitRoutes(router)

	big := `{"avatar_url":"` + strings.Repeat("A", 400000) + `"}`
	req := httptest.NewRequest(http.MethodPut, "/api/users/profile/u-1", strings.NewReader(big))
	req.Header.Set("Authorization", "Bearer "+tok)
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("завеликий avatar_url -> %d, очікувалось 400", w.Code)
	}
}
