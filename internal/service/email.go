package service

import (
	"errors"
	"fmt"
	"log"
	"mime"
	"net/smtp"
	"os"
	"time"
)

type EmailPayload struct {
	To      string
	Subject string
	Body    string
}

type EmailService interface {
	Start()
	SendAsync(to, subject, body string)
}

type emailService struct {
	jobChannel chan EmailPayload
}

func NewEmailService() EmailService {
	return &emailService{
		jobChannel: make(chan EmailPayload, 100),
	}
}

func (s *emailService) Start() {
	log.Println("✉️ Воркер email-сповіщень успішно запущено")

	for job := range s.jobChannel {
		err := s.send(job)
		if err != nil {
			log.Printf("🚨 Помилка відправки email на %s: %v\n", job.To, err)
		} else {
			log.Printf("✅ Фоновий Email успішно відправлено на %s\n", job.To)
		}
	}
}

// SendAsync не чекає місця в черзі. Воркер віддає один лист на дві секунди,
// тож після сотого запису відправка блокувала сам http-хендлер, аж поки
// Cloud Run не обірве запит — а черга наповнюється з відкритого
// /users/verify-email/send. Переповнення тепер коштує лист, а не застряглий запит.
func (s *emailService) SendAsync(to, subject, body string) {
	select {
	case s.jobChannel <- EmailPayload{To: to, Subject: subject, Body: body}:
	default:
		log.Printf("🚨 Черга email переповнена, лист на %s відкинуто\n", to)
	}
}

func (s *emailService) send(job EmailPayload) error {
	// Gmail тротлить послідовні відправки з одного акаунта.
	time.Sleep(2 * time.Second)

	from := os.Getenv("SMTP_EMAIL")
	password := os.Getenv("SMTP_PASSWORD")
	if from == "" || password == "" {
		return errors.New("SMTP_EMAIL або SMTP_PASSWORD не задано")
	}
	smtpHost := "smtp.gmail.com"
	smtpPort := "587"

	auth := smtp.PlainAuth("", from, password, smtpHost)

	// Без MIME-заголовків кирилична тема й текст приїжджають абракадаброю.
	msg := []byte(fmt.Sprintf(
		"From: %s\r\nTo: %s\r\nSubject: %s\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n%s",
		from, job.To, mime.QEncoding.Encode("UTF-8", job.Subject), job.Body))

	return smtp.SendMail(smtpHost+":"+smtpPort, auth, from, []string{job.To}, msg)
}
