package http

import (
	"crypto/rand"
	"fmt"
	"github.com/card0re/synapse/internal/auth"
	"github.com/card0re/synapse/internal/domain"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
	"log"
	"math/big"
	"net/http"
	"strconv"
	"time"
)

// serverError логує справжню причину і віддає клієнту загальне повідомлення.
// Помилки з шару репозиторію несуть у собі SQL і назви таблиць — це підказка
// для того, хто шукає, за що зачепитись, а користувачу вона все одно ні про
// що не каже.
func serverError(c *gin.Context, err error) {
	log.Printf("500 %s %s: %v", c.Request.Method, c.Request.URL.Path, err)
	c.JSON(http.StatusInternalServerError, gin.H{"error": "Внутрішня помилка сервера"})
}

type Handler struct {
	userUC domain.UserUseCase
}

// currentUserID — ID власника токена. Усе, що стосується чужого акаунта чи
// чужих хвилин, має звірятися саме з ним, а не з полем у тілі запиту:
// тіло пише клієнт, і туди можна вписати будь-який UUID.
func currentUserID(c *gin.Context) string {
	v, _ := c.Get("userId")
	s, _ := v.(string)
	return s
}

// isAdmin вимагає обидва клейми: роль і підтверджену пошту єдиного адміна.
// Самої ролі замало — токени, видані за старим правилом (колонка users.role),
// пошти не несуть, і адмінських обходів більше не дають.
func isAdmin(c *gin.Context) bool {
	return c.GetString("userRole") == "admin" && auth.IsAdminEmail(c.GetString("userEmail"))
}

// issueToken — єдине місце, де вхід віддає токен. Роль у відповіді виводиться
// з тієї ж пошти, що й у токені, інакше фронт показував би адмінку тому, кому
// жодна адмінська ручка все одно не відповість. verifiedEmail непорожній лише
// у Google-вході: тільки там адресу підтвердив провайдер.
func issueToken(c *gin.Context, user *domain.User, verifiedEmail string) (string, bool) {
	token, err := auth.GenerateToken(user.ID, verifiedEmail)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Помилка генерації ключа"})
		return "", false
	}
	user.Role = auth.EffectiveRole(verifiedEmail)
	return token, true
}

type loginInput struct {
	Code string `json:"code" binding:"required"`
}

type createDealInput struct {
	SkillID string `json:"skill_id" binding:"required"`
}

type addSkillInput struct {
	Type        string  `json:"type" binding:"required"`
	Title       string  `json:"title" binding:"required"`
	Description *string `json:"description"`
	// binding:"required" відсікає лише нуль. Від'ємна ціна проходила далі й у
	// CreateDeal нараховувала хвилини замовнику замість того, щоб списати.
	// min=10 — та сама межа, що вже стоїть у формі (Profile.tsx, min="10").
	Price int `json:"price" binding:"required,min=10"`
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

// target_id свідомо немає: кого оцінюють, визначає сама угода. Поки він
// приходив у тілі, будь-який користувач ставив оцінку будь-кому — або собі.
type createReviewInput struct {
	Score   int     `json:"score" binding:"required"`
	Comment *string `json:"comment"`
}

type uriInput struct {
	TelegramID int64 `uri:"id" binding:"required"`
}

type loginEmailInput struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

// Status — закритий список: раніше будь-який рядок проходив у catch-all гілку
// репозиторію і ставав статусом угоди, зокрема вигаданий, з якого потім можна
// було повернутись у грошову гілку.
type updateDealStatusInput struct {
	Status      string     `json:"status" binding:"required,oneof=pending negotiating accepted rejected cancelled cancel_requested completed disputed"`
	ScheduledAt *time.Time `json:"scheduled_at"`
}

type googleLoginInput struct {
	Token string `json:"token" binding:"required"`
}

type registerEmailInput struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required,min=6"`
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
			// POST /register тут не було чого робити: реєстрацію з Telegram
			// бот виконує в процесі (internal/bot/telegram.go), а маршрут був
			// відкритий і на відомий telegram_id повертав чужу картку цілком —
			// з поштою, телефоном і датою народження.
			authGroup.POST("/login", h.loginUser)
			authGroup.POST("/login/email", h.loginWithEmail)
			authGroup.POST("/login/google", h.googleLogin)
			authGroup.POST("/register/email", h.registerEmail)
		}

		// Решта публічних маршрутів без лімітів
		api.GET("/cities", h.GetCities)
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
			protected.GET("/news", h.GetNews)
			// verify-email/send тепер за авторизацією: відкритий, він слав реальну
			// пошту з акаунта власника на будь-яку валідну адресу без входу.
			protected.POST("/users/verify-email/send", h.sendEmailVerification)
			protected.POST("/users/verify-email/confirm", h.confirmEmailVerification)
			protected.POST("/reports", h.CreateReport)
			protected.GET("/feed/matches", h.getMatches)
			protected.GET("/users/profile/:id", UserOwnershipMiddleware("id"), h.getProfile)

			// 3. МАРШРУТИ ВЛАСНИКА (доступні ТІЛЬКИ власнику акаунта)
			userOwn := protected.Group("/users/:id")
			userOwn.Use(UserOwnershipMiddleware("id"))
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
			protected.PUT("/users/profile/:userId", UserOwnershipMiddleware("userId"), h.UpdateProfile)
			protected.GET("/users/search", h.searchUsers)

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
				deals.GET("/incoming/:user_id", UserOwnershipMiddleware("user_id"), h.getIncomingDeals)
				deals.PUT("/:deal_id/status", h.updateDealStatus)
				deals.POST("/:deal_id/review", h.createReview)
				deals.GET("/outgoing/:user_id", UserOwnershipMiddleware("user_id"), h.getOutgoingDeals)
			}

			// 4. АДМІНСЬКІ МАРШРУТИ
			admin := protected.Group("/admin")
			admin.Use(h.RequireAdmin())
			{
				admin.GET("/news", h.GetNewsAdmin)
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

// abortIfBanned — єдине місце, де бан узагалі щось означає: далі токен видається
// на 72 години, тож бан діє з наступного входу.
func abortIfBanned(c *gin.Context, user *domain.User) bool {
	if user != nil && user.IsBanned {
		c.JSON(http.StatusForbidden, gin.H{"error": "Акаунт заблоковано адміністрацією"})
		return true
	}
	return false
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

	if abortIfBanned(c, user) {
		return
	}

	//JWT
	token, ok := issueToken(c, user, "")
	if !ok {
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

	err := h.userUC.AddSkill(c.Request.Context(), currentUserID(c), input.Type, input.Title, input.Description, input.Price)
	if err != nil {
		serverError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Навичку успішно додано!"})
}

func (h *Handler) getUserSkills(c *gin.Context) {
	userID := c.Param("user_id")

	skills, err := h.userUC.GetUserSkills(c.Request.Context(), userID)
	if err != nil {
		serverError(c, err)
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

	// Числові фільтри йдуть у типізовані колонки: нечисловий city_id=abc раніше
	// давав 500 (pgx відхиляв приведення ще до запиту). Відсікаємо на вході 400.
	for _, v := range []string{cityID, minPrice, maxPrice} {
		if v != "" {
			if _, err := strconv.Atoi(v); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Невірний фільтр"})
				return
			}
		}
	}
	if minRating != "" {
		if _, err := strconv.ParseFloat(minRating, 64); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Невірний фільтр"})
			return
		}
	}

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

	if err := h.userUC.CreateDeal(c.Request.Context(), input.SkillID, currentUserID(c)); err != nil {
		// "недостатньо хвилин", "це ваша власна навичка" — це відповідь користувачу, не 500
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Заявку успішно відправлено!"})
}

func (h *Handler) getIncomingDeals(c *gin.Context) {
	userID := c.Param("user_id")

	deals, err := h.userUC.GetIncomingDeals(c.Request.Context(), userID)
	if err != nil {
		serverError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"deals": deals})
}

func (h *Handler) getOutgoingDeals(c *gin.Context) {
	userID := c.Param("user_id")
	deals, err := h.userUC.GetOutgoingDeals(c.Request.Context(), userID)
	if err != nil {
		serverError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"deals": deals})
}

func (h *Handler) UpdateProfile(c *gin.Context) {
	userID := c.Param("userId")

	// Межі довжини: avatar_url і bio — колонки text без обмеження, а аватар
	// base64 на 200 КБ дублювався в кожен рядок публічної стрічки і в її кеш.
	var req struct {
		Username  *string `json:"username" binding:"omitempty,max=64"`
		Phone     *string `json:"phone_number" binding:"omitempty,max=32"`
		Bio       *string `json:"bio" binding:"omitempty,max=1000"`
		AvatarURL *string `json:"avatar_url" binding:"omitempty,max=300000"`
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

	// Не isDealParticipant: той для адміна повертає true, не читаючи угоду, і
	// віддати з неї другу сторону не може. Тут потрібна саме угода.
	deal, err := h.userUC.GetDealByID(c.Request.Context(), dealID)
	if err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "Відгук може залишити лише учасник угоди"})
		return
	}

	me := currentUserID(c)
	var targetID string
	switch me {
	case deal.InitiatorID:
		targetID = deal.ReceiverID
	case deal.ReceiverID:
		targetID = deal.InitiatorID
	default:
		c.JSON(http.StatusForbidden, gin.H{"error": "Відгук може залишити лише учасник угоди"})
		return
	}

	err = h.userUC.CreateReview(c.Request.Context(), dealID, me, targetID, input.Score, input.Comment)
	if err != nil {
		serverError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Дякуємо за ваш відгук!"})
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

	if user.PasswordHash == nil || *user.PasswordHash == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Цей акаунт не має пароля — увійдіть через Google або Telegram."})
		return
	}

	err = bcrypt.CompareHashAndPassword([]byte(*user.PasswordHash), []byte(input.Password))
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Неверный email или пароль"})
		return
	}

	if abortIfBanned(c, user) {
		return
	}

	token, ok := issueToken(c, user, "")
	if !ok {
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Успешный вход", "token": token, "user": user})
}

// isDealParticipant — угодою розпоряджаються лише її дві сторони (ну і адмін).
// ID угоди — звичайний UUID у посиланні, і без цієї перевірки будь-який
// залогінений користувач міг завершити або скасувати чужий урок.
func (h *Handler) isDealParticipant(c *gin.Context, dealID string) bool {
	if isAdmin(c) {
		return true
	}
	deal, err := h.userUC.GetDealByID(c.Request.Context(), dealID)
	if err != nil {
		return false
	}
	me := currentUserID(c)
	return me != "" && (deal.InitiatorID == me || deal.ReceiverID == me)
}

func (h *Handler) updateDealStatus(c *gin.Context) {
	dealID := c.Param("deal_id")
	var input updateDealStatusInput

	if err := c.BindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Неправильний формат даних"})
		return
	}

	if !h.isDealParticipant(c, dealID) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Це не ваша угода"})
		return
	}

	if err := h.userUC.UpdateDealStatus(c.Request.Context(), dealID, input.Status, input.ScheduledAt); err != nil {
		serverError(c, err)
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

// ownsSkill — оголошенням керує лише його автор: ID оголошення видно всім у стрічці.
func (h *Handler) ownsSkill(c *gin.Context, skillID string) bool {
	if isAdmin(c) {
		return true
	}
	skill, err := h.userUC.GetSkillByID(c.Request.Context(), skillID)
	if err != nil {
		return false
	}
	return skill.UserID != "" && skill.UserID == currentUserID(c)
}

func (h *Handler) toggleSkill(c *gin.Context) {
	skillID := c.Param("id")
	if !h.ownsSkill(c, skillID) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Це не ваше оголошення"})
		return
	}
	if err := h.userUC.ToggleSkill(c.Request.Context(), skillID); err != nil {
		serverError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Статус навички змінено!"})
}

func (h *Handler) deleteSkill(c *gin.Context) {
	skillID := c.Param("id")
	if !h.ownsSkill(c, skillID) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Це не ваше оголошення"})
		return
	}
	if err := h.userUC.DeleteSkill(c.Request.Context(), skillID); err != nil {
		serverError(c, err)
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

	if abortIfBanned(c, user) {
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
	// Маршрут відкритий, тож без перевірки формату сюди можна було підставити
	// будь-який рядок і слати листи куди завгодно з нашого акаунта.
	var input struct {
		Email string `json:"email" binding:"required,email"`
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

	// Лист відправляє SetEmailCode через чергу email-воркера. Раніше той самий
	// код додатково слався ще й звідси — користувач отримував два однакові листи.
	c.JSON(http.StatusOK, gin.H{"message": "Код відправлено!"})
}

func (h *Handler) confirmEmailVerification(c *gin.Context) {
	var input struct {
		Email string `json:"email"`
		Code  string `json:"code"`
	}
	if err := c.BindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Невірні дані"})
		return
	}

	if err := h.userUC.VerifyEmailCode(c.Request.Context(), input.Email, input.Code); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.userUC.LinkEmail(c.Request.Context(), currentUserID(c), input.Email); err != nil {
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

	hash, err := bcrypt.GenerateFromPassword([]byte(input.Password), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Помилка обробки пароля"})
		return
	}

	user, err := h.userUC.CreateUserWithEmail(c.Request.Context(), input.Email, string(hash), input.Username)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Помилка реєстрації. Можливо, такий email вже існує."})
		return
	}

	token, ok := issueToken(c, user, "")
	if !ok {
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
	if err := h.userUC.AdminCancelDeal(c.Request.Context(), dealID); err != nil {
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
	// Маршрут відкритий без авторизації: віддавати повну модель не можна,
	// інакше пошта, телефон і дата народження кожного користувача
	// витягуються перебором UUID.
	c.JSON(200, user.PublicView())
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
	// user_id раніше брався з query — по чужому UUID було видно чужі особисті
	// новини, зокрема причини видалення оголошень модератором.
	uidStr := currentUserID(c)

	news, err := h.userUC.GetNews(c.Request.Context(), uidStr)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Не вдалося отримати новини"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"news": news})
}

// GetNewsAdmin — повний список глобальних новин. Адмінка раніше брала
// користувацький /news: п'ять найсвіжіших упереміш з особистими.
func (h *Handler) GetNewsAdmin(c *gin.Context) {
	news, err := h.userUC.GetAllGlobalNews(c.Request.Context())
	if err != nil {
		serverError(c, err)
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
	userID := currentUserID(c)
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Неавторизовано"})
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

	botLink := fmt.Sprintf("https://t.me/skillswapirp_bot?start=%s", token)
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
		Price    int    `json:"price" binding:"required,min=10"`
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

func (h *Handler) searchUsers(c *gin.Context) {
	query := c.Query("q")
	if len(query) < 2 {
		c.JSON(http.StatusOK, gin.H{"users": []domain.User{}}) // Если запрос слишком короткий
		return
	}

	myID, exists := c.Get("userId")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Неавторизовано"})
		return
	}

	users, err := h.userUC.SearchUsers(c.Request.Context(), query, myID.(string))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Помилка пошуку користувачів"})
		return
	}

	if users == nil {
		users = []domain.User{}
	}

	c.JSON(http.StatusOK, gin.H{"users": users})
}
