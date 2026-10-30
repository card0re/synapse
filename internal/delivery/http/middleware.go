package http

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/card0re/synapse/internal/auth"
	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

// Допоміжна функція для отримання ключа
func getJWTSecret() []byte {
	secret := os.Getenv("JWT_SECRET_KEY")
	if secret == "" {
		// Раніше тут був хардкодний дефолтний ключ — це дірка в безпеці
		// (він же лежить у публічному репо), тож без секрету краще впасти.
		log.Fatal("КРИТИЧНО: JWT_SECRET_KEY не задано")
	}
	return []byte(secret)
}

// AllowedOrigins — єдиний список дозволених origin: ним користується і CORS,
// і перевірка origin при апгрейді WebSocket. Порожні елементи відкидаються
// свідомо: зайва кома в CORS_ORIGINS роняла gin-contrib/cors панікою на старті.
func AllowedOrigins() []string {
	origins := []string{"https://synapse.tel", "https://www.synapse.tel"}
	for _, o := range strings.Split(os.Getenv("CORS_ORIGINS"), ",") {
		if o = strings.TrimSpace(o); o != "" {
			origins = append(origins, o)
		}
	}
	return origins
}

// RequireAdmin — два незалежні бар'єри перед адмінкою.
//
// Перший: токен має нести і роль, і пошту єдиного адміна. Він дешевий і
// відсікає всіх звичайних користувачів, не торкаючись бази.
//
// Другий: пошта перечитується з бази просто зараз. Клейм живе 72 години, і без
// цього кроку адміном лишався б той, у кого адреса була на момент входу, навіть
// якщо її вже змінили. Адмінських запитів одиниці, тож зайвий SELECT тут
// нічого не коштує.
func (h *Handler) RequireAdmin() gin.HandlerFunc {
	return func(c *gin.Context) {
		deny := func() {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "Доступ заборонено: тільки для адміністраторів"})
		}

		if !isAdmin(c) {
			deny()
			return
		}

		user, err := h.userUC.GetUserByID(c.Request.Context(), currentUserID(c))
		if err != nil || user == nil || user.Email == nil || !auth.IsAdminEmail(*user.Email) {
			deny()
			return
		}
		if user.IsBanned {
			deny()
			return
		}

		c.Next()
	}
}

// counter — скільки разів ключ звертався і коли востаннє.
type counter struct {
	count    int
	lastSeen time.Time
}

// limiter рахує звернення за ключем, який задає той, хто його викликає.
// Головне тут — вибір ключа: RateLimitAuth рахує по IP, а IP на Cloud Run
// приходить у X-Forwarded-For, який задає сам клієнт. Тому для перебору пароля
// і для навантаження беруться ключі, які підробити не можна: сама пошта й
// user_id із перевіреного токена.
//
// Пам'ять прибирається ліниво, під час звернень: окрема горутина тут зайва,
// а без прибирання мапа росла б на кожну нову пошту.
type limiter struct {
	mu     sync.Mutex
	seen   map[string]*counter
	limit  int
	window time.Duration
}

func newLimiter(limit int, window time.Duration) *limiter {
	return &limiter{seen: map[string]*counter{}, limit: limit, window: window}
}

func (l *limiter) allow(key string) bool {
	if key == "" {
		return true // нема за чим рахувати — хай інші заслони вирішують
	}
	l.mu.Lock()
	defer l.mu.Unlock()

	now := time.Now()
	if len(l.seen) > 10000 {
		for k, c := range l.seen {
			if now.Sub(c.lastSeen) > l.window {
				delete(l.seen, k)
			}
		}
	}

	c, ok := l.seen[key]
	if !ok || now.Sub(c.lastSeen) > l.window {
		l.seen[key] = &counter{count: 1, lastSeen: now}
		return true
	}
	c.lastSeen = now
	c.count++
	return c.count <= l.limit
}

func (l *limiter) reset(key string) {
	l.mu.Lock()
	delete(l.seen, key)
	l.mu.Unlock()
}

// loginAttempts — спроби входу за самою поштою. Ліміт по IP від перебору не
// рятує: зміна одного заголовка дає нову «адресу», а інстансів до двадцяти,
// і лічильник у кожного свій. Ключ-пошта знімає обидві проблеми для перебору
// пароля; від потоку реєстрацій на різні адреси лишається заслон по IP.
var loginAttempts = newLimiter(10, 15*time.Minute)

// perUserLimit — заслін від навантаження на захищені маршрути. Ключ — user_id
// із токена, тобто підробити його можна лише підробивши підпис. Ліміт свідомо
// високий: він має зупиняти скрипт, а не живу людину. Чат іде по WebSocket і
// сюди не потрапляє, тож на звичайне користування ліміт не впливає.
var perUserLimit = newLimiter(120, time.Minute)

// RateLimitPerUser. Без нього будь-який залогінений користувач міг крутити
// створення угод і профільних запитів скільки завгодно, а Cloud Run чесно
// піднімав до двадцяти інстансів — за рахунок власника.
func RateLimitPerUser() gin.HandlerFunc {
	return func(c *gin.Context) {
		if !perUserLimit.allow(currentUserID(c)) {
			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{"error": "Забагато запитів. Зачекайте хвилину."})
			return
		}
		c.Next()
	}
}

// RejectBanned — бан мусить діяти одразу, а не з наступного входу.
//
// Роль і права лежать у токені, а токен живе 72 години, тож до цього заслону
// забанений користувач ще три доби писав у чат, створював угоди й витрачав
// хвилини: кнопка в адмінці фактично нічого не робила. Перевірка при вході
// (abortIfBanned) ловить лише тих, хто входить наново.
//
// Ставиться одразу після AuthMiddleware, тож ID у контексті вже є. Один SELECT
// на запит: користувачів десятки, і ціна цього менша за три доби безкарності.
// Користувача не знайдено — теж відмова: токен видаленого акаунта не повинен
// працювати.
func (h *Handler) RejectBanned() gin.HandlerFunc {
	return func(c *gin.Context) {
		user, err := h.userUC.GetUserByID(c.Request.Context(), currentUserID(c))
		if err != nil || user == nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Недійсний токен"})
			return
		}
		if user.IsBanned {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "Акаунт заблоковано адміністрацією"})
			return
		}
		c.Next()
	}
}

func AuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Потрібна авторизація"})
			c.Abort()
			return
		}

		parts := strings.Split(authHeader, " ")
		if len(parts) != 2 || parts[0] != "Bearer" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Неправильний формат токена"})
			c.Abort()
			return
		}

		tokenString := parts[1]

		token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, fmt.Errorf("unexpected signing method")
			}
			return getJWTSecret(), nil
		})

		if err != nil || !token.Valid {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Недійсний токен"})
			c.Abort()
			return
		}

		claims, ok := token.Claims.(jwt.MapClaims)
		if ok {
			c.Set("userId", claims["user_id"])
			c.Set("userRole", claims["role"])
			// Пошта є в токені лише в єдиного адміна — isAdmin звіряє обидва
			// клейми, щоб самої ролі для адмінських обходів не вистачало.
			c.Set("userEmail", claims["email"])
		}

		c.Next()
	}
}

// UserOwnershipMiddleware пропускає далі тільки власника акаунта (або адміна).
// param — ім'я параметра маршруту з ID: різні маршрути називають його
// по-різному (:id, :userId, :user_id), і саме через це перевірка раніше
// не вішалась на половину з них.
func UserOwnershipMiddleware(param string) gin.HandlerFunc {
	return func(c *gin.Context) {
		reqUserID := c.Param(param)
		if reqUserID == "" {
			c.JSON(http.StatusForbidden, gin.H{"error": "Доступ заборонено: не вказано ID"})
			c.Abort()
			return
		}
		tokenUserIDVal, exists := c.Get("userId")

		if !exists {
			c.JSON(http.StatusForbidden, gin.H{"error": "Доступ заборонено: немає інформації про користувача"})
			c.Abort()
			return
		}

		// Безпечне перетворення ID з токена у рядок для порівняння
		tokenUserID := fmt.Sprintf("%v", tokenUserIDVal)

		// Якщо користувач не є адміном І його ID не збігається з ID в URL
		if reqUserID != tokenUserID && !isAdmin(c) {
			c.JSON(http.StatusForbidden, gin.H{"error": "Доступ заборонено: ви не можете керувати чужим акаунтом"})
			c.Abort()
			return
		}
		c.Next()
	}
}

// ipAttempts — грубий заслін на групі входу. Ключ — IP, а він на Cloud Run
// приходить у X-Forwarded-For, який задає сам клієнт, тож цілеспрямований
// перебір обходить його зміною одного заголовка. Лишається він проти потоку
// реєстрацій на різні адреси, де ключа-логіна просто немає; від перебору
// пароля захищає loginAttempts, який рахує по самій пошті.
var ipAttempts = newLimiter(5, 30*time.Second)

func RateLimitAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		if !ipAttempts.allow(c.ClientIP()) {
			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{"error": "Занадто багато спроб. Зачекайте 30 секунд."})
			return
		}
		c.Next()
	}
}
