package main

import (
	"context"
	"github.com/card0re/synapse/internal/service"
	"log"
	"os"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	_ "github.com/jackc/pgx/v5/stdlib"
	"github.com/jmoiron/sqlx"
	"github.com/joho/godotenv"
	"github.com/redis/go-redis/v9"
	"golang.org/x/crypto/bcrypt"

	"github.com/card0re/synapse/internal/bot"
	deliveryHttp "github.com/card0re/synapse/internal/delivery/http"
	"github.com/card0re/synapse/internal/repository/postgres"
	"github.com/card0re/synapse/internal/usecase"
)

func main() {
	if err := godotenv.Load(); err != nil {
		log.Println("⚠️ Попередження: файл .env не знайдено, перевірте налаштування")
	}

	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		log.Fatal("КРИТИЧНО: DATABASE_URL не знайдено у файлі .env!")
	}

	// Без ключа підпису сервіс однаково не працює, але ловилось це аж у
	// getJWTSecret — тобто вже всередині обробки запиту, і log.Fatal там валив
	// процес на першому ж запиті з токеном, даючи цикл перезапусків замість
	// зрозумілої помилки деплою. Перевіряємо тут, поки трафіку ще немає.
	if os.Getenv("JWT_SECRET_KEY") == "" {
		log.Fatal("КРИТИЧНО: JWT_SECRET_KEY не задано")
	}
	db, err := sqlx.Connect("pgx", dsn)
	if err != nil {
		log.Fatalf("❌ Не вдалося підключитися до БД: %v", err)
	}
	defer db.Close()
	// Пул за замовчуванням не обмежений: при автоскейлі Cloud Run інстанси
	// разом вичерпували ліміт з'єднань Cloud SQL, і тоді падали вже всі запити.
	// MaxIdle тримаємо рівним MaxOpen, інакше Go закриває 8 з 10 з'єднань
	// одразу після використання і на кожному сплеску переукладає TLS.
	db.SetMaxOpenConns(10)
	db.SetMaxIdleConns(10)
	db.SetConnMaxLifetime(30 * time.Minute)
	log.Println("✅ БД успішно підключена")

	// ponytail: схема в проді збиралась руками й розійшлася з тим, що очікує код.
	// Міграції на Cloud Run не ганяються, тому доводимо її до ладу на старті —
	// усе ідемпотентне, повторний запуск нічого не змінює. Ті самі зміни
	// лежать у migrations/ для чистої бази.
	for _, stmt := range []string{
		`ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_code VARCHAR(6)`,
		// код входу тепер 8-значний і з терміном життя — колонку розширюємо,
		// а строк протухання додаємо (обидва IF NOT EXISTS / TYPE ідемпотентні)
		`ALTER TABLE users ALTER COLUMN auth_code TYPE VARCHAR(10)`,
		`ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_code_expires_at TIMESTAMPTZ`,
		// Витрата хвилин лише з підтвердженого акаунта (заслін проти фарму).
		// DEFAULT true при першому додаванні «дідусює» всіх наявних користувачів,
		// далі дефолт false — нові акаунти мусять підтвердитись. Обидва кроки
		// ідемпотентні: повторний ADD IF NOT EXISTS наявні рядки не чіпає.
		`ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT true`,
		`ALTER TABLE users ALTER COLUMN email_verified SET DEFAULT false`,
		`ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_link_token VARCHAR(64)`,
		// без цієї колонки кнопка бана в адмінці завжди відповідала помилкою
		`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_banned BOOLEAN DEFAULT FALSE`,
		// дефолт у базі був 240 хвилин, хоча обіцяємо скрізь 120
		`ALTER TABLE users ALTER COLUMN balance_minutes SET DEFAULT 120`,
		// цитати в чаті нікуди не зберігались
		`ALTER TABLE messages ADD COLUMN IF NOT EXISTS reply_to_id INTEGER`,
		`ALTER TABLE messages ADD COLUMN IF NOT EXISTS reply_to_text TEXT`,
		// CreateReview робить ON CONFLICT (deal_id) — без цього індексу
		// Postgres відповідає 42P10 і жоден відгук не зберігається
		// Унікальність по парі (угода, автор): сторін дві, кожна лишає свій
		// відгук. Індекс лише на deal_id давав друге збереження поверх першого,
		// а рейтинг нового адресата після цього ставав 0.00. DROP обов'язковий —
		// інакше старий індекс перетворює другий відгук на 23505.
		`DROP INDEX IF EXISTS reviews_deal_id_key`,
		`CREATE UNIQUE INDEX IF NOT EXISTS reviews_deal_reviewer_key ON reviews (deal_id, reviewer_id)`,
		// реєстрація розраховує на помилку бази при повторній пошті,
		// а два акаунти з однією поштою означають вхід у випадковий з них
		`CREATE UNIQUE INDEX IF NOT EXISTS users_email_key ON users (email)`,
		// UpdateProfile писав порожній рядок замість NULL, а users_phone_number_key
		// пускає його лише в один рядок: другий, хто зберігав профіль, діставав 500.
		// Прибираємо вже записані порожні рядки, інакше індекс так і тримає місце.
		`UPDATE users SET phone_number = NULL WHERE phone_number = ''`,
	} {
		if _, err := db.Exec(stmt); err != nil {
			log.Printf("⚠️ Схема: не вдалося виконати %q: %v", stmt, err)
		}
	}

	// Реєстрація через пошту писала пароль у password_hash як є, без bcrypt,
	// через що вхід не працював ні для кого й паролі лежали в БД відкритим
	// текстом. Перехешовуємо те, що вже збереглося: bcrypt починається з "$2",
	// тому повторний запуск нічого не змінює. Порожній хеш — акаунти
	// Google/Telegram, їх не торкаємось.
	rehashPlaintextPasswords(db)

	redisAddr := os.Getenv("REDIS_ADDR")
	if redisAddr == "" {
		redisAddr = "localhost:6379"
	}
	rdb := redis.NewClient(&redis.Options{
		Addr:     redisAddr,
		Password: os.Getenv("REDIS_PASSWORD"),
		DB:       0,
	})
	if _, err := rdb.Ping(context.Background()).Result(); err != nil {
		log.Printf("⚠️ Не вдалося підключитися до Redis (кеш не працюватиме): %v", err)
	} else {
		log.Println("⚡ Redis успішно підключено")
	}

	userRepo := postgres.NewUserRepository(db, rdb)
	emailSvc := service.NewEmailService()
	go emailSvc.Start()

	aiSvc := service.NewAIService()

	userUC := usecase.NewUserUseCase(userRepo, emailSvc, aiSvc)

	botToken := os.Getenv("TELEGRAM_BOT_TOKEN")
	if botToken != "" {
		tgBot, err := bot.NewBot(botToken, userUC)
		if err != nil {
			log.Fatalf("❌ Не вдалося запустити Telegram-бота: %v", err)
		}
		userUC.SetNotifier(tgBot)

		go tgBot.Start()
	} else {
		log.Println("⚠️ Попередження: TELEGRAM_BOT_TOKEN не заданий у файлі .env, бот вимкнений")
	}

	go func() {
		for {
			if err := userUC.CleanStaleDeals(context.Background()); err != nil {
				log.Printf("Помилка роботи прибиральника угод: %v\n", err)
			}

			if err := userUC.CheckUpcomingLessons(context.Background()); err != nil {
				log.Printf("Помилка роботи нагадувань: %v\n", err)
			}

			time.Sleep(5 * time.Minute)
		}
	}()

	router := gin.Default()

	// Список origin спільний з перевіркою при апгрейді WebSocket.
	allowedOrigins := deliveryHttp.AllowedOrigins()
	router.Use(cors.New(cors.Config{
		AllowOrigins:     allowedOrigins,
		AllowMethods:     []string{"POST", "GET", "OPTIONS", "PUT", "DELETE"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Accept", "Authorization", "X-Requested-With"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))

	handler := deliveryHttp.NewHandler(userUC)
	handler.InitRoutes(router)

	// Cloud Run (і взагалі будь-який serverless-хостинг) сам призначає порт
	// через змінну PORT — слухати треба саме на ньому, інакше health-check впаде.
	port := os.Getenv("PORT")
	if port == "" {
		port = "3000"
	}
	addr := ":" + port
	log.Printf("🚀 API сервер запущений на порту %s", port)
	if err := router.Run(addr); err != nil {
		log.Fatalf("Помилка під час запуску сервера: %s", err.Error())
	}
}

type plaintextPassword struct {
	ID   string `db:"id"`
	Hash string `db:"password_hash"`
}

func rehashPlaintextPasswords(db *sqlx.DB) {
	var rows []plaintextPassword
	err := db.Select(&rows, `
		SELECT id, password_hash FROM users
		WHERE password_hash IS NOT NULL
		  AND password_hash <> ''
		  AND left(password_hash, 2) <> '$2'`)
	if err != nil {
		log.Printf("⚠️ Не вдалося перевірити паролі: %v", err)
		return
	}
	if len(rows) == 0 {
		return
	}

	fixed := 0
	for _, r := range rows {
		hash, err := bcrypt.GenerateFromPassword([]byte(r.Hash), bcrypt.DefaultCost)
		if err != nil {
			log.Printf("⚠️ Не вдалося перехешувати пароль користувача %s: %v", r.ID, err)
			continue
		}
		if _, err := db.Exec(`UPDATE users SET password_hash = $1 WHERE id = $2`, string(hash), r.ID); err != nil {
			log.Printf("⚠️ Не вдалося зберегти хеш для користувача %s: %v", r.ID, err)
			continue
		}
		fixed++
	}
	log.Printf("🔐 Перехешовано паролів, що зберігались у відкритому вигляді: %d з %d", fixed, len(rows))
}
