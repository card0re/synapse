package usecase

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"skillswap-irpin/internal/auth"
	"skillswap-irpin/internal/domain"
	"skillswap-irpin/internal/service"
	"time"
)

type userUseCase struct {
	repo         domain.UserRepository
	notifier     domain.Notifier
	emailService service.EmailService
	aiService    service.AIService
}

func NewUserUseCase(r domain.UserRepository, emailSvc service.EmailService, aiSvc service.AIService) domain.UserUseCase {
	return &userUseCase{
		repo:         r,
		emailService: emailSvc,
		aiService:    aiSvc,
	}
}

func (u *userUseCase) SetNotifier(notifier domain.Notifier) {
	u.notifier = notifier
}

func (u *userUseCase) RegisterUser(ctx context.Context, telegramID int64, username, phone *string) (*domain.User, error) {
	existingUser, err := u.repo.GetByTelegramID(ctx, telegramID)
	if err != nil && !errors.Is(err, domain.ErrUserNotFound) {
		return nil, fmt.Errorf("помилка перевірки існуючого юзера: %w", err)
	}

	if existingUser != nil {
		return existingUser, nil
	}

	actualUsername := "Користувач"
	if username != nil {
		actualUsername = *username
	}

	newUser := &domain.User{
		TelegramID:     &telegramID,
		Username:       actualUsername,
		PhoneNumber:    phone,
		BalanceMinutes: 120,
		Rating:         5.00,
	}

	err = u.repo.Create(ctx, newUser)
	if err != nil {
		return nil, fmt.Errorf("помилка створення юзера в базі: %w", err)
	}

	return newUser, nil
}

func (u *userUseCase) GetProfile(ctx context.Context, telegramID int64) (*domain.User, error) {
	return u.repo.GetByTelegramID(ctx, telegramID)
}

func (u *userUseCase) GetAllUsers(ctx context.Context) ([]domain.User, error) {
	return u.repo.GetAll(ctx)
}

func (u *userUseCase) AddSkill(ctx context.Context, userID string, skillType string, title string, description *string, price int) error {
	skill := domain.Skill{
		UserID:      userID,
		Type:        skillType,
		Title:       title,
		Description: description,
		Price:       price,
	}
	err := u.repo.CreateSkill(ctx, &skill)
	if err != nil {
		return err
	}

	descText := ""
	if description != nil {
		descText = *description
	}

	go func(uID, sTitle, sDesc string) {
		bgCtx := context.Background()

		if u.aiService != nil {
			isOk, reason := u.aiService.ModerateSkill(bgCtx, sTitle, sDesc)

			if !isOk {
				newsTitle := "🛑 Вашу навичку видалено!"
				newsContent := fmt.Sprintf("Назва: %s\nПричина: %s\nБудь ласка, дотримуйтесь правил платформи.", sTitle, reason)

				errNews := u.repo.CreatePersonalNews(bgCtx, uID, newsTitle, newsContent)
				if errNews != nil {
					fmt.Printf("🚨 Помилка збереження персональної новини: %v\n", errNews)
				}

				user, err := u.repo.GetUserByID(bgCtx, uID)
				if err == nil && u.notifier != nil && user.TelegramID != nil {
					text := fmt.Sprintf("<b>%s</b>\n\n%s", newsTitle, newsContent)
					u.notifier.SendNotification(*user.TelegramID, text)
				}

				skills, _ := u.repo.GetUserSkills(bgCtx, uID)
				for _, s := range skills {
					if s.Title == sTitle {
						u.repo.DeleteSkill(bgCtx, s.ID)
					}
				}
			}
		}
	}(userID, title, descText)

	return nil
}

func (u *userUseCase) GetUserSkills(ctx context.Context, userID string) ([]domain.Skill, error) {
	return u.repo.GetUserSkills(ctx, userID)
}

func (u *userUseCase) GetIncomingDeals(ctx context.Context, receiverID string) ([]domain.IncomingDeal, error) {
	return u.repo.GetIncomingDeals(ctx, receiverID)
}

func (u *userUseCase) GetOutgoingDeals(ctx context.Context, initiatorID string) ([]domain.OutgoingDeal, error) {
	return u.repo.GetOutgoingDeals(ctx, initiatorID)
}

func (u *userUseCase) SetAuthCode(ctx context.Context, telegramID int64, code string) error {
	return u.repo.SetAuthCode(ctx, telegramID, code)
}

func (u *userUseCase) VerifyAuthCode(ctx context.Context, code string) (*domain.User, error) {
	return u.repo.VerifyAuthCode(ctx, code)
}

func (u *userUseCase) UpdateProfile(ctx context.Context, userID string, username *string, phone *string, bio *string, avatarURL *string, cityID *int, birthDate *string) error {
	return u.repo.UpdateProfile(ctx, userID, username, phone, bio, avatarURL, cityID, birthDate)
}

func (u *userUseCase) CreateReview(ctx context.Context, dealID, reviewerID, targetID string, score int, comment *string) error {
	return u.repo.CreateReview(ctx, dealID, reviewerID, targetID, score, comment)
}

func (u *userUseCase) GetUserByEmail(ctx context.Context, email string) (*domain.User, error) {
	return u.repo.GetUserByEmail(ctx, email)
}

func (u *userUseCase) CompleteDeal(ctx context.Context, dealID string) error {
	return u.repo.CompleteDeal(ctx, dealID)
}

func (u *userUseCase) AcceptDeal(ctx context.Context, dealID string) error {
	return u.repo.AcceptDeal(ctx, dealID)
}

func (u *userUseCase) AdminUpdateUser(ctx context.Context, userID string, balance int, rating float64, phone string, username string, email string, role string) error {
	return u.repo.AdminUpdateUser(ctx, userID, balance, rating, phone, username, email, role)
}

func (u *userUseCase) ToggleSkill(ctx context.Context, skillID string) error {
	return u.repo.ToggleSkill(ctx, skillID)
}

func (u *userUseCase) DeleteSkill(ctx context.Context, skillID string) error {
	return u.repo.DeleteSkill(ctx, skillID)
}

func (u *userUseCase) GoogleLogin(ctx context.Context, googleToken string) (string, *domain.User, error) {
	resp, err := http.Get("https://oauth2.googleapis.com/tokeninfo?id_token=" + googleToken)
	if err != nil || resp.StatusCode != http.StatusOK {
		return "", nil, errors.New("недійсний токен Google")
	}
	defer resp.Body.Close()

	var googleData struct {
		Email   string `json:"email"`
		Name    string `json:"name"`
		Picture string `json:"picture"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&googleData); err != nil {
		return "", nil, err
	}

	user, err := u.repo.GetUserByEmail(ctx, googleData.Email)
	if err != nil {
		user, err = u.repo.CreateUserWithEmail(ctx, googleData.Email, "", googleData.Name)
		if err != nil {
			return "", nil, err
		}
		u.repo.UpdateProfile(ctx, user.ID, &googleData.Name, nil, nil, &googleData.Picture, nil, nil)
		user.AvatarURL = &googleData.Picture
	}

	token, err := auth.GenerateToken(user.ID, user.Role)
	return token, user, err
}

func (u *userUseCase) VerifyEmailCode(ctx context.Context, email, code string) error {
	return u.repo.VerifyEmailCode(ctx, email, code)
}

func (u *userUseCase) LinkEmail(ctx context.Context, userID, email string) error {
	return u.repo.LinkEmail(ctx, userID, email)
}

func (u *userUseCase) ToggleBan(ctx context.Context, userID string) error {
	return u.repo.ToggleBan(ctx, userID)
}

func (u *userUseCase) GetAllDealsAdmin(ctx context.Context) ([]domain.AdminDeal, error) {
	return u.repo.GetAllDealsAdmin(ctx)
}

func (u *userUseCase) GetUserByID(ctx context.Context, id string) (*domain.User, error) {
	return u.repo.GetUserByID(ctx, id)
}

func (u *userUseCase) GetUserReviews(ctx context.Context, userID string) ([]domain.ReviewResponse, error) {
	return u.repo.GetUserReviews(ctx, userID)
}

func (u *userUseCase) GetAllSkillsAdmin(ctx context.Context) ([]domain.AdminSkill, error) {
	return u.repo.GetAllSkillsAdmin(ctx)
}

func (u *userUseCase) AdminDeleteSkill(ctx context.Context, skillID string) error {
	return u.repo.AdminDeleteSkill(ctx, skillID)
}

func (u *userUseCase) CleanStaleDeals(ctx context.Context) error {
	return u.repo.CleanStaleDeals(ctx)
}

func (u *userUseCase) CreateNews(ctx context.Context, title, content string) error {
	if title == "" || content == "" {
		return errors.New("заголовок и содержание не могут быть пустыми")
	}
	return u.repo.CreateNews(ctx, title, content)
}

func (u *userUseCase) DeleteNews(ctx context.Context, id int) error {
	return u.repo.DeleteNews(ctx, id)
}

func (u *userUseCase) UpdateNews(ctx context.Context, id int, title, content string) error {
	if title == "" || content == "" {
		return errors.New("заголовок і зміст не можуть бути порожніми")
	}
	return u.repo.UpdateNews(ctx, id, title, content)
}

func (u *userUseCase) GetAllFeed(ctx context.Context, searchQuery, filterType, cityID, minPrice, maxPrice, minRating string) ([]domain.FeedItem, error) {
	return u.repo.GetAllFeed(ctx, searchQuery, filterType, cityID, minPrice, maxPrice, minRating)
}

func (u *userUseCase) GetCities(ctx context.Context) ([]domain.City, error) {
	return u.repo.GetCities(ctx)
}

func (u *userUseCase) SaveMessage(ctx context.Context, msg domain.Message) error {
	err := u.repo.SaveMessage(ctx, msg)

	if err == nil {
		sender, _ := u.repo.GetUserByID(ctx, msg.SenderID)
		if sender != nil {
			tgMsg := fmt.Sprintf("💬 <b>Нове повідомлення</b> від %s:\n\n<i>%s</i>\n\nЗайдіть на платформу, щоб відповісти.", sender.Username, msg.Text)
			go u.SendTelegramMessage(context.Background(), msg.ReceiverID, tgMsg)
		}
	}
	return err
}

func (u *userUseCase) GetDealMessages(ctx context.Context, dealID string) ([]domain.Message, error) {
	return u.repo.GetDealMessages(ctx, dealID)
}

func (u *userUseCase) GetChatHistory(ctx context.Context, user1, user2 string) ([]domain.Message, error) {
	return u.repo.GetChatHistory(ctx, user1, user2)
}

func (u *userUseCase) GetUserChats(ctx context.Context, userID string) ([]domain.ChatContact, error) {
	return u.repo.GetUserChats(ctx, userID)
}

func (u *userUseCase) CreateUserWithEmail(ctx context.Context, email, passwordHash, username string) (*domain.User, error) {
	user, err := u.repo.CreateUserWithEmail(ctx, email, passwordHash, username)

	if err == nil && u.emailService != nil {
		u.emailService.SendAsync(
			email,
			"Вітаємо у SkillSwap Irpin! 🎉",
			fmt.Sprintf("Привіт, %s! Ваш акаунт успішно створено. Знаходьте крутих майстрів та навчайтесь новому!", username),
		)
	}

	return user, err
}

func (u *userUseCase) SetEmailCode(ctx context.Context, email, code string) error {
	err := u.repo.SetEmailCode(ctx, email, code)

	if err == nil && u.emailService != nil {
		u.emailService.SendAsync(
			email,
			"🔐 Код підтвердження SkillSwap",
			fmt.Sprintf("Ваш код для підтвердження пошти: %s\nНікому його не передавайте!", code),
		)
	}

	return err
}

func (u *userUseCase) MarkChatAsRead(ctx context.Context, userID, partnerID string) error {
	return u.repo.MarkChatAsRead(ctx, userID, partnerID)
}

func (u *userUseCase) GetNews(ctx context.Context, userID string) ([]domain.News, error) {
	return u.repo.GetLatestNews(ctx, userID, 5)
}

func (u *userUseCase) GetMatches(ctx context.Context, userID string) ([]domain.FeedItem, error) {
	user, err := u.repo.GetUserByID(ctx, userID)
	if err != nil {
		return nil, err
	}

	userBio := ""
	if user.Bio != nil {
		userBio = *user.Bio
	}

	if userBio == "" {
		// Якщо біо порожнє, ШІ не має за що зачепитися, віддаємо стандартний результат з бази
		return u.repo.GetMatches(ctx, userID)
	}

	allSkills, err := u.repo.GetAllFeed(ctx, "", "", "", "", "", "")
	if err != nil || len(allSkills) == 0 {
		return []domain.FeedItem{}, nil
	}

	type skillForAI struct {
		ID          string `json:"id"`
		Title       string `json:"title"`
		Description string `json:"description"`
		Type        string `json:"type"`
	}

	var minimalSkills []skillForAI
	for _, s := range allSkills {
		if s.UserID != userID {
			desc := ""
			if s.Description != nil {
				desc = *s.Description
			}

			minimalSkills = append(minimalSkills, skillForAI{
				ID:          s.SkillID,
				Title:       s.Title,
				Description: desc,
				Type:        s.Type,
			})
		}
	}

	skillsJSONBytes, _ := json.Marshal(minimalSkills)

	matchedIDs, err := u.aiService.GetSmartMatches(ctx, userBio, string(skillsJSONBytes))
	if err != nil || len(matchedIDs) == 0 {
		fmt.Printf("⚠️ ШІ метчінг не вдався, використовуємо SQL: %v\n", err)
		return u.repo.GetMatches(ctx, userID)
	}

	var aiMatches []domain.FeedItem
	idMap := make(map[string]bool)
	for _, id := range matchedIDs {
		idMap[id] = true
	}

	for _, s := range allSkills {
		if idMap[s.SkillID] {
			aiMatches = append(aiMatches, s)
		}
	}

	fmt.Printf("🤖 AI успішно підібрав %d збігів для юзера %s\n", len(aiMatches), user.Username)
	return aiMatches, nil
}

func (u *userUseCase) ModerateMessage(ctx context.Context, text string) string {
	if u.aiService == nil {
		return text
	}

	isOk, _ := u.aiService.ModerateSkill(ctx, "Чат", text)
	if !isOk {
		return "🚫 Повідомлення приховано модератором (ШІ) за порушення правил."
	}
	return text
}

func (u *userUseCase) CreateCertificate(ctx context.Context, cert *domain.Certificate) error {
	return u.repo.CreateCertificate(ctx, cert)
}

func (u *userUseCase) GetCertificate(ctx context.Context, id string) (*domain.CertificateDetails, error) {
	return u.repo.GetCertificate(ctx, id)
}

func (u *userUseCase) SetFullName(ctx context.Context, userID, fullName string) error {
	return u.repo.SetFullName(ctx, userID, fullName)
}

func (u *userUseCase) SaveTelegramToken(ctx context.Context, userID string, token string) error {
	return u.repo.SaveTelegramToken(ctx, userID, token)
}

func (u *userUseCase) LinkTelegram(ctx context.Context, token string, telegramID int64) error {
	return u.repo.LinkTelegram(ctx, token, telegramID)
}

func (u *userUseCase) DeleteChatHistory(ctx context.Context, userID, partnerID string) error {
	return u.repo.DeleteChatHistory(ctx, userID, partnerID)
}

func (u *userUseCase) ToggleChatPin(ctx context.Context, userID, partnerID string) error {
	return u.repo.ToggleChatPin(ctx, userID, partnerID)
}
func (u *userUseCase) ToggleUserBlock(ctx context.Context, userID, partnerID string) error {
	return u.repo.ToggleUserBlock(ctx, userID, partnerID)
}
func (u *userUseCase) GetChatPreferences(ctx context.Context, userID string) ([]domain.ChatPreference, error) {
	return u.repo.GetChatPreferences(ctx, userID)
}
func (u *userUseCase) IsBlockedBy(ctx context.Context, senderID, receiverID string) bool {
	return u.repo.IsBlockedBy(ctx, senderID, receiverID)
}

func (u *userUseCase) CreateDeal(ctx context.Context, skillID, initiatorID string) error {
	skill, err := u.repo.GetSkillByID(ctx, skillID)
	if err != nil {
		return err
	}
	user, err := u.repo.GetUserByID(ctx, initiatorID)
	if err != nil {
		return err
	}

	if user.BalanceMinutes < skill.Price {
		return fmt.Errorf("недостатньо хвилин на балансі")
	}

	if err := u.repo.UpdateUserMinutes(ctx, initiatorID, -skill.Price, skill.Price); err != nil {
		return err
	}

	err = u.repo.CreateDeal(ctx, skillID, initiatorID)

	if err == nil {
		msg := fmt.Sprintf("🎓 <b>Нова заявка!</b>\n\nКористувач <b>%s</b> хоче навчитися <b>%s</b>.\nЗайдіть на платформу, щоб прийняти або відхилити.", user.Username, skill.Title)
		go u.SendTelegramMessage(context.Background(), skill.UserID, msg)
	}

	return err
}

func (u *userUseCase) UpdateDealStatus(ctx context.Context, dealID, newStatus string, scheduledAt *time.Time) error {
	deal, err := u.repo.GetDealByID(ctx, dealID)
	if err != nil {
		return err
	}
	skill, err := u.repo.GetSkillByID(ctx, deal.SkillID)
	if err != nil {
		return err
	}

	if newStatus == "cancelled" || newStatus == "rejected" {
		if deal.Status == "pending" || newStatus == "rejected" {
			u.repo.UpdateUserMinutes(ctx, deal.InitiatorID, skill.Price, -skill.Price)
		} else if deal.Status == "cancel_requested" || deal.Status == "disputed" {
			u.repo.UpdateUserMinutes(ctx, deal.InitiatorID, skill.Price, -skill.Price)
		} else if deal.Status == "accepted" && newStatus == "cancelled" {
			newStatus = "cancel_requested"
		}
	}

	if newStatus == "completed" {
		u.repo.TransferFrozenToMaster(ctx, deal.InitiatorID, skill.UserID, skill.Price)
	}

	err = u.repo.UpdateDealStatus(ctx, dealID, newStatus, scheduledAt)

	if err == nil {
		var msg string
		switch newStatus {
		case "accepted":
			timeStr := "не вказано"
			if scheduledAt != nil {
				timeStr = scheduledAt.Format("15:04 02.01")
			}
			msg = fmt.Sprintf("✅ <b>Угоду схвалено!</b>\n\nМайстер прийняв вашу заявку на <b>%s</b>. Час: %s. Посилання на Meet вже в профілі!", skill.Title, timeStr)
			go u.SendTelegramMessage(context.Background(), deal.InitiatorID, msg)
		case "rejected":
			msg = fmt.Sprintf("❌ <b>Угоду відхилено</b>\n\nМайстер відхилив вашу заявку на <b>%s</b>. Хвилини повернуто на баланс.", skill.Title)
			go u.SendTelegramMessage(context.Background(), deal.InitiatorID, msg)
		case "completed":
			msg = fmt.Sprintf("🏁 <b>Урок завершено!</b>\n\nУрок з <b>%s</b> успішно завершено. Хвилини переказано. Не забудьте залишити відгук!", skill.Title)
			go u.SendTelegramMessage(context.Background(), deal.InitiatorID, msg)
			go u.SendTelegramMessage(context.Background(), skill.UserID, msg)
		}
	}

	return err
}

func (u *userUseCase) GetSystemStats(ctx context.Context) (*domain.SystemStats, error) {
	return u.repo.GetSystemStats(ctx)
}

func (u *userUseCase) AdminUpdateSkill(ctx context.Context, skillID string, title string, price int, isActive bool) error {
	return u.repo.AdminUpdateSkill(ctx, skillID, title, price, isActive)
}

func (u *userUseCase) GetLeaderboard(ctx context.Context) ([]domain.LeaderboardUser, error) {
	return u.repo.GetLeaderboard(ctx)
}

func (u *userUseCase) GetUserAchievements(ctx context.Context, userID string) ([]domain.Achievement, error) {
	return u.repo.GetUserAchievements(ctx, userID)
}

func (u *userUseCase) ClaimAchievementBonus(ctx context.Context, userID string, achievementID string) error {
	return u.repo.ClaimAchievementBonus(ctx, userID, achievementID)
}

func (u *userUseCase) CreateReport(ctx context.Context, reporterID, targetType, targetID, reason string, details *string) error {
	return u.repo.CreateReport(ctx, reporterID, targetType, targetID, reason, details)
}

func (u *userUseCase) GetPendingReports(ctx context.Context) ([]domain.Report, error) {
	return u.repo.GetPendingReports(ctx)
}

func (u *userUseCase) ResolveReport(ctx context.Context, reportID string, status string) error {
	return u.repo.ResolveReport(ctx, reportID, status)
}

func (u *userUseCase) SendTelegramMessage(ctx context.Context, userID string, message string) error {
	if u.notifier == nil {
		return errors.New("telegram bot не підключений")
	}

	tgID, err := u.repo.GetUserTelegramID(ctx, userID)
	if err != nil || tgID == nil {
		return err // Юзер не прив'язав телеграм, це нормально
	}

	return u.notifier.SendNotification(*tgID, message)
}

func (u *userUseCase) CheckUpcomingLessons(ctx context.Context) error {
	deals, err := u.repo.GetUpcomingDeals(ctx)
	if err != nil {
		return err
	}

	for _, deal := range deals {
		skill, _ := u.repo.GetSkillByID(ctx, deal.SkillID)
		if skill != nil {
			timeStr := "скоро"
			if deal.ScheduledAt != nil {
				timeStr = deal.ScheduledAt.Format("15:04")
			}
			msg := fmt.Sprintf("⏰ <b>Нагадування!</b>\n\nВаш урок <b>%s</b> почнеться приблизно через годину (%s)!\n\n📹 Посилання на зустріч:\n%s",
				skill.Title, timeStr, deal.MeetingURL)

			go u.SendTelegramMessage(context.Background(), deal.InitiatorID, msg)
			go u.SendTelegramMessage(context.Background(), skill.UserID, msg)
		}
	}
	return nil
}
