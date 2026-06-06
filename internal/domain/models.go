package domain

import (
	"time"

	"github.com/google/uuid"
)

type FeedItem struct {
	SkillID     string  `json:"skill_id" db:"skill_id"`
	Title       string  `json:"title" db:"title"`
	Description *string `json:"description" db:"description"`
	Type        string  `json:"type" db:"type"`
	Price       int     `json:"price" db:"price"`
	UserID      string  `json:"user_id" db:"user_id"`
	UserName    string  `json:"user_name" db:"user_name"`
	UserAvatar  string  `json:"user_avatar" db:"user_avatar"`
	CityName    string  `json:"city_name" db:"city_name"`
	UserRating  float64 `json:"user_rating" db:"user_rating"`
	BirthDate   *string `json:"birth_date" db:"birth_date"`
}

type City struct {
	ID   int    `db:"id" json:"id"`
	Name string `db:"name" json:"name"`
}

type Skill struct {
	ID          string  `db:"id" json:"id"`
	UserID      string  `db:"user_id" json:"user_id"`
	Type        string  `db:"type" json:"type"`
	Title       string  `db:"title" json:"title"`
	Description *string `db:"description" json:"description"`
	CreatedAt   string  `db:"created_at" json:"created_at"`
	Price       int     `db:"price" json:"price"`
	IsActive    bool    `json:"is_active" db:"is_active"`
}

type Order struct {
	ID          uuid.UUID `json:"id" db:"id"`
	UserID      uuid.UUID `json:"user_id" db:"user_id"`
	SkillID     int       `json:"skill_id" db:"skill_id"`
	OrderType   string    `json:"order_type" db:"order_type"`
	Description string    `json:"description" db:"description"`
	Status      string    `json:"status" db:"status"`
	CreatedAt   time.Time `json:"created_at" db:"created_at"`
}

type Deal struct {
	ID          string     `db:"id" json:"id"`
	SkillID     string     `db:"skill_id" json:"skill_id"`
	InitiatorID string     `db:"initiator_id" json:"initiator_id"`
	ReceiverID  string     `db:"receiver_id" json:"receiver_id"`
	Status      string     `db:"status" json:"status"`
	CreatedAt   string     `db:"created_at" json:"created_at"`
	ScheduledAt *time.Time `db:"scheduled_at" json:"scheduled_at"`
	MeetingURL  string     `db:"meeting_url" json:"meeting_url"`
}

type Transaction struct {
	ID            uuid.UUID `json:"id" db:"id"`
	DealID        uuid.UUID `json:"deal_id" db:"deal_id"`
	SenderID      uuid.UUID `json:"sender_id" db:"sender_id"`
	ReceiverID    uuid.UUID `json:"receiver_id" db:"receiver_id"`
	AmountMinutes int       `json:"amount_minutes" db:"amount_minutes"`
	CreatedAt     time.Time `json:"created_at" db:"created_at"`
}

type IncomingDeal struct {
	DealID         string     `db:"deal_id" json:"deal_id"`
	SkillTitle     string     `db:"skill_title" json:"skill_title"`
	InitiatorName  *string    `db:"initiator_name" json:"initiator_name"`
	InitiatorPhone *string    `db:"initiator_phone" json:"initiator_phone"`
	Status         string     `db:"status" json:"status"`
	ScheduledAt    *time.Time `db:"scheduled_at" json:"scheduled_at"`
}

type OutgoingDeal struct {
	DealID      string     `db:"deal_id" json:"deal_id"`
	SkillTitle  string     `db:"skill_title" json:"skill_title"`
	MasterName  *string    `db:"master_name" json:"master_name"`
	MasterPhone *string    `db:"master_phone" json:"master_phone"`
	MasterID    string     `db:"master_id" json:"master_id"`
	Status      string     `db:"status" json:"status"`
	ScheduledAt *time.Time `db:"scheduled_at" json:"scheduled_at"`
}

type User struct {
	ID          string  `db:"id" json:"id"`
	TelegramID  *int64  `db:"telegram_id" json:"telegram_id"`
	Username    string  `db:"username" json:"username"`
	FullName    *string `db:"full_name" json:"full_name"`
	PhoneNumber *string `db:"phone_number" json:"phone_number"`
	Email       *string `db:"email" json:"email"`
	BirthDate   *string `db:"birth_date" json:"birth_date"`

	PasswordHash      *string `db:"password_hash" json:"-"`
	AuthCode          *string `db:"auth_code" json:"-"`
	TelegramLinkToken *string `db:"telegram_link_token" json:"-"`

	BalanceMinutes  int `db:"balance_minutes" json:"balance_minutes"`
	FrozenMinutes   int `db:"frozen_minutes" json:"frozen_minutes"`
	MentoredMinutes int `db:"mentored_minutes" json:"mentored_minutes"`
	LearnedMinutes  int `db:"learned_minutes" json:"learned_minutes"`

	Rating    float64   `db:"rating" json:"rating"`
	Role      string    `db:"role" json:"role"`
	Bio       *string   `db:"bio" json:"bio"`
	AvatarURL *string   `db:"avatar_url" json:"avatar_url"`
	IsBanned  bool      `db:"is_banned" json:"is_banned"`
	CreatedAt time.Time `db:"created_at" json:"created_at"`

	CityID       *int `db:"city_id" json:"city_id"`
	BonusClaimed bool `json:"bonus_claimed" db:"bonus_claimed"`
}

type AdminDeal struct {
	ID            string `db:"deal_id" json:"id"`
	SkillTitle    string `db:"skill_title" json:"skill_title"`
	InitiatorName string `db:"initiator_name" json:"initiator_name"`
	MasterName    string `db:"master_name" json:"master_name"`
	Status        string `db:"status" json:"status"`
	Price         int    `db:"price" json:"price"`
}

type ReviewResponse struct {
	ID           string    `db:"id" json:"id"`
	DealID       string    `db:"deal_id" json:"deal_id"`
	ReviewerName string    `db:"reviewer_name" json:"reviewer_name"`
	Score        int       `db:"score" json:"score"`
	Comment      *string   `db:"comment" json:"comment"`
	CreatedAt    time.Time `db:"created_at" json:"created_at"`
}

type AdminSkill struct {
	ID       string `db:"id" json:"id"`
	Username string `db:"username" json:"username"`
	Title    string `db:"title" json:"title"`
	Type     string `db:"type" json:"type"`
	Price    int    `db:"price" json:"price"`
	IsActive bool   `db:"is_active" json:"is_active"`
}

type DealNotificationData struct {
	SkillTitle string `db:"title"`
	MasterTGID int64  `db:"telegram_id"`
}

type DealStatusNotificationData struct {
	SkillTitle    string `db:"title"`
	MasterTGID    int64  `db:"master_tg"`
	InitiatorTGID int64  `db:"initiator_tg"`
}

type News struct {
	ID        int       `db:"id" json:"id"`
	UserID    *string   `db:"user_id" json:"user_id"`
	Title     string    `db:"title" json:"title"`
	Content   string    `db:"content" json:"content"`
	CreatedAt time.Time `db:"created_at" json:"created_at"`
}

type Message struct {
	ID          int       `db:"id" json:"id"`
	DealID      string    `db:"deal_id" json:"deal_id"`
	SenderID    string    `db:"sender_id" json:"sender_id"`
	ReceiverID  string    `db:"receiver_id" json:"receiver_id"`
	Text        string    `db:"text" json:"text"`
	IsRead      bool      `db:"is_read" json:"is_read"`
	CreatedAt   time.Time `db:"created_at" json:"created_at"`
	ReplyToID   *int64    `db:"reply_to_id" json:"reply_to_id"`
	ReplyToText *string   `db:"reply_to_text" json:"reply_to_text"`
}

type ChatContact struct {
	PartnerID     string    `db:"partner_id" json:"partner_id"`
	PartnerName   string    `db:"partner_name" json:"partner_name"`
	PartnerAvatar *string   `db:"partner_avatar" json:"partner_avatar"`
	LastMessage   string    `db:"last_message" json:"last_message"`
	LastMessageAt time.Time `db:"last_message_at" json:"last_message_at"`
	UnreadCount   int       `db:"unread_count" json:"unread_count"`
}

type Certificate struct {
	ID          string    `db:"id" json:"id"`
	UserID      string    `db:"user_id" json:"user_id"`
	Type        string    `db:"type" json:"type"`
	Hours       int       `db:"hours" json:"hours"`
	EctsCredits int       `db:"ects_credits" json:"ects_credits"`
	IssuedAt    time.Time `db:"issued_at" json:"issued_at"`
}

type CertificateDetails struct {
	ID          string    `db:"id" json:"id"`
	UserID      string    `db:"user_id" json:"user_id"`
	FullName    *string   `db:"full_name" json:"full_name"`
	Type        string    `db:"type" json:"type"`
	Hours       int       `db:"hours" json:"hours"`
	EctsCredits int       `db:"ects_credits" json:"ects_credits"`
	IssuedAt    time.Time `db:"issued_at" json:"issued_at"`
}

type ChatPreference struct {
	PartnerID string `db:"partner_id" json:"partner_id"`
	IsPinned  bool   `db:"is_pinned" json:"is_pinned"`
	IsBlocked bool   `db:"is_blocked" json:"is_blocked"`
}

type SystemStats struct {
	TotalUsers       int `json:"total_users" db:"total_users"`
	TotalSkills      int `json:"total_skills" db:"total_skills"`
	TotalDeals       int `json:"total_deals" db:"total_deals"`
	CompletedDeals   int `json:"completed_deals" db:"completed_deals"`
	TotalCirculating int `json:"total_circulating" db:"total_circulating"`
	TotalFrozen      int `json:"total_frozen" db:"total_frozen"`
}

type Achievement struct {
	ID              string `json:"id"`
	Name            string `json:"name"`
	Description     string `json:"description"`
	Icon            string `json:"icon"`
	IsUnlocked      bool   `json:"is_unlocked"`
	CurrentProgress int    `json:"current_progress"`
	TargetProgress  int    `json:"target_progress"`
	IsClaimed       bool   `json:"is_claimed"`
	BonusMinutes    int    `json:"bonus_minutes"`
}

type LeaderboardUser struct {
	ID             string  `json:"id" db:"id"`
	Username       string  `json:"username" db:"username"`
	Avatar         string  `json:"avatar_url" db:"avatar_url"`
	Rating         float64 `json:"rating" db:"rating"`
	ReviewsCount   int     `json:"reviews_count" db:"reviews_count"`
	CompletedDeals int     `json:"completed_deals" db:"completed_deals"`
}

type Report struct {
	ID           string    `json:"id" db:"id"`
	ReporterID   string    `json:"reporter_id" db:"reporter_id"`
	TargetType   string    `json:"target_type" db:"target_type"`
	TargetID     string    `json:"target_id" db:"target_id"`
	Reason       string    `json:"reason" db:"reason"`
	Details      *string   `json:"details" db:"details"`
	Status       string    `json:"status" db:"status"`
	CreatedAt    time.Time `json:"created_at" db:"created_at"`
	ReporterName string    `json:"reporter_name" db:"reporter_name"`
	TargetInfo   string    `json:"target_info" db:"target_info"`
}
