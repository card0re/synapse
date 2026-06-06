package service

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"strings"

	"github.com/google/generative-ai-go/genai"
	"google.golang.org/api/option"
)

type AIService interface {
	ModerateSkill(ctx context.Context, title, description string) (bool, string)
	GetSmartMatches(ctx context.Context, userBio string, allSkillsJSON string) ([]string, error)
}

type aiService struct{}

func NewAIService() AIService {
	return &aiService{}
}

func (s *aiService) ModerateSkill(ctx context.Context, title, description string) (bool, string) {
	apiKey := os.Getenv("GEMINI_API_KEY")
	if apiKey == "" {
		return true, ""
	}

	client, err := genai.NewClient(ctx, option.WithAPIKey(apiKey))
	if err != nil {
		return true, ""
	}
	defer client.Close()

	model := client.GenerativeModel("gemini-3.5-flash")
	model.SafetySettings = []*genai.SafetySetting{
		{Category: genai.HarmCategoryDangerousContent, Threshold: genai.HarmBlockNone},
		{Category: genai.HarmCategoryHarassment, Threshold: genai.HarmBlockNone},
		{Category: genai.HarmCategoryHateSpeech, Threshold: genai.HarmBlockNone},
		{Category: genai.HarmCategorySexuallyExplicit, Threshold: genai.HarmBlockNone},
	}

	model.SystemInstruction = &genai.Content{
		Parts: []genai.Part{
			genai.Text("Ти строгий модератор платформи обміну навичками. Заборони: нецензурна лексика, ескорт, наркотики, зброя, насилля. Якщо все добре: 'STATUS: OK'. Якщо є порушення: 'STATUS: REJECT | <причина>'."),
		},
	}

	prompt := fmt.Sprintf("Назва: %s\nОпис: %s", title, description)
	resp, err := model.GenerateContent(ctx, genai.Text(prompt))
	if err != nil {
		return false, "Підозра на заборонений контент"
	}

	if len(resp.Candidates) > 0 {
		cand := resp.Candidates[0]
		if cand.FinishReason == genai.FinishReasonSafety {
			return false, "Цей контент порушує правила безпеки"
		}
		if len(cand.Content.Parts) > 0 {
			aiResponse := fmt.Sprintf("%v", cand.Content.Parts[0])
			if strings.Contains(strings.ToUpper(aiResponse), "STATUS: REJECT") {
				parts := strings.Split(aiResponse, "|")
				reason := "Порушення правил"
				if len(parts) > 1 {
					reason = strings.TrimSpace(parts[1])
				}
				return false, reason
			}
		}
	}

	return true, ""
}

func (s *aiService) GetSmartMatches(ctx context.Context, userBio string, allSkillsJSON string) ([]string, error) {
	apiKey := os.Getenv("GEMINI_API_KEY")
	if apiKey == "" {
		return nil, fmt.Errorf("api key not set")
	}

	client, err := genai.NewClient(ctx, option.WithAPIKey(apiKey))
	if err != nil {
		return nil, err
	}
	defer client.Close()

	model := client.GenerativeModel("gemini-3.1-flash-lite")
	model.ResponseMIMEType = "application/json"

	prompt := fmt.Sprintf(`
Ти AI-Метчмейкер платформи Synapse. 
Ось біографія та інтереси користувача: "%s".

Ось список доступних навичок на платформі у форматі JSON:
%s

Обери від 1 до 5 найкращих навичок, які ідеально підходять цьому користувачу. 
Поверни результат СУВОРО як JSON-масив рядків (ID навичок). 
Приклад відповіді: ["id1", "id2", "id3"]
Нічого більше, тільки JSON масив.`, userBio, allSkillsJSON)

	resp, err := model.GenerateContent(ctx, genai.Text(prompt))
	if err != nil {
		return nil, err
	}

	if len(resp.Candidates) > 0 && len(resp.Candidates[0].Content.Parts) > 0 {
		aiResponse := fmt.Sprintf("%v", resp.Candidates[0].Content.Parts[0])

		aiResponse = strings.TrimPrefix(aiResponse, "```json")
		aiResponse = strings.TrimSuffix(aiResponse, "```")
		aiResponse = strings.TrimSpace(aiResponse)

		var matchedIDs []string
		if err := json.Unmarshal([]byte(aiResponse), &matchedIDs); err != nil {
			log.Printf("Помилка парсингу відповіді ШІ: %v. Відповідь: %s", err, aiResponse)
			return nil, err
		}

		return matchedIDs, nil
	}

	return nil, fmt.Errorf("no response from AI")
}
