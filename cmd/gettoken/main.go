package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"

	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
	"google.golang.org/api/calendar/v3"
)

func main() {
	b, err := os.ReadFile("credentials.json")
	if err != nil {
		log.Fatalf("Не вдалося прочитати credentials.json: %v", err)
	}

	config, err := google.ConfigFromJSON(b, calendar.CalendarEventsScope)
	if err != nil {
		log.Fatalf("Не вдалося обробити конфігурацію: %v", err)
	}

	config.RedirectURL = "https://synapse.tel/api/auth/google/callback"

	http.HandleFunc("/api/auth/google/login", func(w http.ResponseWriter, r *http.Request) {
		authURL := config.AuthCodeURL("state-token", oauth2.AccessTypeOffline, oauth2.ApprovalForce)
		http.Redirect(w, r, authURL, http.StatusFound)
	})

	http.HandleFunc("/api/auth/google/callback", func(w http.ResponseWriter, r *http.Request) {
		code := r.URL.Query().Get("code")
		if code == "" {
			http.Error(w, "Код не знайдено", http.StatusBadRequest)
			return
		}

		tok, err := config.Exchange(context.TODO(), code)
		if err != nil {
			http.Error(w, "Не вдалося обміняти код на токен", http.StatusInternalServerError)
			return
		}

		f, err := os.OpenFile("token.json", os.O_RDWR|os.O_CREATE|os.O_TRUNC, 0600)
		if err != nil {
			http.Error(w, "Не вдалося зберегти токен", http.StatusInternalServerError)
			return
		}
		defer f.Close()
		json.NewEncoder(f).Encode(tok)

		fmt.Fprintf(w, "Ура! Файл token.json успішно створено. Тепер можна закрити цю вкладку і зупинити скрипт у терміналі.")

		go func() {
			os.Exit(0)
		}()
	})

	fmt.Println("=== СИСТЕМА АВТОРИЗАЦІЇ GOOGLE ===")
	fmt.Println("1. Відкрий у браузері посилання:")
	fmt.Println("   https://synapse.tel/api/auth/google/login")
	fmt.Println("2. Увійди через свій Google-акаунт і надай дозволи.")
	fmt.Println("Очікування...")
	log.Fatal(http.ListenAndServe(":3000", nil))
}
