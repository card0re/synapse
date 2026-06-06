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

	dsn := "postgres://root:***REMOVED-DB-PASSWORD***@localhost:5432/skillswap?sslmode=disable"
	db, err := sqlx.Connect("pgx", dsn)
	if err != nil {
		log.Fatalf("❌ Не удалось подключиться к БД: %v", err)
	}
	defer db.Close()
	log.Println("✅ БД успешно подключена")

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

	router.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"http://localhost:5173", "http://localhost:5174"},
		AllowMethods:     []string{"POST", "GET", "OPTIONS", "PUT", "DELETE"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Accept", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
	}))

	handler := deliveryHttp.NewHandler(userUC)
	handler.InitRoutes(router)

	port := ":3000"
	log.Printf("🚀 API сервер запущен по адресу http://localhost%s", port)
	if err := router.Run(port); err != nil {
		log.Fatalf("Ошибка при запуске сервера: %s", err.Error())
	}
}
