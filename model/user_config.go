package model

// UserConfig 用户配置和同步数据。
type UserConfig struct {
	UserID          string `json:"userId" gorm:"primaryKey"`
	ModelConfig     string `json:"modelConfig" gorm:"type:text"`
	StorageProvider string `json:"storageProvider" gorm:"type:text"`
	ImageHistory    string `json:"imageHistory" gorm:"type:text"`
	AssetData       string `json:"assetData" gorm:"type:text"`
	CreatedAt       string `json:"createdAt"`
	UpdatedAt       string `json:"updatedAt"`
}
