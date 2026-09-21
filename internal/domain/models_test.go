package domain

import (
	"encoding/json"
	"testing"
	"time"
)

// /users/public/:id відповідає без авторизації, тож PublicView — єдине, що
// стоїть між базою і будь-ким, хто перебирає UUID.
func TestPublicViewDropsPersonalData(t *testing.T) {
	tgID := int64(12345)
	phone, email, birth := "+380000000000", "someone@example.com", "1990-01-01"
	u := User{
		ID:             "u-1",
		Username:       "someone",
		TelegramID:     &tgID,
		PhoneNumber:    &phone,
		Email:          &email,
		BirthDate:      &birth,
		BalanceMinutes: 120,
		Rating:         4.5,
	}

	pub := u.PublicView()

	for name, got := range map[string]any{
		"telegram_id":  pub.TelegramID,
		"phone_number": pub.PhoneNumber,
		"email":        pub.Email,
		"birth_date":   pub.BirthDate,
	} {
		if got != (any)(nil) && !isNilPtr(got) {
			t.Errorf("PublicView залишив %s", name)
		}
	}

	if pub.Username != "someone" || pub.BalanceMinutes != 120 || pub.Rating != 4.5 {
		t.Error("PublicView зрізав публічні поля, які потрібні фронту")
	}

	// Оригінал не мутується — метод на значенні, а не на вказівнику.
	if u.Email == nil {
		t.Error("PublicView зіпсував оригінальну структуру")
	}

	blob, err := json.Marshal(pub)
	if err != nil {
		t.Fatal(err)
	}
	var out map[string]any
	if err := json.Unmarshal(blob, &out); err != nil {
		t.Fatal(err)
	}
	// password_hash має json:"-", але це легко загубити при редагуванні структури.
	if _, leaked := out["password_hash"]; leaked {
		t.Error("password_hash потрапив у JSON")
	}
	for _, f := range []string{"email", "phone_number", "birth_date", "telegram_id"} {
		if v := out[f]; v != nil {
			t.Errorf("%s серіалізувався як %v, а мав бути null", f, v)
		}
	}
}

func isNilPtr(v any) bool {
	switch p := v.(type) {
	case *int64:
		return p == nil
	case *string:
		return p == nil
	}
	return false
}

// Стрічка публічна, тож у JSON має їхати вік, а не дата народження.
func TestFeedItemHidesBirthDate(t *testing.T) {
	born := time.Now().AddDate(-30, 0, -1).Format(time.DateOnly)
	blob, err := json.Marshal(FeedItem{SkillID: "s-1", BirthDate: &born})
	if err != nil {
		t.Fatal(err)
	}

	var out map[string]any
	if err := json.Unmarshal(blob, &out); err != nil {
		t.Fatal(err)
	}
	if _, leaked := out["birth_date"]; leaked {
		t.Error("birth_date потрапив у публічну стрічку")
	}
	if out["age"] != float64(30) {
		t.Errorf("age = %v, очікувалось 30", out["age"])
	}
	if out["skill_id"] != "s-1" {
		t.Error("решта полів загубилась при маршалінгу")
	}
}

func TestFeedItemAge(t *testing.T) {
	ptr := func(s string) *string { return &s }
	almost30 := time.Now().AddDate(-30, 0, 1).Format(time.DateOnly) // день народження завтра
	exactly30 := time.Now().AddDate(-30, 0, 0).Format(time.DateOnly)

	cases := []struct {
		name string
		in   *string
		want *int
	}{
		{"не задана", nil, nil},
		{"порожня", ptr(""), nil},
		{"нульовий час Go", ptr("0001-01-01T00:00:00Z"), nil},
		{"сміття", ptr("не дата"), nil},
		{"у майбутньому", ptr(time.Now().AddDate(1, 0, 0).Format(time.DateOnly)), nil},
		{"неправдоподібно старий", ptr("1850-01-01"), nil},
		{"рівно 30", ptr(exactly30), intp(30)},
		{"день народження завтра", ptr(almost30), intp(29)},
		{"з часом у хвості", ptr(exactly30 + "T00:00:00Z"), intp(30)},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := FeedItem{BirthDate: tc.in}.Age()
			switch {
			case tc.want == nil && got != nil:
				t.Errorf("очікувався nil, отримано %d", *got)
			case tc.want != nil && got == nil:
				t.Errorf("очікувалось %d, отримано nil", *tc.want)
			case tc.want != nil && *got != *tc.want:
				t.Errorf("отримано %d, очікувалось %d", *got, *tc.want)
			}
		})
	}
}

func intp(i int) *int { return &i }
