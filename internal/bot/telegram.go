package bot

import (
	"context"
	"crypto/rand"
	"fmt"
	tgbotapi "github.com/go-telegram-bot-api/telegram-bot-api/v5"
	"log"
	"math/big"
	"skillswap-irpin/internal/domain"
)

type TelegramBot struct {
	api    *tgbotapi.BotAPI
	userUC domain.UserUseCase
}

func NewBot(token string, userUC domain.UserUseCase) (*TelegramBot, error) {
	bot, err := tgbotapi.NewBotAPI(token)
	if err != nil {
		return nil, err
	}
	log.Printf("🤖 Авторизовано в боті: %s", bot.Self.UserName)
	return &TelegramBot{api: bot, userUC: userUC}, nil
}

func (b *TelegramBot) sendAuthCode(chatID int64, userID int64) {
	val, err := rand.Int(rand.Reader, big.NewInt(1000000))
	if err != nil {
		log.Printf("Помилка генерації коду: %v", err)
		return
	}
	code := fmt.Sprintf("%06d", val.Int64())

	err = b.userUC.SetAuthCode(context.Background(), userID, code)
	if err != nil {
		log.Printf("🚨 ПОМИЛКА: Не вдалося зберегти код для telegram_id=%d. Деталі: %v", userID, err)
		b.api.Send(tgbotapi.NewMessage(chatID, "🚨 Помилка генерації коду. Перевірте консоль сервера або натисніть /start"))
		return
	}

	msg := tgbotapi.NewMessage(chatID, "🔐 Твій код для входу: "+code+"\n\nПросто введи його на сайті!")
	b.api.Send(msg)
}

func (b *TelegramBot) SendNotification(telegramID int64, text string) error {
	msg := tgbotapi.NewMessage(telegramID, text)
	msg.ParseMode = "HTML"
	_, err := b.api.Send(msg)
	return err
}

func (b *TelegramBot) Start() {
	u := tgbotapi.NewUpdate(0)
	u.Timeout = 60
	updates := b.api.GetUpdatesChan(u)

	for update := range updates {
		if update.Message == nil {
			continue
		}

		if update.Message.IsCommand() && update.Message.Command() == "start" {

			deepLinkToken := update.Message.CommandArguments()

			if deepLinkToken != "" {
				err := b.userUC.LinkTelegram(context.Background(), deepLinkToken, update.Message.From.ID)

				if err != nil {
					log.Printf("🚨 Помилка прив'язки для токена %s: %v", deepLinkToken, err)
					b.api.Send(tgbotapi.NewMessage(update.Message.Chat.ID, "❌ Посилання недійсне або застаріле. Спробуйте згенерувати нове на сайті."))
					continue
				}

				msg := tgbotapi.NewMessage(update.Message.Chat.ID, "✅ <b>Успішно!</b>\n\nВаш Telegram прив'язано до платформи Synapse. Тепер ви будете отримувати тут сповіщення про нові заявки та повідомлення!")
				msg.ParseMode = "HTML"
				b.api.Send(msg)
				continue
			}

			user, err := b.userUC.GetProfile(context.Background(), update.Message.From.ID)
			if err == nil && user != nil {
				b.sendAuthCode(update.Message.Chat.ID, update.Message.From.ID)
				continue
			}

			msg := tgbotapi.NewMessage(update.Message.Chat.ID, "Привіт! 👋\nЩоб увійти або зареєструватися, поділіться своїм номером телефону.")
			btn := tgbotapi.NewKeyboardButtonContact("📱 Поділитися контактом")
			keyboard := tgbotapi.NewReplyKeyboard([]tgbotapi.KeyboardButton{btn})
			keyboard.ResizeKeyboard = true
			msg.ReplyMarkup = keyboard
			b.api.Send(msg)
			continue
		}

		if update.Message.Contact != nil {
			contact := update.Message.Contact

			if contact.UserID != update.Message.From.ID {
				b.api.Send(tgbotapi.NewMessage(update.Message.Chat.ID, "🚨 Будь ласка, відправте саме СВІЙ контакт."))
				continue
			}

			existingUser, _ := b.userUC.GetProfile(context.Background(), contact.UserID)
			if existingUser != nil {
				msg := tgbotapi.NewMessage(update.Message.Chat.ID, "✅ Ваш акаунт знайдено в системі!")
				msg.ReplyMarkup = tgbotapi.NewRemoveKeyboard(true)
				b.api.Send(msg)

				b.sendAuthCode(update.Message.Chat.ID, contact.UserID)
				continue
			}

			username := update.Message.From.UserName
			if username == "" {
				username = update.Message.From.FirstName
			}

			_, err := b.userUC.RegisterUser(context.Background(), contact.UserID, &username, &contact.PhoneNumber)

			if err != nil {
				log.Printf("🚨 Помилка при реєстрації юзера: %v", err)
				b.api.Send(tgbotapi.NewMessage(update.Message.Chat.ID, "🚨 Сталася помилка при реєстрації в базі даних."))
				continue
			}

			msg := tgbotapi.NewMessage(update.Message.Chat.ID, "✅ Контакт підтверджено! Ваш акаунт створено.")
			msg.ReplyMarkup = tgbotapi.NewRemoveKeyboard(true) // Ховаємо кнопку
			b.api.Send(msg)

			b.sendAuthCode(update.Message.Chat.ID, contact.UserID)
			continue
		}

		if update.Message.IsCommand() && update.Message.Command() == "login" {
			b.sendAuthCode(update.Message.Chat.ID, update.Message.From.ID)
		}
	}
}
