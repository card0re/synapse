package http

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

// dealSpy запам'ятовує, з чим ручка покликала шар нижче: саме підміна цих
// аргументів тілом запиту і була дірою.
type dealSpy struct {
	stubUseCase
	reviewTarget string
	statusSeen   string
}

func (s *dealSpy) CreateReview(_ context.Context, _, _, targetID string, _ int, _ *string) error {
	s.reviewTarget = targetID
	return nil
}

func (s *dealSpy) UpdateDealStatus(_ context.Context, _, newStatus string, _ *time.Time) error {
	s.statusSeen = newStatus
	return nil
}

func dealRouter(t *testing.T, userID string) (*gin.Engine, *dealSpy, string) {
	t.Helper()
	t.Setenv("JWT_SECRET_KEY", testSecret)

	token := sign(t, jwt.SigningMethodHS256, []byte(testSecret), jwt.MapClaims{
		"user_id": userID,
		"role":    "user",
		"exp":     time.Now().Add(time.Hour).Unix(),
	})

	spy := &dealSpy{}
	router := gin.New()
	NewHandler(spy).InitRoutes(router)
	return router, spy, token
}

func do(t *testing.T, router *gin.Engine, method, path, token, body string) int {
	t.Helper()
	req := httptest.NewRequest(method, path, strings.NewReader(body))
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	return w.Code
}

// Угода в стабі: initiator "owner", receiver "master". Кого оцінюють — має
// випливати з неї, а не з target_id у тілі, інакше будь-хто ставить оцінку
// будь-кому (і собі).
func TestReviewTargetComesFromDealNotBody(t *testing.T) {
	for _, tc := range []struct{ actor, wantTarget string }{
		{"owner", "master"},
		{"master", "owner"},
	} {
		t.Run(tc.actor, func(t *testing.T) {
			router, spy, token := dealRouter(t, tc.actor)

			// у тілі навмисне вказано сам себе — так виглядала накрутка рейтингу
			code := do(t, router, http.MethodPost, "/api/deals/d-1/review", token,
				`{"target_id":"`+tc.actor+`","score":5}`)

			if code != http.StatusOK {
				t.Fatalf("учаснику угоди відмовили: %d", code)
			}
			if spy.reviewTarget != tc.wantTarget {
				t.Errorf("оцінку записали на %q, а мали на %q — target_id з тіла переміг",
					spy.reviewTarget, tc.wantTarget)
			}
		})
	}
}

// Статус раніше був вільним рядком: вигаданий проходив у catch-all гілку
// репозиторію і ставав станом угоди, з якого потім знову відкривалась
// грошова гілка.
func TestDealStatusRejectsUnknownValue(t *testing.T) {
	router, spy, token := dealRouter(t, "owner")

	if code := do(t, router, http.MethodPut, "/api/deals/d-1/status", token, `{"status":"вигаданий"}`); code != http.StatusBadRequest {
		t.Errorf("невідомий статус віддав %d, а мав 400", code)
	}
	if spy.statusSeen != "" {
		t.Errorf("невідомий статус %q дійшов до шару нижче", spy.statusSeen)
	}

	if code := do(t, router, http.MethodPut, "/api/deals/d-1/status", token, `{"status":"completed"}`); code != http.StatusOK {
		t.Fatalf("звичайний статус зламався: %d", code)
	}
	if spy.statusSeen != "completed" {
		t.Errorf("до шару нижче дійшло %q", spy.statusSeen)
	}
}
