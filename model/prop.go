package model

type Prop struct {
	ID            string   `json:"id" gorm:"primaryKey"`
	UserID        string   `json:"userId" gorm:"index"`
	Name          string   `json:"name"`
	Description   string   `json:"description"`
	Category      string   `json:"category"`
	CoverURL      string   `json:"coverUrl"`
	ReferenceURLs []string `json:"referenceUrls" gorm:"serializer:json"`
	PromptTemplate string  `json:"promptTemplate"`
	CreatedAt     string   `json:"createdAt"`
	UpdatedAt     string   `json:"updatedAt"`
}
