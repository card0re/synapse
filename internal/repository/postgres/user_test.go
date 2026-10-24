package postgres

import (
	"strings"
	"testing"

	"github.com/jackc/pgx/v5/pgtype"
)

// Пастка, через яку підтвердження віку не працювало жодного разу: для колонки
// date pgx просить бінарний формат, а плану «Go string -> date (binary)» у нього
// немає. birthDate у UpdateProfile — це *string, тож без приведення до тексту
// драйвер падає ще до бази, і користувач бачить 500 замість збереженої дати.
// Якщо цей тест колись почне падати — pgx навчився, і каст можна прибирати
// свідомо, а не випадково.
func TestPgxCannotEncodeStringAsDate(t *testing.T) {
	m := pgtype.NewMap()

	if got := m.FormatCodeForOID(pgtype.DateOID); got != pgtype.BinaryFormatCode {
		t.Fatalf("pgx більше не просить бінарний формат для date (got %d)", got)
	}
	if m.PlanEncode(pgtype.DateOID, pgtype.BinaryFormatCode, "1983-12-21") != nil {
		t.Fatal("pgx тепер вміє слати Go string у date — каст ::date більше не обов'язковий")
	}
	if m.PlanEncode(pgtype.TextOID, pgtype.BinaryFormatCode, "1983-12-21") == nil {
		t.Fatal("pgx не вміє слати Go string у text — обхід через ::date не працює")
	}
}

// Кожен стан, що рухав хвилини, закінчується кінцевим: повернення ставить
// rejected/cancelled, виплата — completed. Якщо з котрогось із них знову можна
// вийти, та сама сума проводиться вдруге.
func TestTerminalDealStatuses(t *testing.T) {
	for _, s := range []string{"completed", "rejected", "cancelled"} {
		if !isTerminalDealStatus(s) {
			t.Errorf("%q має бути кінцевим: вихід із нього проводить гроші вдруге", s)
		}
	}
	for _, s := range []string{"pending", "negotiating", "accepted", "cancel_requested", "disputed"} {
		if isTerminalDealStatus(s) {
			t.Errorf("%q кінцевим не є — угода з нього ще має рухатись", s)
		}
	}
}

// Заслін проти фарму: витрачати хвилини можна лише з підтвердженого акаунта.
// Непідтверджена пошта без Telegram — це рівно той throwaway, яким набивали
// привітальні 120, тож йому відмова.
func TestCanSpendMinutes(t *testing.T) {
	cases := []struct {
		hasTelegram, emailVerified, want bool
	}{
		{true, false, true},   // реальний Telegram
		{false, true, true},   // підтверджена пошта (код або Google)
		{true, true, true},    // обидва
		{false, false, false}, // throwaway: ні Telegram, ні підтвердженої пошти
	}
	for _, c := range cases {
		if got := canSpendMinutes(c.hasTelegram, c.emailVerified); got != c.want {
			t.Errorf("canSpendMinutes(tg=%v, verified=%v) = %v, want %v", c.hasTelegram, c.emailVerified, got, c.want)
		}
	}
}

func TestUpdateProfileQueryCastsAndNullifies(t *testing.T) {
	if !strings.Contains(updateProfileQuery, "NULLIF($6, '')::date") {
		t.Error("birth_date має йти через ::date, інакше pgx не закодує рядок і збереження дати впаде")
	}
	if !strings.Contains(updateProfileQuery, "NULLIF($2, '')") {
		t.Error("phone_number має йти через NULLIF: порожній рядок конфліктує з users_phone_number_key")
	}
}
