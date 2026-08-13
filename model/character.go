package model

type ColorScheme struct {
	Primary  string `json:"primary"`
	Accent   string `json:"accent"`
	Accent2  string `json:"accent2,omitempty"`
}

type Character struct {
	ID                  string       `json:"id" gorm:"primaryKey"`
	UserID              string       `json:"userId" gorm:"index"`
	Name                string       `json:"name"`
	Description         string       `json:"description"`
	PersonalityKeywords []string     `json:"personalityKeywords" gorm:"serializer:json"`
	ColorScheme         *ColorScheme `json:"colorScheme,omitempty" gorm:"serializer:json"`
	CoverURL            string       `json:"coverUrl"`
	ReferenceURLs       []string     `json:"referenceUrls" gorm:"serializer:json"`
	PromptTemplate      string       `json:"promptTemplate"`
	VoiceURL            string       `json:"voiceUrl"`
	SceneURLs           []string     `json:"sceneUrls" gorm:"serializer:json"`
	CreatedAt           string       `json:"createdAt"`
	UpdatedAt           string       `json:"updatedAt"`
}

type GenerateCharacterViewsRequest struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	Gender      string `json:"gender"`
	Style       string `json:"style"`
}

type CharacterViewPrompt struct {
	Type   string `json:"type"`
	Prompt string `json:"prompt"`
}

type GenerateCharacterViewsResponse struct {
	Views []CharacterViewPrompt `json:"views"`
}
