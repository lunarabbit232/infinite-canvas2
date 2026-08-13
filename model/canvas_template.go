package model

// CanvasTemplate 画布模板。
type CanvasTemplate struct {
	ID            string   `json:"id" gorm:"primaryKey"`
	Title         string   `json:"title"`
	Description   string   `json:"description"`
	Category      string   `json:"category"`
	CoverURL      string   `json:"coverUrl"`
	TemplateData  string   `json:"templateData"` // JSON: {nodes, edges, prompts, assets}
	Tags          []string `json:"tags" gorm:"serializer:json"`
	Scope         string   `json:"scope"`              // public / private
	OwnerUserID   string   `json:"ownerUserId,omitempty"` // 创建者，private 模板归属
	UseCount      int      `json:"useCount"`           // 使用次数
	FavoriteCount int      `json:"favoriteCount"`      // 收藏数
	CreatedAt     string   `json:"createdAt"`
	UpdatedAt     string   `json:"updatedAt"`
}

// TemplateList 模板分页结果。
type TemplateList struct {
	Items []CanvasTemplate `json:"items"`
	Total int64            `json:"total"`
}
