package domain

import (
	"encoding/json"
	"testing"
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
