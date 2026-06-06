package domain

import (
	"context"
	"errors"
	"time"
)

var ErrUserNotFound = errors.New("user not found")

type Notifier interface {
	SendNotification(telegramID int64, text string) error
}

type UserRepository interface {
	Create(ctx context.Context, user *User) error
	GetByTelegramID(ctx context.Context, telegramID int64) (*User, error)
	GetAll(ctx context.Context) ([]User, error)
	CreateSkill(ctx context.Context, skill *Skill) error
	GetUserSkills(ctx context.Context, userID string) ([]Skill, error)
	GetAllFeed(ctx context.Context, searchQuery, filterType, cityID, minPrice, maxPrice, minRating string) ([]FeedItem, error)
	ToggleSkill(ctx context.Context, skillID string) error
	DeleteSkill(ctx context.Context, skillID string) error
	CreateDeal(ctx context.Context, skillID string, initiatorID string) error
	GetIncomingDeals(ctx context.Context, receiverID string) ([]IncomingDeal, error)
	UpdateDealStatus(ctx context.Context, dealID string, status string, scheduledAt *time.Time) error
	SetAuthCode(ctx context.Context, telegramID int64, code string) error
	VerifyAuthCode(ctx context.Context, code string) (*User, error)
	CreateReview(ctx context.Context, dealID, reviewerID, targetID string, score int, comment *string) error
	CreateUserWithEmail(ctx context.Context, email, passwordHash, username string) (*User, error)
	GetUserByEmail(ctx context.Context, email string) (*User, error)
	AcceptDeal(ctx context.Context, dealID string) error
	CompleteDeal(ctx context.Context, dealID string) error
	GetOutgoingDeals(ctx context.Context, initiatorID string) ([]OutgoingDeal, error)
	AdminUpdateUser(ctx context.Context, userID string, balance int, rating float64, phone string, username string, email string, role string) error
	SetEmailCode(ctx context.Context, email, code string) error
	VerifyEmailCode(ctx context.Context, email, code string) error
	LinkEmail(ctx context.Context, userID, email string) error
	ToggleBan(ctx context.Context, userID string) error
	GetAllDealsAdmin(ctx context.Context) ([]AdminDeal, error)
	GetUserByID(ctx context.Context, id string) (*User, error)
	GetUserReviews(ctx context.Context, userID string) ([]ReviewResponse, error)
	GetAllSkillsAdmin(ctx context.Context) ([]AdminSkill, error)
	AdminDeleteSkill(ctx context.Context, skillID string) error
	CleanStaleDeals(ctx context.Context) error
	GetDealNotificationData(ctx context.Context, skillID string) (DealNotificationData, error)
	CreateNews(ctx context.Context, title, content string) error
	DeleteNews(ctx context.Context, id int) error
	UpdateNews(ctx context.Context, id int, title, content string) error
	GetCities(ctx context.Context) ([]City, error)
	SaveMessage(ctx context.Context, msg Message) error
	GetDealMessages(ctx context.Context, dealID string) ([]Message, error)
	GetUserChats(ctx context.Context, userID string) ([]ChatContact, error)
	GetChatHistory(ctx context.Context, user1, user2 string) ([]Message, error)
	MarkChatAsRead(ctx context.Context, userID, partnerID string) error
	GetLatestNews(ctx context.Context, userID string, limit int) ([]News, error)
	CreatePersonalNews(ctx context.Context, userID, title, content string) error
	GetMatches(ctx context.Context, userID string) ([]FeedItem, error)
	CreateCertificate(ctx context.Context, cert *Certificate) error
	GetCertificate(ctx context.Context, id string) (*CertificateDetails, error)
	SetFullName(ctx context.Context, userID, fullName string) error
	SaveTelegramToken(ctx context.Context, userID string, token string) error
	LinkTelegram(ctx context.Context, token string, telegramID int64) error
	DeleteChatHistory(ctx context.Context, userID, partnerID string) error
	ToggleChatPin(ctx context.Context, userID, partnerID string) error
	ToggleUserBlock(ctx context.Context, userID, partnerID string) error
	GetChatPreferences(ctx context.Context, userID string) ([]ChatPreference, error)
	IsBlockedBy(ctx context.Context, senderID, receiverID string) bool
	UpdateUserMinutes(ctx context.Context, userID string, balanceDelta, frozenDelta int) error
	TransferFrozenToMaster(ctx context.Context, initiatorID, masterID string, minutes int) error
	SetDealMeetingURL(ctx context.Context, dealID, url string) error
	GetSkillByID(ctx context.Context, id string) (*Skill, error)
	GetDealByID(ctx context.Context, id string) (*Deal, error)
	UpdateProfile(ctx context.Context, userID string, username *string, phone *string, bio *string, avatarURL *string, cityID *int, birthDate *string) error
	GetSystemStats(ctx context.Context) (*SystemStats, error)
	AdminUpdateSkill(ctx context.Context, skillID string, title string, price int, isActive bool) error
	GetLeaderboard(ctx context.Context) ([]LeaderboardUser, error)
	GetUserAchievements(ctx context.Context, userID string) ([]Achievement, error)
	ClaimAchievementBonus(ctx context.Context, userID string, achievementID string) error
	CreateReport(ctx context.Context, reporterID, targetType, targetID, reason string, details *string) error
	GetPendingReports(ctx context.Context) ([]Report, error)
	ResolveReport(ctx context.Context, reportID string, status string) error
	GetDealStatusNotificationData(ctx context.Context, dealID string) (DealStatusNotificationData, error)
	GetUserTelegramID(ctx context.Context, userID string) (*int64, error)
	GetUpcomingDeals(ctx context.Context) ([]Deal, error)
}

type UserUseCase interface {
	RegisterUser(ctx context.Context, telegramID int64, username, phone *string) (*User, error)
	GetProfile(ctx context.Context, telegramID int64) (*User, error)
	GetAllUsers(ctx context.Context) ([]User, error)
	AddSkill(ctx context.Context, userID string, skillType string, title string, description *string, price int) error
	GetUserSkills(ctx context.Context, userID string) ([]Skill, error)
	GetAllFeed(ctx context.Context, searchQuery, filterType, cityID, minPrice, maxPrice, minRating string) ([]FeedItem, error)
	ToggleSkill(ctx context.Context, skillID string) error
	DeleteSkill(ctx context.Context, skillID string) error
	CreateDeal(ctx context.Context, skillID string, initiatorID string) error
	GetIncomingDeals(ctx context.Context, receiverID string) ([]IncomingDeal, error)
	UpdateDealStatus(ctx context.Context, dealID string, status string, scheduledAt *time.Time) error
	SetAuthCode(ctx context.Context, telegramID int64, code string) error
	VerifyAuthCode(ctx context.Context, code string) (*User, error)
	CreateReview(ctx context.Context, dealID, reviewerID, targetID string, score int, comment *string) error
	GetUserByEmail(ctx context.Context, email string) (*User, error)
	CreateUserWithEmail(ctx context.Context, email, passwordHash, username string) (*User, error)
	GoogleLogin(ctx context.Context, googleToken string) (string, *User, error)
	AcceptDeal(ctx context.Context, dealID string) error
	CompleteDeal(ctx context.Context, dealID string) error
	GetOutgoingDeals(ctx context.Context, initiatorID string) ([]OutgoingDeal, error)
	SetEmailCode(ctx context.Context, email, code string) error
	VerifyEmailCode(ctx context.Context, email, code string) error
	LinkEmail(ctx context.Context, userID, email string) error
	ToggleBan(ctx context.Context, userID string) error
	AdminUpdateUser(ctx context.Context, userID string, balance int, rating float64, phone string, username string, email string, role string) error
	GetAllDealsAdmin(ctx context.Context) ([]AdminDeal, error)
	GetUserByID(ctx context.Context, id string) (*User, error)
	GetUserReviews(ctx context.Context, userID string) ([]ReviewResponse, error)
	GetAllSkillsAdmin(ctx context.Context) ([]AdminSkill, error)
	AdminDeleteSkill(ctx context.Context, skillID string) error
	CleanStaleDeals(ctx context.Context) error
	SetNotifier(notifier Notifier)
	CreateNews(ctx context.Context, title, content string) error
	DeleteNews(ctx context.Context, id int) error
	UpdateNews(ctx context.Context, id int, title, content string) error
	GetCities(ctx context.Context) ([]City, error)
	SaveMessage(ctx context.Context, msg Message) error
	GetDealMessages(ctx context.Context, dealID string) ([]Message, error)
	GetChatHistory(ctx context.Context, user1, user2 string) ([]Message, error)
	GetUserChats(ctx context.Context, userID string) ([]ChatContact, error)
	MarkChatAsRead(ctx context.Context, userID, partnerID string) error
	GetNews(ctx context.Context, userID string) ([]News, error)
	GetMatches(ctx context.Context, userID string) ([]FeedItem, error)
	CreateCertificate(ctx context.Context, cert *Certificate) error
	GetCertificate(ctx context.Context, id string) (*CertificateDetails, error)
	SetFullName(ctx context.Context, userID, fullName string) error
	SaveTelegramToken(ctx context.Context, userID string, token string) error
	LinkTelegram(ctx context.Context, token string, telegramID int64) error
	DeleteChatHistory(ctx context.Context, userID, partnerID string) error
	ToggleChatPin(ctx context.Context, userID, partnerID string) error
	ToggleUserBlock(ctx context.Context, userID, partnerID string) error
	GetChatPreferences(ctx context.Context, userID string) ([]ChatPreference, error)
	IsBlockedBy(ctx context.Context, senderID, receiverID string) bool
	UpdateProfile(ctx context.Context, userID string, username *string, phone *string, bio *string, avatarURL *string, cityID *int, birthDate *string) error
	GetSystemStats(ctx context.Context) (*SystemStats, error)
	AdminUpdateSkill(ctx context.Context, skillID string, title string, price int, isActive bool) error
	GetLeaderboard(ctx context.Context) ([]LeaderboardUser, error)
	GetUserAchievements(ctx context.Context, userID string) ([]Achievement, error)
	ClaimAchievementBonus(ctx context.Context, userID string, achievementID string) error
	CreateReport(ctx context.Context, reporterID, targetType, targetID, reason string, details *string) error
	GetPendingReports(ctx context.Context) ([]Report, error)
	ResolveReport(ctx context.Context, reportID string, status string) error
	ModerateMessage(ctx context.Context, text string) string
	SendTelegramMessage(ctx context.Context, userID string, message string) error // Додаємо
	CheckUpcomingLessons(ctx context.Context) error
}
