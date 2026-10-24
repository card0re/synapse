package auth

import (
	"os"
	"strings"
)

// Адміністратор у системі рівно один, і визначає його пошта, а не колонка
// users.role. Колонка доступу більше не дає свідомо: її переписує будь-який
// інший адмін через адмінку (PUT /admin/users/:id) і будь-хто з доступом до
// бази, тож вона не може бути ознакою єдиного власника.
const defaultAdminEmail = "<redacted-email>"

// AdminEmail — адреса єдиного адміністратора. ADMIN_EMAIL дозволяє змінити її
// без перезбірки. Порожня змінна означає значення за замовчуванням, а не
// «будь-хто»: забута змінна оточення не повинна відкривати адмінку.
func AdminEmail() string {
	if e := strings.TrimSpace(os.Getenv("ADMIN_EMAIL")); e != "" {
		return e
	}
	return defaultAdminEmail
}

// IsAdminEmail порівнює без урахування регістру — пошта регістру не розрізняє,
// інакше <redacted-email> повз перевірку був би іншою людиною.
func IsAdminEmail(email string) bool {
	email = strings.TrimSpace(email)
	return email != "" && strings.EqualFold(email, AdminEmail())
}

// EffectiveRole — роль, яку отримає токен. verifiedEmail передає лише той шлях
// входу, де адресу підтвердив сам провайдер: Google звіряє email_verified і aud.
// Реєстрація поштою з паролем не підтверджує нічого — доступу до скриньки вона
// не вимагає, — тож інакше адміном став би той, хто першим зайняв адресу.
func EffectiveRole(verifiedEmail string) string {
	if IsAdminEmail(verifiedEmail) {
		return "admin"
	}
	return "user"
}
