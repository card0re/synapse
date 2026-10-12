package usecase

import (
	"context"
	"testing"
	"time"

	"github.com/card0re/synapse/internal/domain"
)

// Хвилини рухає тільки репозиторій, однією транзакцією. Юзкейс колись робив це
// ще й сам — за угоду списувалась подвійна ціна, а повернення було подвійним.
// Тест ловить саме це: будь-який виклик UpdateUserMinutes/TransferFrozenToMaster
// з юзкейса означає, що списання знову дублюється.
type ledgerSpy struct {
	domain.UserRepository

	deal  domain.Deal
	skill domain.Skill

	minutesCalls  int
	transferCalls int
	created       int
	completed     int
	lastStatus    string
}

func (s *ledgerSpy) GetSkillByID(context.Context, string) (*domain.Skill, error) {
	return &s.skill, nil
}
func (s *ledgerSpy) GetDealByID(context.Context, string) (*domain.Deal, error) {
	return &s.deal, nil
}
func (s *ledgerSpy) GetUserByID(context.Context, string) (*domain.User, error) {
	return &domain.User{ID: "learner", BalanceMinutes: 120}, nil
}
func (s *ledgerSpy) CreateDeal(context.Context, string, string) error { s.created++; return nil }
func (s *ledgerSpy) CompleteDeal(context.Context, string) error       { s.completed++; return nil }
func (s *ledgerSpy) UpdateUserMinutes(context.Context, string, int, int) error {
	s.minutesCalls++
	return nil
}
func (s *ledgerSpy) TransferFrozenToMaster(context.Context, string, string, int) error {
	s.transferCalls++
	return nil
}
func (s *ledgerSpy) UpdateDealStatus(_ context.Context, _ string, status string, _ *time.Time) error {
	s.lastStatus = status
	return nil
}

func newSpy(dealStatus string) (*ledgerSpy, domain.UserUseCase) {
	spy := &ledgerSpy{
		deal:  domain.Deal{ID: "d-1", SkillID: "s-1", InitiatorID: "learner", ReceiverID: "master", Status: dealStatus},
		skill: domain.Skill{ID: "s-1", UserID: "master", Title: "Go", Price: 60},
	}
	return spy, NewUserUseCase(spy, nil, nil)
}

func TestCreateDealChargesOnce(t *testing.T) {
	spy, uc := newSpy("pending")
	if err := uc.CreateDeal(context.Background(), "s-1", "learner"); err != nil {
		t.Fatal(err)
	}
	if spy.created != 1 {
		t.Errorf("repo.CreateDeal викликано %d разів, очікувалось 1", spy.created)
	}
	if spy.minutesCalls != 0 {
		t.Errorf("юзкейс списав хвилини сам (%d викликів) — разом із транзакцією це подвійна ціна", spy.minutesCalls)
	}
}

func TestStatusChangesDoNotMoveMinutes(t *testing.T) {
	for _, status := range []string{"rejected", "cancelled", "completed"} {
		t.Run(status, func(t *testing.T) {
			spy, uc := newSpy("pending")
			if err := uc.UpdateDealStatus(context.Background(), "d-1", status, nil); err != nil {
				t.Fatal(err)
			}
			if spy.minutesCalls != 0 || spy.transferCalls != 0 {
				t.Errorf("юзкейс рухав хвилини повз транзакцію: minutes=%d transfer=%d", spy.minutesCalls, spy.transferCalls)
			}
		})
	}
}

// Завершення має йти через CompleteDeal: саме там ціна береться із самої угоди
// і додаються проведені/отримані хвилини.
func TestCompletedGoesThroughCompleteDeal(t *testing.T) {
	spy, uc := newSpy("accepted")
	if err := uc.UpdateDealStatus(context.Background(), "d-1", "completed", nil); err != nil {
		t.Fatal(err)
	}
	if spy.completed != 1 {
		t.Errorf("repo.CompleteDeal викликано %d разів, очікувалось 1", spy.completed)
	}
}

// Односторонньо скасувати підтверджений урок не можна — це запит до другої сторони.
func TestCancelOfAcceptedBecomesRequest(t *testing.T) {
	spy, uc := newSpy("accepted")
	if err := uc.UpdateDealStatus(context.Background(), "d-1", "cancelled", nil); err != nil {
		t.Fatal(err)
	}
	if spy.lastStatus != "cancel_requested" {
		t.Errorf("статус угоди став %q, очікувався cancel_requested", spy.lastStatus)
	}
}
