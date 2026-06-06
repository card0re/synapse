package service

import (
	"fmt"
	"log"
	"net/smtp"
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

func (s *emailService) SendAsync(to, subject, body string) {
	s.jobChannel <- EmailPayload{
		To:      to,
		Subject: subject,
		Body:    body,
	}
}

func (s *emailService) send(job EmailPayload) error {
	time.Sleep(2 * time.Second)

	from := "skillswapir@gmail.com"
	password := "***REMOVED-SMTP-PASSWORD***"
	smtpHost := "smtp.gmail.com"
	smtpPort := "587"

	auth := smtp.PlainAuth("", from, password, smtpHost)

	msg := []byte(fmt.Sprintf("To: %s\r\nSubject: %s\r\n\r\n%s", job.To, job.Subject, job.Body))

	return smtp.SendMail(smtpHost+":"+smtpPort, auth, from, []string{job.To}, msg)

	return nil
}
