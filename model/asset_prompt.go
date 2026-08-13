package model

// AssetPrompt 素材-提示词关联。
type AssetPrompt struct {
	ID        string `json:"id" gorm:"primaryKey"`
	AssetID   string `json:"assetId" gorm:"index"`
	PromptID  string `json:"promptId" gorm:"index"`
	Type      string `json:"type"` // "positive" / "negative"
	SortOrder int    `json:"sortOrder"`
	CreatedAt string `json:"createdAt"`
	UpdatedAt string `json:"updatedAt"`
}

// AssetPromptDetail 关联提示词详情（含提示词完整信息）。
type AssetPromptDetail struct {
	AssetPrompt
	PromptTitle string   `json:"promptTitle"`
	PromptText  string   `json:"promptText"`
	PromptTags  []string `json:"promptTags"`
	Category    string   `json:"category"`
}
