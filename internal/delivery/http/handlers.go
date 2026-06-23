package http

import (
	"crypto/rand"
	"fmt"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
	"math/big"
	"net/http"
	"net/smtp"
	"os"
	"skillswap-irpin/internal/auth"
	"skillswap-irpin/internal/domain"
	"strconv"
	"time"
)

type Handler struct {
	userUC domain.UserUseCase
}

type loginInput struct {
	Code string `json:"code" binding:"required"`
}

type createDealInput struct {
	SkillID     string `json:"skill_id" binding:"required"`
	InitiatorID string `json:"initiator_id" binding:"required"`
}

type addSkillInput struct {
	UserID      string  `json:"user_id" binding:"required"`
	Type        string  `json:"type" binding:"required"`
	Title       string  `json:"title" binding:"required"`
	Description *string `json:"description"`
	Price       int     `json:"price" binding:"required"`
}

type AdminUserUpdateRequest struct {
	Username       string  `json:"username"`
	Email          string  `json:"email"`
	PhoneNumber    string  `json:"phone_number"`
	BalanceMinutes int     `json:"balance_minutes"`
	Role           string  `json:"role"`
	Rating         float64 `json:"rating"`
}

type updateProfileInput struct {
	Username    *string `json:"username"`
	PhoneNumber *string `json:"phone_number"`
	Bio         *string `json:"bio"`
	AvatarURL   *string `json:"avatar_url"`
}

type registerInput struct {
	TelegramID  int64   `json:"telegram_id" binding:"required"`
	Username    *string `json:"username"`
	PhoneNumber *string `json:"phone_number"`
}

type createReviewInput struct {
	ReviewerID string  `json:"reviewer_id" binding:"required"`
	TargetID   string  `json:"target_id" binding:"required"`
	Score      int     `json:"score" binding:"required"`
	Comment    *string `json:"comment"`
}

type uriInput struct {
	TelegramID int64 `uri:"id" binding:"required"`
}

type loginEmailInput struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

type updateDealStatusInput struct {
	Status      string     `json:"status" binding:"required"`
	ScheduledAt *time.Time `json:"scheduled_at"`
}

type googleLoginInput struct {
	Token string `json:"token" binding:"required"`
}

type registerEmailInput struct {
	Email    string `json:"email" binding:"required"`
	Password string `json:"password" binding:"required"`
	Username string `json:"username" binding:"required"`
}

type createNewsInput struct {
	Title   string `json:"title" binding:"required"`
	Content string `json:"content" binding:"required"`
}

type updateNewsInput struct {
	Title   string `json:"title" binding:"required"`
	Content string `json:"content" binding:"required"`
}

func NewHandler(userUC domain.UserUseCase) *Handler {
	return &Handler{userUC: userUC}
}

func (h *Handler) InitRoutes(router *gin.Engine) {
	api := router.Group("/api")
	{
		authGroup := api.Group("/users")
		authGroup.Use(RateLimitAuth())
		{
			authGroup.POST("/register", h.registerUser)
			authGroup.POST("/login", h.loginUser)
			authGroup.POST("/login/email", h.loginWithEmail)
			authGroup.POST("/login/google", h.googleLogin)
			authGroup.POST("/register/email", h.registerEmail)
			authGroup.POST("/verify-email/send", h.sendEmailVerification)
			authGroup.POST("/verify-email/confirm", h.confirmEmailVerification)
		}

		// Решта публічних маршрутів без лімітів
		api.GET("/cities", h.GetCities)
		api.GET("/news", h.GetNews)
		api.GET("/feed/", h.getFeed)

		// 👇 ПЕРЕНЕСЕНО СЮДИ 👇
		// Вебсокет має власну перевірку токена через параметр ?token=
		api.GET("/ws", h.WebSocketChat)

		// 👇 ПЕРЕНЕСЕНО СЮДИ 👇
		// Дані публічного профілю (доступні для перегляду всім)
		api.GET("/users/public/:id", h.getPublicProfile)
		api.GET("/users/:id/reviews", h.getUserReviews)
		api.GET("/users/:id/achievements", h.GetUserAchievements)
		api.GET("/skills/:user_id", h.getUserSkills)
		api.GET("/leaderboard", h.GetLeaderboard)

		// 2. ЗАХИЩЕНІ МАРШРУТИ (жорстко вимагають Authorization: Bearer токен)
		protected := api.Group("/")
		protected.Use(AuthMiddleware())
		{
			protected.POST("/reports", h.CreateReport)
			protected.GET("/feed/matches", h.getMatches)
			protected.GET("/users/profile/:id", h.getProfile)

			// 3. МАРШРУТИ ВЛАСНИКА (доступні ТІЛЬКИ власнику акаунта)
			userOwn := protected.Group("/users/:id")
			userOwn.Use(UserOwnershipMiddleware())
			{
				userOwn.GET("/chats", h.GetUserChats)
				userOwn.GET("/chats/:partnerId", h.GetChatHistory)
				userOwn.PUT("/chats/:partnerId/read", h.MarkChatAsRead)
				userOwn.DELETE("/chats/:partnerId", h.DeleteChat)
				userOwn.PUT("/pin/:partnerId", h.TogglePin)
				userOwn.PUT("/block/:partnerId", h.ToggleBlock)
				userOwn.GET("/chat-preferences", h.GetChatPreferences)
				userOwn.PUT("/fullname", h.SetFullName)
				userOwn.POST("/telegram-link", h.GenerateTelegramLink)
				userOwn.POST("/claim-bonus", h.ClaimAchievementBonus)
			}

			// Оновлення профілю
			protected.PUT("/users/profile/:userId", h.UpdateProfile)

			// Навички
			skills := protected.Group("/skills")
			{
				skills.POST("/", h.addSkill)
				skills.PUT("/:id/toggle", h.toggleSkill)
				skills.DELETE("/:id", h.deleteSkill)
			}

			// Угоди
			deals := protected.Group("/deals")
			{
				deals.POST("/", h.createDeal)
				deals.GET("/incoming/:user_id", h.getIncomingDeals)
				deals.PUT("/:deal_id/status", h.updateDealStatus)
				deals.POST("/:deal_id/review", h.createReview)
				deals.GET("/outgoing/:user_id", h.getOutgoingDeals)
			}

			// 4. АДМІНСЬКІ МАРШРУТИ
			admin := protected.Group("/admin")
			admin.Use(AdminMiddleware())
			{
				admin.POST("/news", h.CreateNews)
				admin.DELETE("/news/:id", h.DeleteNews)
				admin.PUT("/news/:id", h.UpdateNews)
				admin.GET("/stats", h.getAdminStats)
				admin.PUT("/users/:id", h.UpdateUserByAdmin)
				admin.POST("/users", h.CreateUserByAdmin)
				admin.PUT("/users/:id/ban", h.toggleBan)
				admin.PUT("/deals/:id/cancel", h.adminCancelDeal)
				admin.GET("/deals", h.getAllDealsAdmin)
				admin.GET("/skills", h.getAdminSkills)
				admin.DELETE("/skills/:id", h.deleteAdminSkill)
				admin.PUT("/skills/:id", h.UpdateAdminSkill)
				admin.GET("/reports", h.GetReportsAdmin)
				admin.PUT("/reports/:id/resolve", h.ResolveReportAdmin)
			}
		}
	}
}

func (h *Handler) registerUser(c *gin.Context) {
	var input registerInput
	if err := c.BindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Неверный формат данных"})
		return
	}

	user, err := h.userUC.RegisterUser(c.Request.Context(), input.TelegramID, input.Username, input.PhoneNumber)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Пользователь успешно зарегистрирован",
		"user":    user,
	})
}

func (h *Handler) loginUser(c *gin.Context) {
	var input loginInput
	if err := c.BindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Відсутній код підтвердження"})
		return
	}

	user, err := h.userUC.VerifyAuthCode(c.Request.Context(), input.Code)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}

	//JWT
	token, err := auth.GenerateToken(user.ID, user.Role)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Помилка генерації ключа"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Успішний вхід",
		"token":   token,
		"user":    user,
	})
}

func (h *Handler) getProfile(c *gin.Context) {
	// Беремо ID напряму як рядок (UUID)
	userID := c.Param("id")
	if userID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Невірний ID"})
		return
	}

	// Використовуємо GetUserByID, який чудово працює з UUID
	user, err := h.userUC.GetUserByID(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Користувача не знайдено"})
		return
	}

	c.JSON(http.StatusOK, user)
}

func (h *Handler) getAdminStats(c *gin.Context) {
	stats, err := h.userUC.GetSystemStats(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Помилка завантаження статистики бази даних"})
		return
	}

	users, err := h.userUC.GetAllUsers(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Помилка завантаження користувачів"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"stats": stats,
		"users": users,
	})
}

func (h *Handler) addSkill(c *gin.Context) {
	var input addSkillInput
	if err := c.BindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Неправильний формат даних"})
		return
	}

	err := h.userUC.AddSkill(c.Request.Context(), input.UserID, input.Type, input.Title, input.Description, input.Price)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Навичку успішно додано!"})
}

func (h *Handler) getUserSkills(c *gin.Context) {
	userID := c.Param("user_id")

	skills, err := h.userUC.GetUserSkills(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"skills": skills})
}

func (h *Handler) getFeed(c *gin.Context) {
	search := c.Query("search")
	filterType := c.Query("type")
	cityID := c.Query("city_id")
	minPrice := c.Query("min_price")
	maxPrice := c.Query("max_price")
	minRating := c.Query("min_rating")

	feed, err := h.userUC.GetAllFeed(c.Request.Context(), search, filterType, cityID, minPrice, maxPrice, minRating)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Помилка завантаження стрічки"})
		return
	}

	if feed == nil {
		feed = []domain.FeedItem{}
	}

	c.JSON(http.StatusOK, gin.H{"feed": feed})
}

func (h *Handler) createDeal(c *gin.Context) {
	var input createDealInput
	if err := c.BindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Неправильний формат даних"})
		return
	}

	err := h.userUC.CreateDeal(c.Request.Context(), input.SkillID, input.InitiatorID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Заявку успішно відправлено!"})
}

func (h *Handler) getIncomingDeals(c *gin.Context) {
	userID := c.Param("user_id")

	deals, err := h.userUC.GetIncomingDeals(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"deals": deals})
}

func (h *Handler) getOutgoingDeals(c *gin.Context) {
	userID := c.Param("user_id")
	deals, err := h.userUC.GetOutgoingDeals(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"deals": deals})
}

func (h *Handler) UpdateProfile(c *gin.Context) {
	userID := c.Param("userId")

	var req struct {
		Username  *string `json:"username"`
		Phone     *string `json:"phone_number"`
		Bio       *string `json:"bio"`
		AvatarURL *string `json:"avatar_url"`
		CityID    *int    `json:"city_id"`
		BirthDate *string `json:"birth_date"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Невірні дані"})
		return
	}

	err := h.userUC.UpdateProfile(c.Request.Context(), userID, req.Username, req.Phone, req.Bio, req.AvatarURL, req.CityID, req.BirthDate)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Помилка оновлення профілю"})
		return
	}

	c.Status(http.StatusOK)
}

func (h *Handler) createReview(c *gin.Context) {
	dealID := c.Param("deal_id")
	var input createReviewInput

	if err := c.BindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Неправильний формат даних"})
		return
	}

	if input.Score < 1 || input.Score > 5 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Оцінка має бути від 1 до 5"})
		return
	}

	err := h.userUC.CreateReview(c.Request.Context(), dealID, input.ReviewerID, input.TargetID, input.Score, input.Comment)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Дякуємо за ваш відгук!"})
}

func (h *Handler) registerWithEmail(c *gin.Context) {
	var input registerEmailInput
	if err := c.BindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Неверный формат. Проверьте почту и пароль (мин. 6 символов)"})
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(input.Password), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка при шифровании пароля"})
		return
	}

	user, err := h.userUC.CreateUserWithEmail(c.Request.Context(), input.Email, string(hash), input.Username)
	if err != nil {
		c.JSON(http.StatusConflict, gin.H{"error": "Пользователь с таким email уже существует"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Регистрация успешна!", "user": user})
}

func (h *Handler) loginWithEmail(c *gin.Context) {
	var input loginEmailInput
	if err := c.BindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Заполните все поля"})
		return
	}

	user, err := h.userUC.GetUserByEmail(c.Request.Context(), input.Email)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Неверный email или пароль"})
		return
	}

	if user.PasswordHash == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Этот аккаунт привязан к Telegram. Войдите через Telegram."})
		return
	}

	err = bcrypt.CompareHashAndPassword([]byte(*user.PasswordHash), []byte(input.Password))
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Неверный email или пароль"})
		return
	}

	token, err := auth.GenerateToken(user.ID, user.Role)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка генерации токена"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Успешный вход", "token": token, "user": user})
}

func (h *Handler) updateDealStatus(c *gin.Context) {
	dealID := c.Param("deal_id")
	var input updateDealStatusInput

	if err := c.BindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Неправильний формат даних"})
		return
	}

	var err error
	if input.Status == "completed" {
		err = h.userUC.CompleteDeal(c.Request.Context(), dealID)
	} else {
		err = h.userUC.UpdateDealStatus(c.Request.Context(), dealID, input.Status, input.ScheduledAt)
	}

	if err != nil {
		fmt.Printf("\n🔴🔴🔴 ПОМИЛКА БАЗИ: %v 🔴🔴🔴\n\n", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Статус успішно оновлено!"})
}

func (h *Handler) UpdateUserByAdmin(c *gin.Context) {
	userID := c.Param("id")
	var input AdminUserUpdateRequest

	if err := c.BindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Невалідні дані"})
		return
	}

	err := h.userUC.AdminUpdateUser(
		c.Request.Context(),
		userID,
		input.BalanceMinutes,
		input.Rating,
		input.PhoneNumber,
		input.Username,
		input.Email,
		input.Role,
	)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Не вдалося оновити користувача"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Користувача успішно оновлено"})
}

func (h *Handler) CreateUserByAdmin(c *gin.Context) {
	c.JSON(http.StatusNotImplemented, gin.H{"message": "Функція створення користувача ще в розробці"})
}

func (h *Handler) toggleSkill(c *gin.Context) {
	skillID := c.Param("id")
	if err := h.userUC.ToggleSkill(c.Request.Context(), skillID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Статус навички змінено!"})
}

func (h *Handler) deleteSkill(c *gin.Context) {
	skillID := c.Param("id")
	if err := h.userUC.DeleteSkill(c.Request.Context(), skillID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Навичку видалено!"})
}

func (h *Handler) googleLogin(c *gin.Context) {
	var input googleLoginInput
	if err := c.BindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Неправильний формат даних"})
		return
	}

	token, user, err := h.userUC.GoogleLogin(c.Request.Context(), input.Token)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"token": token,
		"user":  user,
	})
}

func generate6DigitCode() string {
	max := big.NewInt(1000000)
	n, _ := rand.Int(rand.Reader, max)
	return fmt.Sprintf("%06d", n.Int64())
}
func (h *Handler) sendEmailVerification(c *gin.Context) {
	var input struct {
		Email string `json:"email"`
	}
	if err := c.BindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Не вказано email"})
		return
	}

	code := generate6DigitCode()

	if err := h.userUC.SetEmailCode(c.Request.Context(), input.Email, code); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Помилка бази даних"})
		return
	}

	smtpEmail := os.Getenv("SMTP_EMAIL")
	smtpPassword := os.Getenv("SMTP_PASSWORD")
	smtpHost := "smtp.gmail.com"
	smtpPort := "587"

	if smtpEmail == "" || smtpPassword == "" {
		fmt.Println("🚨 ПОМИЛКА: Не задано SMTP_EMAIL або SMTP_PASSWORD у файлі .env")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Помилка конфігурації сервера пошти"})
		return
	}

	auth := smtp.PlainAuth("", smtpEmail, smtpPassword, smtpHost)
	msg := []byte("Subject: Код підтвердження SkillSwap\r\n\r\nВаш код для підтвердження пошти: " + code)
	err := smtp.SendMail(smtpHost+":"+smtpPort, auth, smtpEmail, []string{input.Email}, msg)

	if err != nil {
		fmt.Printf("🚨 Помилка відправки листа: %v\n", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Не вдалося відправити лист"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Код відправлено!"})
}

func (h *Handler) confirmEmailVerification(c *gin.Context) {
	var input struct {
		UserID string `json:"user_id"`
		Email  string `json:"email"`
		Code   string `json:"code"`
	}
	if err := c.BindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Невірні дані"})
		return
	}

	if err := h.userUC.VerifyEmailCode(c.Request.Context(), input.Email, input.Code); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.userUC.LinkEmail(c.Request.Context(), input.UserID, input.Email); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ця пошта вже зайнята або сталася помилка"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Email успішно підтверджено!"})
}

func (h *Handler) registerEmail(c *gin.Context) {
	var input registerEmailInput
	if err := c.BindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Не всі поля заповнені"})
		return
	}

	user, err := h.userUC.CreateUserWithEmail(c.Request.Context(), input.Email, input.Password, input.Username)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Помилка реєстрації. Можливо, такий email вже існує."})
		return
	}

	token, err := auth.GenerateToken(user.ID, user.Role)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Помилка генерації токена"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"token": token,
		"user":  user,
	})
}

func (h *Handler) toggleBan(c *gin.Context) {
	userID := c.Param("id")
	if err := h.userUC.ToggleBan(c.Request.Context(), userID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Помилка блокування"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Статус блокування змінено!"})
}

func (h *Handler) adminCancelDeal(c *gin.Context) {
	dealID := c.Param("id")
	if err := h.userUC.UpdateDealStatus(c.Request.Context(), dealID, "cancelled", nil); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Не вдалося скасувати угоду"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Угоду примусово скасовано!"})
}

func (h *Handler) getAllDealsAdmin(c *gin.Context) {
	deals, err := h.userUC.GetAllDealsAdmin(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Помилка завантаження угод"})
		return
	}

	if deals == nil {
		deals = []domain.AdminDeal{}
	}

	c.JSON(http.StatusOK, gin.H{"deals": deals})
}

func (h *Handler) getPublicProfile(c *gin.Context) {
	user, err := h.userUC.GetUserByID(c.Request.Context(), c.Param("id"))
	if err != nil {
		c.JSON(404, gin.H{"error": "Користувача не знайдено"})
		return
	}
	c.JSON(200, user)
}

func (h *Handler) getUserReviews(c *gin.Context) {
	reviews, err := h.userUC.GetUserReviews(c.Request.Context(), c.Param("id"))
	if err != nil {
		c.JSON(500, gin.H{"error": "Помилка"})
		return
	}
	if reviews == nil {
		reviews = []domain.ReviewResponse{}
	}
	c.JSON(200, gin.H{"reviews": reviews, "count": len(reviews)})
}

func (h *Handler) getAdminSkills(c *gin.Context) {
	skills, err := h.userUC.GetAllSkillsAdmin(c.Request.Context())
	if err != nil {
		c.JSON(500, gin.H{"error": "Помилка бази"})
		return
	}
	if skills == nil {
		skills = []domain.AdminSkill{}
	}
	c.JSON(200, gin.H{"skills": skills})
}

func (h *Handler) deleteAdminSkill(c *gin.Context) {
	if err := h.userUC.AdminDeleteSkill(c.Request.Context(), c.Param("id")); err != nil {
		c.JSON(500, gin.H{"error": "Не вдалося видалити"})
		return
	}
	c.JSON(200, gin.H{"message": "Видалено!"})
}

func (h *Handler) GetNews(c *gin.Context) {
	uidStr := c.Query("user_id")

	if uidStr == "" {
		userID, _ := c.Get("userId")
		if v, ok := userID.(string); ok {
			uidStr = v
		}
	}

	news, err := h.userUC.GetNews(c.Request.Context(), uidStr)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Не вдалося отримати новини"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"news": news})
}

func (h *Handler) CreateNews(c *gin.Context) {
	var input createNewsInput
	if err := c.BindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Невалидные данные"})
		return
	}

	if err := h.userUC.CreateNews(c.Request.Context(), input.Title, input.Content); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Не удалось создать новость"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Новость успешно опубликована!"})
}

func (h *Handler) DeleteNews(c *gin.Context) {
	idParam := c.Param("id")
	id, err := strconv.Atoi(idParam)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Невірний ID новини"})
		return
	}

	if err := h.userUC.DeleteNews(c.Request.Context(), id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Не вдалося видалити новину"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Новину успішно видалено!"})
}

func (h *Handler) UpdateNews(c *gin.Context) {
	idParam := c.Param("id")
	id, err := strconv.Atoi(idParam)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Невірний ID новини"})
		return
	}

	var input updateNewsInput
	if err := c.BindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Невалідні дані"})
		return
	}

	if err := h.userUC.UpdateNews(c.Request.Context(), id, input.Title, input.Content); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Не вдалося оновити новину"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Новину успішно оновлено!"})
}

func (h *Handler) GetDealMessages(c *gin.Context) {
	dealID := c.Param("id")
	msgs, err := h.userUC.GetDealMessages(c.Request.Context(), dealID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Помилка завантаження повідомлень"})
		return
	}

	if msgs == nil {
		msgs = []domain.Message{}
	}
	c.JSON(http.StatusOK, msgs)
}

func (h *Handler) GetChatHistory(c *gin.Context) {
	userID := c.Param("id")
	partnerID := c.Param("partnerId")

	msgs, err := h.userUC.GetChatHistory(c.Request.Context(), userID, partnerID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Помилка завантаження чату"})
		return
	}
	if msgs == nil {
		msgs = []domain.Message{}
	}
	c.JSON(http.StatusOK, msgs)
}

func (h *Handler) GetUserChats(c *gin.Context) {
	userID := c.Param("id")

	chats, err := h.userUC.GetUserChats(c.Request.Context(), userID)
	if err != nil {
		fmt.Printf("🚨 ПОМИЛКА SQL (GetUserChats): %v\n", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Помилка завантаження списку чатів"})
		return
	}

	if chats == nil {
		chats = []domain.ChatContact{}
	}
	c.JSON(http.StatusOK, chats)
}

func (h *Handler) MarkChatAsRead(c *gin.Context) {
	userID := c.Param("id")
	partnerID := c.Param("partnerId")

	h.userUC.MarkChatAsRead(c.Request.Context(), userID, partnerID)

	manager.mu.Lock()
	for clientConn := range manager.clients[partnerID] {
		clientConn.WriteJSON(map[string]interface{}{
			"type":      "read_receipt",
			"reader_id": userID,
		})
	}
	manager.mu.Unlock()

	c.Status(http.StatusOK)
}

func (h *Handler) getMatches(c *gin.Context) {
	userID := c.Query("user_id")
	if userID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Не вказано user_id"})
		return
	}

	matches, err := h.userUC.GetMatches(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Помилка завантаження рекомендацій"})
		return
	}

	if matches == nil {
		matches = []domain.FeedItem{}
	}

	c.JSON(http.StatusOK, gin.H{"feed": matches})
}

func (h *Handler) GetCities(c *gin.Context) {
	cities, err := h.userUC.GetCities(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Не вдалося завантажити список міст"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"cities": cities})
}

func (h *Handler) SetFullName(c *gin.Context) {
	userID := c.Param("id")
	var input struct {
		FullName string `json:"full_name"`
	}
	if err := c.BindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Невірні дані"})
		return
	}

	if err := h.userUC.SetFullName(c.Request.Context(), userID, input.FullName); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.Status(http.StatusOK)
}

func (h *Handler) GenerateTelegramLink(c *gin.Context) {
	userID := c.Param("id")
	token := uuid.New().String()

	if err := h.userUC.SaveTelegramToken(c.Request.Context(), userID, token); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Не вдалося згенерувати посилання"})
		return
	}

	botLink := fmt.Sprintf("https://t.me/ТВІЙ_БОТ?start=%s", token)
	c.JSON(http.StatusOK, gin.H{"url": botLink})
}

func (h *Handler) DeleteChat(c *gin.Context) {
	userID := c.Param("id")
	partnerID := c.Param("partnerId")

	if err := h.userUC.DeleteChatHistory(c.Request.Context(), userID, partnerID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Не вдалося видалити чат"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Чат успішно видалено"})
}

func (h *Handler) TogglePin(c *gin.Context) {
	if err := h.userUC.ToggleChatPin(c.Request.Context(), c.Param("id"), c.Param("partnerId")); err != nil {
		c.JSON(500, gin.H{"error": "Помилка"})
		return
	}
	c.Status(200)
}

func (h *Handler) ToggleBlock(c *gin.Context) {
	if err := h.userUC.ToggleUserBlock(c.Request.Context(), c.Param("id"), c.Param("partnerId")); err != nil {
		c.JSON(500, gin.H{"error": "Помилка"})
		return
	}
	c.Status(200)
}

func (h *Handler) GetChatPreferences(c *gin.Context) {
	prefs, err := h.userUC.GetChatPreferences(c.Request.Context(), c.Param("id"))
	if err != nil {
		c.JSON(500, gin.H{"error": "Помилка"})
		return
	}
	if prefs == nil {
		prefs = []domain.ChatPreference{}
	}
	c.JSON(200, prefs)
}

func (h *Handler) UpdateAdminSkill(c *gin.Context) {
	var input struct {
		Title    string `json:"title"`
		Price    int    `json:"price"`
		IsActive bool   `json:"is_active"`
	}
	if err := c.BindJSON(&input); err != nil {
		c.JSON(400, gin.H{"error": "Невірні дані"})
		return
	}

	if err := h.userUC.AdminUpdateSkill(c.Request.Context(), c.Param("id"), input.Title, input.Price, input.IsActive); err != nil {
		c.JSON(500, gin.H{"error": "Помилка оновлення"})
		return
	}
	c.JSON(200, gin.H{"message": "Оголошення оновлено!"})
}

func (h *Handler) GetLeaderboard(c *gin.Context) {
	leaders, err := h.userUC.GetLeaderboard(c.Request.Context())
	if err != nil {
		c.JSON(500, gin.H{"error": "Помилка завантаження лідерів"})
		return
	}
	c.JSON(200, gin.H{"leaderboard": leaders})
}

func (h *Handler) GetUserAchievements(c *gin.Context) {
	badges, err := h.userUC.GetUserAchievements(c.Request.Context(), c.Param("id"))
	if err != nil {
		c.JSON(500, gin.H{"error": "Помилка завантаження досягнень"})
		return
	}
	c.JSON(200, gin.H{"achievements": badges})
}

func (h *Handler) ClaimAchievementBonus(c *gin.Context) {
	var req struct {
		AchievementID string `json:"achievement_id"`
	}
	if err := c.BindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": "Невірний формат даних"})
		return
	}

	err := h.userUC.ClaimAchievementBonus(c.Request.Context(), c.Param("id"), req.AchievementID)
	if err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}
	c.JSON(200, gin.H{"message": "Бонус успішно нараховано!"})
}

type createReportInput struct {
	TargetType string  `json:"target_type" binding:"required"`
	TargetID   string  `json:"target_id" binding:"required"`
	Reason     string  `json:"reason" binding:"required"`
	Details    *string `json:"details"`
}

func (h *Handler) CreateReport(c *gin.Context) {
	var input createReportInput
	if err := c.BindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Неправильні дані"})
		return
	}

	userID, exists := c.Get("userId")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Неавторизовано"})
		return
	}

	if err := h.userUC.CreateReport(c.Request.Context(), userID.(string), input.TargetType, input.TargetID, input.Reason, input.Details); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Помилка створення скарги"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Скаргу успішно відправлено. Дякуємо!"})
}

func (h *Handler) GetReportsAdmin(c *gin.Context) {
	reports, err := h.userUC.GetPendingReports(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Помилка завантаження скарг"})
		return
	}
	if reports == nil {
		reports = []domain.Report{}
	}
	c.JSON(http.StatusOK, gin.H{"reports": reports})
}

func (h *Handler) ResolveReportAdmin(c *gin.Context) {
	var input struct {
		Status string `json:"status" binding:"required"`
	}
	if err := c.BindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Невірний статус"})
		return
	}

	if err := h.userUC.ResolveReport(c.Request.Context(), c.Param("id"), input.Status); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Не вдалося оновити статус"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Статус скарги змінено"})
}
