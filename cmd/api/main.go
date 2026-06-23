package main

import (
	"context"
	"log"
	"os"
	"skillswap-irpin/internal/service"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	_ "github.com/jackc/pgx/v5/stdlib"
	"github.com/jmoiron/sqlx"
	"github.com/joho/godotenv"
	"github.com/redis/go-redis/v9"

	"skillswap-irpin/internal/bot"
	deliveryHttp "skillswap-irpin/internal/delivery/http"
	"skillswap-irpin/internal/repository/postgres"
	"skillswap-irpin/internal/usecase"
)

func main() {
	if err := godotenv.Load(); err != nil {
		log.Println("⚠️ Попередження: файл .env не знайдено, перевірте налаштування")
	}

	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		log.Fatal("КРИТИЧНО: DATABASE_URL не знайдено у файлі .env!")
	}
	db, err := sqlx.Connect("pgx", dsn)
	if err != nil {
		log.Fatalf("❌ Не вдалося підключитися до БД: %v", err)
	}
	defer db.Close()
	log.Println("✅ БД успішно підключена")

	rdb := redis.NewClient(&redis.Options{
		Addr:     "localhost:6379",
		Password: "",
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

	// ОНОВЛЕНА КОНФІГУРАЦІЯ CORS
	router.Use(cors.New(cors.Config{
		// Хардкодим всё, что нужно для работы
		AllowOrigins:     []string{"https://synapse.tel", "https://www.synapse.tel"},
		AllowMethods:     []string{"POST", "GET", "OPTIONS", "PUT", "DELETE"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Accept", "Authorization", "X-Requested-With"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))

	handler := deliveryHttp.NewHandler(userUC)
	handler.InitRoutes(router)

	port := ":3000"
	log.Printf("🚀 API сервера запущений і доступний для фронтенду через тунель на порту %s", port)
	if err := router.Run(port); err != nil {
		log.Fatalf("Помилка під час запуску сервера: %s", err.Error())
	}
}
