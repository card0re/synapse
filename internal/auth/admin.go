package auth

import (
	"os"
	"strings"
)

// Адміністратор у системі рівно один, і визначає його пошта, а не колонка
// users.role. Колонка доступу більше не дає свідомо: її переписує будь-який
// інший адмін через адмінку (PUT /admin/users/:id) і будь-хто з доступом до
// бази, тож вона не може бути ознакою єдиного власника.
//
// Саму адресу тут не вказано свідомо: репозиторій публічний, і назвати пошту
// єдиного адміністратора означає назвати ціль для фішингу — зламати платформу
// тоді можна, не чіпаючи платформу. Реальне значення приходить через
// ADMIN_EMAIL із Secret Manager.
//
// Домен .invalid зарезервований RFC 2606 і не реєструється, тож цю адресу
// неможливо підтвердити в Google. Забута змінна оточення закриває адмінку
// для всіх, а не відкриває її комусь.
const defaultAdminEmail = "admin@invalid"

// AdminEmail — адреса єдиного адміністратора. Задається через ADMIN_EMAIL, що
// дозволяє міняти її без перезбірки й не тримати в коді. Порожня змінна дає
// недосяжний дефолт вище, а не «будь-хто».
func AdminEmail() string {
	if e := strings.TrimSpace(os.Getenv("ADMIN_EMAIL")); e != "" {
		return e
	}
	return defaultAdminEmail
}

// IsAdminEmail порівнює без урахування регістру — пошта регістру не розрізняє,
// інакше Admin@Example.com повз перевірку був би іншою людиною, ніж
// admin@example.com.
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
