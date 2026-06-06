package postgres

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
	"google.golang.org/api/calendar/v3"
	"google.golang.org/api/option"
	"os"
	"skillswap-irpin/internal/domain"
	"time"

	"github.com/jmoiron/sqlx"
)

type UserRepo struct {
	db  *sqlx.DB
	rdb *redis.Client
}

func NewUserRepository(db *sqlx.DB, rdb *redis.Client) *UserRepo {
	return &UserRepo{db: db, rdb: rdb}
}

func (r *UserRepo) Create(ctx context.Context, user *domain.User) error {
	query := `
		INSERT INTO users (telegram_id, username, phone_number, balance_minutes, rating)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id, created_at`

	err := r.db.QueryRowContext(ctx, query,
		user.TelegramID,
		user.Username,
		user.PhoneNumber,
		user.BalanceMinutes,
		user.Rating,
	).Scan(&user.ID, &user.CreatedAt)

	return err
}

func (r *UserRepo) GetByTelegramID(ctx context.Context, telegramID int64) (*domain.User, error) {
	var user domain.User
	err := r.db.GetContext(ctx, &user, "SELECT * FROM users WHERE telegram_id = $1", telegramID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, domain.ErrUserNotFound
		}
		return nil, err
	}
	return &user, nil
}

func (r *UserRepo) GetAll(ctx context.Context) ([]domain.User, error) {
	var users []domain.User
	query := `SELECT * FROM users ORDER BY created_at DESC`

	err := r.db.SelectContext(ctx, &users, query)
	return users, err
}

func (r *UserRepo) CreateSkill(ctx context.Context, skill *domain.Skill) error {
	if skill.Price == 0 {
		skill.Price = 60
	}

	query := `
		INSERT INTO skills (user_id, type, title, description, price)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id, created_at`

	err := r.db.QueryRowContext(ctx, query,
		skill.UserID, skill.Type, skill.Title, skill.Description, skill.Price,
	).Scan(&skill.ID, &skill.CreatedAt)

	r.clearFeedCache(ctx)

	return err
}

func (r *UserRepo) GetUserSkills(ctx context.Context, userID string) ([]domain.Skill, error) {
	var skills []domain.Skill
	query := `SELECT * FROM skills WHERE user_id = $1 ORDER BY created_at DESC`

	err := r.db.SelectContext(ctx, &skills, query, userID)
	return skills, err
}

func (r *UserRepo) GetAllFeed(ctx context.Context, searchQuery, filterType, cityID, minPrice, maxPrice, minRating string) ([]domain.FeedItem, error) {
	cacheKey := fmt.Sprintf("feed_v2:search:%s:type:%s:city:%s:minP:%s:maxP:%s:minR:%s",
		searchQuery, filterType, cityID, minPrice, maxPrice, minRating)

	cachedData, err := r.rdb.Get(ctx, cacheKey).Result()
	if err == nil {
		var feed []domain.FeedItem
		if json.Unmarshal([]byte(cachedData), &feed) == nil {
			return feed, nil
		}
	}

	var feed []domain.FeedItem
	query := `
		SELECT 
			s.id as skill_id, 
			u.id as user_id, 
			s.type, 
			s.title, 
			s.description, 
			s.price, 
			u.username as user_name, 
			COALESCE(u.avatar_url, '') as user_avatar,
			COALESCE(c.name, 'Ірпінь') as city_name,
			COALESCE(u.rating, 5.0) as user_rating,
			CAST(u.birth_date AS TEXT) as birth_date
		FROM skills s
		JOIN users u ON s.user_id = u.id
		LEFT JOIN cities c ON u.city_id = c.id
		WHERE s.is_active = true
	`
	var args []interface{}
	argCount := 1

	if filterType == "teach" || filterType == "learn" {
		query += fmt.Sprintf(" AND s.type = $%d", argCount)
		args = append(args, filterType)
		argCount++
	}

	if searchQuery != "" {
		searchParam := "%" + searchQuery + "%"
		query += fmt.Sprintf(" AND (s.title ILIKE $%d OR s.description ILIKE $%d)", argCount, argCount+1)
		args = append(args, searchParam, searchParam)
		argCount += 2
	}

	if cityID != "" && cityID != "all" {
		query += fmt.Sprintf(" AND u.city_id = $%d", argCount)
		args = append(args, cityID)
		argCount++
	}

	if minPrice != "" {
		query += fmt.Sprintf(" AND s.price >= $%d", argCount)
		args = append(args, minPrice)
		argCount++
	}
	if maxPrice != "" {
		query += fmt.Sprintf(" AND s.price <= $%d", argCount)
		args = append(args, maxPrice)
		argCount++
	}
	if minRating != "" && minRating != "0" {
		query += fmt.Sprintf(" AND COALESCE(u.rating, 0) >= $%d", argCount)
		args = append(args, minRating)
		argCount++
	}

	query += " ORDER BY s.created_at DESC"

	err = r.db.SelectContext(ctx, &feed, query, args...)
	if err != nil {
		fmt.Printf("SQL Error GetAllFeed: %v\n", err)
		return nil, err
	}

	if feedBytes, err := json.Marshal(feed); err == nil {
		r.rdb.Set(ctx, cacheKey, feedBytes, 5*time.Minute)
	}

	return feed, nil
}

func (r *UserRepo) SetAuthCode(ctx context.Context, telegramID int64, code string) error {
	res, err := r.db.ExecContext(ctx, "UPDATE users SET auth_code = $1 WHERE telegram_id = $2", code, telegramID)
	if err != nil {
		return err
	}

	// Проверяем, обновилась ли запись
	rowsAffected, err := res.RowsAffected()
	if err != nil {
		return err
	}

	if rowsAffected == 0 {
		return errors.New("користувача не знайдено")
	}

	return nil
}

func (r *UserRepo) VerifyAuthCode(ctx context.Context, code string) (*domain.User, error) {
	var user domain.User
	err := r.db.GetContext(ctx, &user, "SELECT * FROM users WHERE auth_code = $1", code)
	if err != nil {
		return nil, errors.New("невірний або застарілий код")
	}

	r.db.ExecContext(ctx, "UPDATE users SET auth_code = NULL WHERE id = $1", user.ID)

	return &user, nil
}

func (r *UserRepo) UpdateProfile(ctx context.Context, userID string, username *string, phone *string, bio *string, avatarURL *string, cityID *int, birthDate *string) error {
	query := `
    UPDATE users 
    SET username = $1, phone_number = $2, bio = $3, avatar_url = $4, city_id = $5, birth_date = $6
    WHERE id = $7
`
	_, err := r.db.ExecContext(ctx, query, username, phone, bio, avatarURL, cityID, birthDate, userID)
	return err
}

func (r *UserRepo) CreateReview(ctx context.Context, dealID, reviewerID, targetID string, score int, comment *string) error {
	tx, err := r.db.BeginTxx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	query := `
		INSERT INTO reviews (deal_id, reviewer_id, target_id, score, comment) 
		VALUES ($1, $2, $3, $4, $5)
		ON CONFLICT (deal_id) DO UPDATE 
		SET score = EXCLUDED.score, comment = EXCLUDED.comment`

	_, err = tx.ExecContext(ctx, query, dealID, reviewerID, targetID, score, comment)
	if err != nil {
		return err
	}

	updateQuery := `UPDATE users SET rating = (SELECT COALESCE(ROUND(AVG(score), 1), 0) FROM reviews WHERE target_id = $1) WHERE id = $1`
	_, err = tx.ExecContext(ctx, updateQuery, targetID)
	if err != nil {
		return err
	}

	return tx.Commit()
}

func (r *UserRepo) CreateUserWithEmail(ctx context.Context, email, passwordHash, username string) (*domain.User, error) {
	var user domain.User
	query := `
		INSERT INTO users (email, password_hash, username, role, balance_minutes)
		VALUES ($1, $2, $3, 'user', 0)
		RETURNING id, email, username, role, balance_minutes, created_at`

	err := r.db.QueryRowContext(ctx, query, email, passwordHash, username).Scan(
		&user.ID, &user.Email, &user.Username, &user.Role, &user.BalanceMinutes, &user.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &user, nil
}

func (r *UserRepo) GetUserByEmail(ctx context.Context, email string) (*domain.User, error) {
	var user domain.User
	err := r.db.GetContext(ctx, &user, "SELECT * FROM users WHERE email = $1", email)
	if err != nil {
		return nil, errors.New("користувача з таким email не знайдено")
	}
	return &user, nil
}

func (r *UserRepo) AcceptDeal(ctx context.Context, dealID string) error {
	_, err := r.db.ExecContext(ctx, "UPDATE deals SET status = 'accepted' WHERE id = $1 AND status = 'pending'", dealID)
	return err
}

func (r *UserRepo) CreateDeal(ctx context.Context, skillID string, initiatorID string) error {
	tx, err := r.db.BeginTxx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	var receiverID string
	var price int
	err = tx.QueryRowxContext(ctx, "SELECT user_id, price FROM skills WHERE id = $1", skillID).Scan(&receiverID, &price)
	if err != nil {
		return errors.New("навичку не знайдено")
	}

	if initiatorID == receiverID {
		return errors.New("ви не можете відгукнутися на власну навичку")
	}

	var existingDeals int
	tx.GetContext(ctx, &existingDeals, "SELECT count(*) FROM deals WHERE initiator_id = $1 AND skill_id = $2 AND status = 'pending'", initiatorID, skillID)
	if existingDeals > 0 {
		return errors.New("ви вже відправили заявку на цю навичку")
	}

	var balance int
	err = tx.QueryRowxContext(ctx, "SELECT balance_minutes FROM users WHERE id = $1 FOR UPDATE", initiatorID).Scan(&balance)
	if err != nil || balance < price {
		return errors.New("недостатньо хвилин на балансі")
	}

	_, err = tx.ExecContext(ctx, "UPDATE users SET balance_minutes = balance_minutes - $1, frozen_minutes = frozen_minutes + $1 WHERE id = $2", price, initiatorID)
	if err != nil {
		return err
	}

	_, err = tx.ExecContext(ctx, "INSERT INTO deals (skill_id, initiator_id, receiver_id, status, price) VALUES ($1, $2, $3, 'pending', $4)", skillID, initiatorID, receiverID, price)
	if err != nil {
		return err
	}

	return tx.Commit()
}

func (r *UserRepo) CompleteDeal(ctx context.Context, dealID string) error {
	tx, err := r.db.BeginTxx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	var initiatorID, receiverID string
	var price int
	err = tx.QueryRowxContext(ctx, "SELECT initiator_id, receiver_id, price FROM deals WHERE id = $1 AND status IN ('accepted', 'disputed')").Scan(&initiatorID, &receiverID, &price)
	if err != nil {
		return errors.New("угода не знайдена або ще не прийнята")
	}

	_, err = tx.ExecContext(ctx, "UPDATE users SET frozen_minutes = frozen_minutes - $1, learned_minutes = learned_minutes + $1 WHERE id = $2", price, initiatorID)
	if err != nil {
		return err
	}

	_, err = tx.ExecContext(ctx, "UPDATE users SET balance_minutes = balance_minutes + $1, mentored_minutes = mentored_minutes + $1 WHERE id = $2", price, receiverID)
	if err != nil {
		return err
	}

	// 3. Закриваємо угоду
	_, err = tx.ExecContext(ctx, "UPDATE deals SET status = 'completed' WHERE id = $1", dealID)
	if err != nil {
		return err
	}

	return tx.Commit()
}

func generateMeetLink(ctx context.Context, dealID string, scheduledAt *time.Time) (string, error) {
	b, err := os.ReadFile("credentials.json")
	if err != nil {
		return "", err
	}

	config, err := google.ConfigFromJSON(b, calendar.CalendarEventsScope)
	if err != nil {
		return "", err
	}

	f, err := os.Open("token.json")
	if err != nil {
		return "", err
	}
	defer f.Close()

	tok := &oauth2.Token{}
	json.NewDecoder(f).Decode(tok)

	client := config.Client(ctx, tok)
	srv, err := calendar.NewService(ctx, option.WithHTTPClient(client))
	if err != nil {
		return "", err
	}

	startTime := time.Now()
	if scheduledAt != nil {
		startTime = *scheduledAt
	}

	event := &calendar.Event{
		Summary:     "SkillSwap Урок",
		Description: "Відеозустріч для угоди " + dealID,
		Start: &calendar.EventDateTime{
			DateTime: startTime.Format(time.RFC3339),
			TimeZone: "Europe/Kyiv",
		},
		End: &calendar.EventDateTime{
			DateTime: startTime.Add(time.Hour).Format(time.RFC3339),
			TimeZone: "Europe/Kyiv",
		},
		ConferenceData: &calendar.ConferenceData{
			CreateRequest: &calendar.CreateConferenceRequest{
				RequestId:             uuid.New().String(),
				ConferenceSolutionKey: &calendar.ConferenceSolutionKey{Type: "hangoutsMeet"},
			},
		},
	}

	event, err = srv.Events.Insert("primary", event).ConferenceDataVersion(1).Do()
	if err != nil {
		return "", err
	}

	return event.HangoutLink, nil
}

func (r *UserRepo) AdminUpdateUser(ctx context.Context, userID string, balance int, rating float64, phone string, username string, email string, role string) error {
	query := `
		UPDATE users 
		SET balance_minutes = $1, 
		    rating = $2, 
		    phone_number = NULLIF($3, ''), 
		    username = $4, 
		    email = NULLIF($5, ''), 
		    role = $6
		WHERE id = $7
	`
	_, err := r.db.ExecContext(ctx, query, balance, rating, phone, username, email, role, userID)
	return err
}

func (r *UserRepo) AdminCreateUser(ctx context.Context, user domain.User) (string, error) {
	query := `
		INSERT INTO users (id, username, phone_number, balance_minutes, role) 
		VALUES ($1, $2, $3, $4, $5) RETURNING id
	`
	var newID string
	err := r.db.QueryRowContext(ctx, query, user.ID, user.Username, user.PhoneNumber, user.BalanceMinutes, "user").Scan(&newID)
	return newID, err
}

func (r *UserRepo) ToggleSkill(ctx context.Context, skillID string) error {
	_, err := r.db.ExecContext(ctx, "UPDATE skills SET is_active = NOT is_active WHERE id = $1", skillID)

	r.clearFeedCache(ctx)

	return err
}

func (r *UserRepo) DeleteSkill(ctx context.Context, skillID string) error {
	_, err := r.db.ExecContext(ctx, "DELETE FROM skills WHERE id = $1", skillID)

	r.clearFeedCache(ctx)

	return err
}

func (r *UserRepo) GetIncomingDeals(ctx context.Context, receiverID string) ([]domain.IncomingDeal, error) {
	var deals []domain.IncomingDeal
	query := `
		SELECT 
			d.id as deal_id, s.title as skill_title,
			u.username as initiator_name, u.phone_number as initiator_phone,
			d.status, d.scheduled_at
		FROM deals d
		JOIN skills s ON d.skill_id = s.id
		JOIN users u ON d.initiator_id = u.id
		WHERE d.receiver_id = $1 AND d.status IN ('pending', 'negotiating', 'accepted')
		ORDER BY d.created_at DESC
	`
	err := r.db.SelectContext(ctx, &deals, query, receiverID)
	return deals, err
}

func (r *UserRepo) GetOutgoingDeals(ctx context.Context, initiatorID string) ([]domain.OutgoingDeal, error) {
	var deals []domain.OutgoingDeal
	query := `
		SELECT 
			d.id as deal_id, s.title as skill_title,
			u.username as master_name, u.phone_number as master_phone, u.id as master_id,
			d.status, d.scheduled_at
		FROM deals d
		JOIN skills s ON d.skill_id = s.id
		JOIN users u ON d.receiver_id = u.id
		WHERE d.initiator_id = $1
		ORDER BY d.created_at DESC
	`
	err := r.db.SelectContext(ctx, &deals, query, initiatorID)
	return deals, err
}

func (r *UserRepo) UpdateDealStatus(ctx context.Context, dealID string, status string, scheduledAt *time.Time) error {
	tx, err := r.db.BeginTxx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	var initiatorID, receiverID, currentStatus string
	var price int
	err = tx.QueryRowxContext(ctx, "SELECT initiator_id, receiver_id, status, price FROM deals WHERE id = $1", dealID).Scan(&initiatorID, &receiverID, &currentStatus, &price)
	if err != nil {
		return err
	}

	if status == "rejected" || status == "cancelled" {
		if currentStatus == "pending" || currentStatus == "negotiating" || currentStatus == "accepted" || currentStatus == "disputed" {
			_, err = tx.ExecContext(ctx, "UPDATE users SET balance_minutes = balance_minutes + $1, frozen_minutes = frozen_minutes - $1 WHERE id = $2", price, initiatorID)
			if err != nil {
				return err
			}
		}
		_, err = tx.ExecContext(ctx, "UPDATE deals SET status = $1, updated_at = NOW() WHERE id = $2", status, dealID)
		if err != nil {
			return err
		}

	} else if status == "completed" {
		if currentStatus == "accepted" || currentStatus == "disputed" {
			_, err = tx.ExecContext(ctx, "UPDATE users SET frozen_minutes = frozen_minutes - $1 WHERE id = $2", price, initiatorID)
			if err != nil {
				return err
			}

			_, err = tx.ExecContext(ctx, "UPDATE users SET balance_minutes = balance_minutes + $1 WHERE id = $2", price, receiverID)
			if err != nil {
				return err
			}

			_, err = tx.ExecContext(ctx, "UPDATE deals SET status = $1, updated_at = NOW() WHERE id = $2", status, dealID)
			if err != nil {
				return err
			}
		} else {
			return errors.New("не можна завершити непідтверджену угоду")
		}

	} else if status == "negotiating" {
		var overlapCount int
		err = tx.GetContext(ctx, &overlapCount, `
			SELECT count(*) FROM deals 
			WHERE receiver_id = $1 AND status = 'accepted' AND scheduled_at IS NOT NULL 
			AND scheduled_at >= $2::timestamp - interval '1 hour' 
			AND scheduled_at <= $2::timestamp + interval '1 hour'`, receiverID, scheduledAt)
		if overlapCount > 0 {
			return errors.New("у вас вже є підтверджений урок на цей (або близький) час")
		}

		_, err = tx.ExecContext(ctx, "UPDATE deals SET status = 'negotiating', scheduled_at = $1, updated_at = NOW() WHERE id = $2", scheduledAt, dealID)
		if err != nil {
			return err
		}

	} else if status == "accepted" {
		var dealTime time.Time
		if scheduledAt != nil {
			dealTime = *scheduledAt
		} else {
			dealTime = time.Now()
		}

		meetLink, meetErr := generateMeetLink(ctx, dealID, &dealTime)
		if meetErr != nil {
			fmt.Printf("⚠️ Google Meet помилка: %v, використовуємо Jitsi\n", meetErr)
			meetLink = fmt.Sprintf("https://meet.jit.si/SkillSwap-%s", dealID[:8])
		}

		_, err = tx.ExecContext(ctx, "UPDATE deals SET status = 'accepted', meeting_url = $1, scheduled_at = $2, updated_at = NOW() WHERE id = $3", meetLink, dealTime, dealID)
		if err != nil {
			return err
		}

	} else {
		_, err = tx.ExecContext(ctx, "UPDATE deals SET status = $1, updated_at = NOW() WHERE id = $2", status, dealID)
		if err != nil {
			return err
		}
	}

	return tx.Commit()
}

func (r *UserRepo) SetEmailCode(ctx context.Context, email, code string) error {
	expiresAt := time.Now().Add(10 * time.Minute)
	query := `
		INSERT INTO email_codes (email, code, expires_at) 
		VALUES ($1, $2, $3)
		ON CONFLICT (email) DO UPDATE SET code = EXCLUDED.code, expires_at = EXCLUDED.expires_at`
	_, err := r.db.ExecContext(ctx, query, email, code, expiresAt)
	return err
}

func (r *UserRepo) VerifyEmailCode(ctx context.Context, email, code string) error {
	var expiresAt time.Time
	err := r.db.QueryRowContext(ctx, "SELECT expires_at FROM email_codes WHERE email = $1 AND code = $2", email, code).Scan(&expiresAt)
	if err != nil {
		return errors.New("невірний код")
	}
	if time.Now().After(expiresAt) {
		return errors.New("час дії коду вийшов")
	}
	r.db.ExecContext(ctx, "DELETE FROM email_codes WHERE email = $1", email)
	return nil
}

func (r *UserRepo) LinkEmail(ctx context.Context, userID, email string) error {
	_, err := r.db.ExecContext(ctx, "UPDATE users SET email = $1 WHERE id = $2", email, userID)
	return err
}

func (r *UserRepo) ToggleBan(ctx context.Context, userID string) error {
	_, err := r.db.ExecContext(ctx, "UPDATE users SET is_banned = NOT is_banned WHERE id = $1", userID)
	return err
}

func (r *UserRepo) GetAllUsers(ctx context.Context) ([]domain.User, error) {
	var users []domain.User

	query := `
		SELECT 
			id, telegram_id, username, phone_number, email, 
			balance_minutes, frozen_minutes, rating, role, 
			is_banned, created_at 
		FROM users 
		ORDER BY created_at DESC
	`

	err := r.db.SelectContext(ctx, &users, query)
	return users, err
}

func (r *UserRepo) GetAllDealsAdmin(ctx context.Context) ([]domain.AdminDeal, error) {
	var deals []domain.AdminDeal
	query := `
		SELECT 
			d.id as deal_id, s.title as skill_title,
			u_init.username as initiator_name, u_recv.username as master_name,
			d.status, d.price
		FROM deals d
		JOIN skills s ON d.skill_id = s.id
		JOIN users u_init ON d.initiator_id = u_init.id
		JOIN users u_recv ON d.receiver_id = u_recv.id
		ORDER BY d.created_at DESC
	`
	err := r.db.SelectContext(ctx, &deals, query)
	return deals, err
}

func (r *UserRepo) GetUserByID(ctx context.Context, id string) (*domain.User, error) {
	var user domain.User
	err := r.db.GetContext(ctx, &user, "SELECT * FROM users WHERE id = $1", id)
	return &user, err
}

func (r *UserRepo) GetUserReviews(ctx context.Context, userID string) ([]domain.ReviewResponse, error) {
	var reviews []domain.ReviewResponse
	query := `
		SELECT r.id, r.deal_id, u.username as reviewer_name, r.score, r.comment, r.created_at
		FROM reviews r JOIN users u ON r.reviewer_id = u.id
		WHERE r.target_id = $1 ORDER BY r.created_at DESC`
	err := r.db.SelectContext(ctx, &reviews, query, userID)
	return reviews, err
}

func (r *UserRepo) GetAllSkillsAdmin(ctx context.Context) ([]domain.AdminSkill, error) {
	var skills []domain.AdminSkill
	query := `
		SELECT s.id, u.username, s.title, s.type, s.price, s.is_active 
		FROM skills s 
		JOIN users u ON s.user_id = u.id 
		ORDER BY s.created_at DESC`
	err := r.db.SelectContext(ctx, &skills, query)
	return skills, err
}

func (r *UserRepo) AdminDeleteSkill(ctx context.Context, skillID string) error {
	_, err := r.db.ExecContext(ctx, "DELETE FROM skills WHERE id = $1", skillID)

	r.clearFeedCache(ctx)

	return err
}

func (r *UserRepo) AdminUpdateSkill(ctx context.Context, skillID string, title string, price int, isActive bool) error {
	query := `UPDATE skills SET title = $1, price = $2, is_active = $3 WHERE id = $4`
	_, err := r.db.ExecContext(ctx, query, title, price, isActive, skillID)
	return err
}

func (r *UserRepo) CleanStaleDeals(ctx context.Context) error {
	var staleDealIDs []string
	query := `
		SELECT id FROM deals 
		WHERE status IN ('pending', 'negotiating') 
		AND created_at < NOW() - INTERVAL '48 hours'
	`
	if err := r.db.SelectContext(ctx, &staleDealIDs, query); err != nil {
		return err
	}

	for _, id := range staleDealIDs {
		if err := r.UpdateDealStatus(ctx, id, "cancelled", nil); err != nil {
			fmt.Printf("Помилка очищення угоди %s: %v\n", id, err)
		}
	}
	return nil
}

func (r *UserRepo) clearFeedCache(ctx context.Context) {
	keys := r.rdb.Keys(ctx, "feed_v2:*").Val()
	if len(keys) > 0 {
		r.rdb.Del(ctx, keys...)
	}
}

func (r *UserRepo) GetDealNotificationData(ctx context.Context, skillID string) (domain.DealNotificationData, error) {
	var data domain.DealNotificationData
	query := `
		SELECT s.title, u.telegram_id 
		FROM skills s
		JOIN users u ON s.user_id = u.id
		WHERE s.id = $1
	`
	err := r.db.GetContext(ctx, &data, query, skillID)
	return data, err
}

func (r *UserRepo) GetDealStatusNotificationData(ctx context.Context, dealID string) (domain.DealStatusNotificationData, error) {
	var data domain.DealStatusNotificationData
	query := `
		SELECT s.title, u_master.telegram_id as master_tg, u_init.telegram_id as initiator_tg
		FROM deals d
		JOIN skills s ON d.skill_id = s.id
		JOIN users u_master ON s.user_id = u_master.id
		JOIN users u_init ON d.initiator_id = u_init.id
		WHERE d.id = $1
	`
	err := r.db.GetContext(ctx, &data, query, dealID)
	return data, err
}

func (r *UserRepo) GetUserTelegramID(ctx context.Context, userID string) (*int64, error) {
	var tgID *int64
	err := r.db.GetContext(ctx, &tgID, "SELECT telegram_id FROM users WHERE id = $1", userID)
	if err != nil || tgID == nil {
		return nil, errors.New("telegram_id не знайдено")
	}
	return tgID, nil
}

func (r *UserRepo) GetLatestNews(ctx context.Context, userID string, limit int) ([]domain.News, error) {
	var news []domain.News
	var err error

	if userID == "" {
		query := `SELECT id, title, content, created_at FROM global_news WHERE user_id IS NULL ORDER BY created_at DESC LIMIT $1`
		err = r.db.SelectContext(ctx, &news, query, limit)
	} else {
		query := `SELECT id, title, content, created_at FROM global_news WHERE user_id IS NULL OR user_id = $1 ORDER BY created_at DESC LIMIT $2`
		err = r.db.SelectContext(ctx, &news, query, userID, limit)
	}

	if err != nil {
		return nil, err
	}

	return news, nil
}

func (r *UserRepo) CreateNews(ctx context.Context, title, content string) error {
	query := `INSERT INTO global_news (title, content, created_at) VALUES ($1, $2, NOW())`
	_, err := r.db.ExecContext(ctx, query, title, content)
	return err
}

func (r *UserRepo) DeleteNews(ctx context.Context, id int) error {
	_, err := r.db.ExecContext(ctx, "DELETE FROM global_news WHERE id = $1", id)
	return err
}

func (r *UserRepo) UpdateNews(ctx context.Context, id int, title, content string) error {
	query := `UPDATE global_news SET title = $1, content = $2 WHERE id = $3`
	_, err := r.db.ExecContext(ctx, query, title, content, id)
	return err
}

func (r *UserRepo) GetCities(ctx context.Context) ([]domain.City, error) {
	var cities []domain.City
	err := r.db.SelectContext(ctx, &cities, "SELECT id, name FROM cities ORDER BY id ASC")
	return cities, err
}

func (r *UserRepo) SaveMessage(ctx context.Context, msg domain.Message) error {
	query := `INSERT INTO messages (deal_id, sender_id, receiver_id, text) VALUES ($1, $2, $3, $4)`
	_, err := r.db.ExecContext(ctx, query, msg.DealID, msg.SenderID, msg.ReceiverID, msg.Text)
	return err
}

func (r *UserRepo) GetDealMessages(ctx context.Context, dealID string) ([]domain.Message, error) {
	var msgs []domain.Message
	query := `SELECT id, deal_id, sender_id, receiver_id, text, created_at FROM messages WHERE deal_id = $1 ORDER BY created_at ASC`
	err := r.db.SelectContext(ctx, &msgs, query, dealID)
	return msgs, err
}

func (r *UserRepo) GetChatHistory(ctx context.Context, user1, user2 string) ([]domain.Message, error) {
	var msgs []domain.Message
	query := `
		SELECT id, deal_id, sender_id, receiver_id, text, created_at 
		FROM messages 
		WHERE (sender_id = $1 AND receiver_id = $2) 
		   OR (sender_id = $2 AND receiver_id = $1)
		ORDER BY created_at ASC
	`
	err := r.db.SelectContext(ctx, &msgs, query, user1, user2)
	return msgs, err
}

func (r *UserRepo) GetUserChats(ctx context.Context, userID string) ([]domain.ChatContact, error) {
	var contacts []domain.ChatContact
	query := `
		WITH LastMessages AS (
			SELECT 
				CASE WHEN sender_id = $1 THEN receiver_id ELSE sender_id END as partner_id,
				text,
				created_at,
				ROW_NUMBER() OVER (
					PARTITION BY CASE WHEN sender_id = $1 THEN receiver_id ELSE sender_id END 
					ORDER BY created_at DESC
				) as rn
			FROM messages
			WHERE sender_id = $1 OR receiver_id = $1
		),
		UnreadCounts AS (
			SELECT sender_id as partner_id, COUNT(*) as unread_count
			FROM messages
			WHERE receiver_id = $1 AND is_read = FALSE
			GROUP BY sender_id
		)
		SELECT 
			lm.partner_id,
			u.username as partner_name,
			u.avatar_url as partner_avatar,
			lm.text as last_message,
			lm.created_at as last_message_at,
			COALESCE(uc.unread_count, 0) as unread_count
		FROM LastMessages lm
		JOIN users u ON u.id::text = lm.partner_id::text
		LEFT JOIN UnreadCounts uc ON uc.partner_id = lm.partner_id
		WHERE lm.rn = 1
		ORDER BY lm.created_at DESC
	`
	err := r.db.SelectContext(ctx, &contacts, query, userID)
	return contacts, err
}

func (r *UserRepo) MarkChatAsRead(ctx context.Context, userID, partnerID string) error {
	query := `UPDATE messages SET is_read = TRUE WHERE receiver_id = $1 AND sender_id = $2 AND is_read = FALSE`
	_, err := r.db.ExecContext(ctx, query, userID, partnerID)
	return err
}

func (r *UserRepo) CreatePersonalNews(ctx context.Context, userID, title, content string) error {
	query := `INSERT INTO global_news (user_id, title, content) VALUES ($1, $2, $3)`
	_, err := r.db.ExecContext(ctx, query, userID, title, content)
	return err
}

func (r *UserRepo) GetMatches(ctx context.Context, userID string) ([]domain.FeedItem, error) {
	var matches []domain.FeedItem
	query := `
		SELECT 
			s.id as skill_id, 
			u.id as user_id, 
			s.type, 
			s.title, 
			s.description, 
			s.price, 
			u.username as user_name, 
			COALESCE(u.avatar_url, '') as user_avatar,
			COALESCE(c.name, 'Ірпінь') as city_name,
			COALESCE(u.rating, 5.0) as user_rating,
			CAST(u.birth_date AS TEXT) as birth_date
		FROM skills s
		JOIN users u ON s.user_id = u.id
		LEFT JOIN cities c ON u.city_id = c.id
		WHERE s.is_active = true 
		  AND s.type = 'teach'
		  AND s.user_id != $1
		  AND EXISTS (
			  SELECT 1 FROM skills my_s 
			  WHERE my_s.user_id = $1 AND my_s.type = 'learn' 
			  AND (s.title ILIKE '%' || my_s.title || '%' OR my_s.title ILIKE '%' || s.title || '%')
		  )
		ORDER BY s.created_at DESC
	`
	err := r.db.SelectContext(ctx, &matches, query, userID)
	if err != nil {
		fmt.Printf("SQL Error GetMatches: %v\n", err)
	}
	return matches, err
}

func (r *UserRepo) CreateCertificate(ctx context.Context, cert *domain.Certificate) error {
	query := `INSERT INTO certificates (id, user_id, type, hours, ects_credits) VALUES ($1, $2, $3, $4, $5)`
	_, err := r.db.ExecContext(ctx, query, cert.ID, cert.UserID, cert.Type, cert.Hours, cert.EctsCredits)
	return err
}

func (r *UserRepo) GetCertificate(ctx context.Context, id string) (*domain.CertificateDetails, error) {
	var cert domain.CertificateDetails
	query := `
		SELECT c.id, c.user_id, COALESCE(u.full_name, u.username) as full_name, c.type, c.hours, c.ects_credits, c.issued_at
		FROM certificates c
		JOIN users u ON c.user_id = u.id
		WHERE c.id = $1`
	err := r.db.GetContext(ctx, &cert, query, id)
	return &cert, err
}

func (r *UserRepo) SetFullName(ctx context.Context, userID, fullName string) error {
	res, err := r.db.ExecContext(ctx, "UPDATE users SET full_name = $1 WHERE id = $2 AND full_name IS NULL", fullName, userID)
	if err != nil {
		return err
	}
	rows, _ := res.RowsAffected()
	if rows == 0 {
		return errors.New("ПІБ вже встановлено або користувача не знайдено")
	}
	return nil
}

func (r *UserRepo) SaveTelegramToken(ctx context.Context, userID string, token string) error {
	_, err := r.db.ExecContext(ctx, "UPDATE users SET telegram_link_token = $1 WHERE id = $2", token, userID)
	return err
}

func (r *UserRepo) LinkTelegram(ctx context.Context, token string, telegramID int64) error {
	res, err := r.db.ExecContext(ctx, "UPDATE users SET telegram_id = $1, telegram_link_token = NULL WHERE telegram_link_token = $2", telegramID, token)
	if err != nil {
		return err
	}

	rows, _ := res.RowsAffected()
	if rows == 0 {
		return errors.New("токен не знайдено або він застарілий")
	}
	return nil
}

func (r *UserRepo) DeleteChatHistory(ctx context.Context, userID, partnerID string) error {
	query := `DELETE FROM messages WHERE (sender_id = $1 AND receiver_id = $2) OR (sender_id = $2 AND receiver_id = $1)`
	_, err := r.db.ExecContext(ctx, query, userID, partnerID)
	return err
}

func (r *UserRepo) ToggleChatPin(ctx context.Context, userID, partnerID string) error {
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO chat_preferences (user_id, partner_id, is_pinned) 
		VALUES ($1, $2, TRUE) 
		ON CONFLICT (user_id, partner_id) 
		DO UPDATE SET is_pinned = NOT chat_preferences.is_pinned`, userID, partnerID)
	return err
}

func (r *UserRepo) ToggleUserBlock(ctx context.Context, userID, partnerID string) error {
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO chat_preferences (user_id, partner_id, is_blocked) 
		VALUES ($1, $2, TRUE) 
		ON CONFLICT (user_id, partner_id) 
		DO UPDATE SET is_blocked = NOT chat_preferences.is_blocked`, userID, partnerID)
	return err
}

func (r *UserRepo) GetChatPreferences(ctx context.Context, userID string) ([]domain.ChatPreference, error) {
	var prefs []domain.ChatPreference
	err := r.db.SelectContext(ctx, &prefs, "SELECT partner_id, is_pinned, is_blocked FROM chat_preferences WHERE user_id = $1", userID)
	return prefs, err
}

func (r *UserRepo) IsBlockedBy(ctx context.Context, senderID, receiverID string) bool {
	var isBlocked bool
	err := r.db.QueryRowContext(ctx, "SELECT is_blocked FROM chat_preferences WHERE user_id = $1 AND partner_id = $2", receiverID, senderID).Scan(&isBlocked)
	if err != nil {
		return false
	}
	return isBlocked
}

func (r *UserRepo) UpdateUserMinutes(ctx context.Context, userID string, balanceDelta, frozenDelta int) error {
	query := `UPDATE users SET balance_minutes = balance_minutes + $1, frozen_minutes = frozen_minutes + $2 WHERE id = $3`
	_, err := r.db.ExecContext(ctx, query, balanceDelta, frozenDelta, userID)
	return err
}

func (r *UserRepo) TransferFrozenToMaster(ctx context.Context, initiatorID, masterID string, minutes int) error {
	tx, err := r.db.BeginTxx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	if _, err := tx.ExecContext(ctx, "UPDATE users SET frozen_minutes = frozen_minutes - $1, learned_minutes = learned_minutes + $1 WHERE id = $2", minutes, initiatorID); err != nil {
		return err
	}
	if _, err := tx.ExecContext(ctx, "UPDATE users SET balance_minutes = balance_minutes + $1, mentored_minutes = mentored_minutes + $1 WHERE id = $2", minutes, masterID); err != nil {
		return err
	}
	return tx.Commit()
}

func (r *UserRepo) SetDealMeetingURL(ctx context.Context, dealID, url string) error {
	_, err := r.db.ExecContext(ctx, "UPDATE deals SET meeting_url = $1 WHERE id = $2", url, dealID)
	return err
}

func (r *UserRepo) GetDealByID(ctx context.Context, id string) (*domain.Deal, error) {
	var deal domain.Deal
	err := r.db.GetContext(ctx, &deal, "SELECT id, skill_id, initiator_id, receiver_id, status, created_at, scheduled_at FROM deals WHERE id = $1", id)
	return &deal, err
}

func (r *UserRepo) GetSkillByID(ctx context.Context, id string) (*domain.Skill, error) {
	var skill domain.Skill
	err := r.db.GetContext(ctx, &skill, "SELECT id, user_id, type, title, description, created_at, price, is_active FROM skills WHERE id = $1", id)
	return &skill, err
}

func (r *UserRepo) GetSystemStats(ctx context.Context) (*domain.SystemStats, error) {
	var stats domain.SystemStats
	query := `
		SELECT 
			(SELECT COUNT(*) FROM users) as total_users,
			(SELECT COUNT(*) FROM skills) as total_skills,
			(SELECT COUNT(*) FROM deals) as total_deals,
			(SELECT COUNT(*) FROM deals WHERE status = 'completed') as completed_deals,
			COALESCE((SELECT SUM(balance_minutes) FROM users), 0) as total_circulating,
			COALESCE((SELECT SUM(frozen_minutes) FROM users), 0) as total_frozen
	`
	err := r.db.GetContext(ctx, &stats, query)
	return &stats, err
}

func (r *UserRepo) GetLeaderboard(ctx context.Context) ([]domain.LeaderboardUser, error) {
	var leaders []domain.LeaderboardUser
	query := `
		SELECT 
			u.id, u.username, COALESCE(u.avatar_url, '') as avatar_url, u.rating,
			(SELECT count(*) FROM reviews WHERE target_id = u.id) as reviews_count,
			(SELECT count(*) FROM deals WHERE receiver_id = u.id AND status = 'completed') as completed_deals
		FROM users u
		WHERE u.rating > 0 OR (SELECT count(*) FROM deals WHERE receiver_id = u.id AND status = 'completed') > 0
		ORDER BY u.rating DESC, reviews_count DESC, completed_deals DESC
		LIMIT 10
	`
	err := r.db.SelectContext(ctx, &leaders, query)
	return leaders, err
}

func (r *UserRepo) GetUserAchievements(ctx context.Context, userID string) ([]domain.Achievement, error) {
	var completedDeals, mentorDeals, fiveStarReviews int
	r.db.GetContext(ctx, &completedDeals, "SELECT count(*) FROM deals WHERE (initiator_id = $1 OR receiver_id = $1) AND status = 'completed'", userID)
	r.db.GetContext(ctx, &mentorDeals, "SELECT count(*) FROM deals WHERE receiver_id = $1 AND status = 'completed'", userID)
	r.db.GetContext(ctx, &fiveStarReviews, "SELECT count(*) FROM reviews WHERE target_id = $1 AND score = 5", userID)

	claimedMap := make(map[string]bool)
	var claimedIDs []string
	r.db.SelectContext(ctx, &claimedIDs, "SELECT achievement_id FROM user_achievements WHERE user_id = $1", userID)
	for _, id := range claimedIDs {
		claimedMap[id] = true
	}

	badges := []domain.Achievement{
		{
			ID: "first_step", Name: "Перший крок", Description: "Завершити 1 угоду", Icon: "🥉",
			IsUnlocked: completedDeals >= 1, CurrentProgress: completedDeals, TargetProgress: 1,
			IsClaimed: claimedMap["first_step"], BonusMinutes: 50,
		},
		{
			ID: "on_fire", Name: "На вогні", Description: "Провести 3 уроки", Icon: "🔥",
			IsUnlocked: mentorDeals >= 3, CurrentProgress: mentorDeals, TargetProgress: 3,
			IsClaimed: claimedMap["on_fire"], BonusMinutes: 100,
		},
		{
			ID: "crowd_fav", Name: "Улюбленець публіки", Description: "5 відгуків на 5⭐", Icon: "⭐",
			IsUnlocked: fiveStarReviews >= 5, CurrentProgress: fiveStarReviews, TargetProgress: 5,
			IsClaimed: claimedMap["crowd_fav"], BonusMinutes: 150,
		},
		{
			ID: "master", Name: "Майстер", Description: "Провести 10 уроків", Icon: "👑",
			IsUnlocked: mentorDeals >= 10, CurrentProgress: mentorDeals, TargetProgress: 10,
			IsClaimed: claimedMap["master"], BonusMinutes: 200,
		},
	}

	for i := range badges {
		if badges[i].CurrentProgress > badges[i].TargetProgress {
			badges[i].CurrentProgress = badges[i].TargetProgress
		}
	}
	return badges, nil
}

func (r *UserRepo) ClaimAchievementBonus(ctx context.Context, userID string, achievementID string) error {
	achievements, err := r.GetUserAchievements(ctx, userID)
	if err != nil {
		return err
	}

	var target *domain.Achievement
	for _, a := range achievements {
		if a.ID == achievementID {
			target = &a
			break
		}
	}

	if target == nil {
		return errors.New("досягнення не знайдено")
	}
	if !target.IsUnlocked {
		return errors.New("досягнення ще не розблоковано")
	}
	if target.IsClaimed {
		return errors.New("бонус вже отримано")
	}

	tx, err := r.db.BeginTxx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	_, err = tx.ExecContext(ctx, "INSERT INTO user_achievements (user_id, achievement_id) VALUES ($1, $2)", userID, achievementID)
	if err != nil {
		return errors.New("помилка запису або бонус вже отримано")
	}

	_, err = tx.ExecContext(ctx, "UPDATE users SET balance_minutes = balance_minutes + $1 WHERE id = $2", target.BonusMinutes, userID)
	if err != nil {
		return err
	}

	return tx.Commit()
}

func (r *UserRepo) CreateReport(ctx context.Context, reporterID, targetType, targetID, reason string, details *string) error {
	query := `INSERT INTO reports (reporter_id, target_type, target_id, reason, details) VALUES ($1, $2, $3, $4, $5)`
	_, err := r.db.ExecContext(ctx, query, reporterID, targetType, targetID, reason, details)
	return err
}

func (r *UserRepo) GetPendingReports(ctx context.Context) ([]domain.Report, error) {
	var reports []domain.Report
	query := `
		SELECT r.*, u.username as reporter_name,
		CASE
			WHEN r.target_type = 'user' THEN (SELECT username FROM users WHERE id = r.target_id)
			WHEN r.target_type = 'skill' THEN (SELECT title FROM skills WHERE id = r.target_id)
			WHEN r.target_type = 'deal' THEN (SELECT 'Угода ' || id FROM deals WHERE id = r.target_id)
			ELSE 'Невідомо'
		END as target_info
		FROM reports r
		JOIN users u ON r.reporter_id = u.id
		WHERE r.status = 'pending'
		ORDER BY r.created_at ASC
	`
	err := r.db.SelectContext(ctx, &reports, query)
	return reports, err
}

func (r *UserRepo) ResolveReport(ctx context.Context, reportID string, status string) error {
	_, err := r.db.ExecContext(ctx, "UPDATE reports SET status = $1 WHERE id = $2", status, reportID)
	return err
}

func (r *UserRepo) GetUpcomingDeals(ctx context.Context) ([]domain.Deal, error) {
	var deals []domain.Deal
	// Шукаємо уроки, які почнуться між 55 і 65 хвилинами від зараз
	query := `
		SELECT id, skill_id, initiator_id, receiver_id, status, created_at, scheduled_at, meeting_url 
		FROM deals 
		WHERE status = 'accepted' 
		  AND scheduled_at IS NOT NULL 
		  AND meeting_url IS NOT NULL
		  AND scheduled_at >= NOW() + INTERVAL '55 minutes'
		  AND scheduled_at <= NOW() + INTERVAL '65 minutes'
	`
	err := r.db.SelectContext(ctx, &deals, query)
	return deals, err
}
