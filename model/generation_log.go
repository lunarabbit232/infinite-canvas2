package model

type VideoGenerationLog struct {
	ID          string `json:"id" gorm:"primaryKey"`
	UserID      string `json:"userId" gorm:"index;index:idx_video_generation_logs_user_deleted_created,priority:1"`
	TaskID      string `json:"taskId" gorm:"index"`
	VideoID     string `json:"videoId" gorm:"index"`
	Status      string `json:"status" gorm:"index"`
	PayloadJSON string `json:"payloadJson" gorm:"type:text"`
	CreatedAt   string `json:"createdAt" gorm:"index;index:idx_video_generation_logs_user_deleted_created,priority:3"`
	UpdatedAt   string `json:"updatedAt" gorm:"index"`
	DeletedAt   string `json:"deletedAt" gorm:"index;index:idx_video_generation_logs_user_deleted_created,priority:2"`
}

type ImageGenerationLog struct {
	ID          string `json:"id" gorm:"primaryKey"`
	UserID      string `json:"userId" gorm:"index;index:idx_image_generation_logs_user_deleted_created,priority:1"`
	TaskID      string `json:"taskId" gorm:"index"`
	ImageID     string `json:"imageId" gorm:"index"`
	Status      string `json:"status" gorm:"index"`
	PayloadJSON string `json:"payloadJson" gorm:"type:text"`
	CreatedAt   string `json:"createdAt" gorm:"index;index:idx_image_generation_logs_user_deleted_created,priority:3"`
	UpdatedAt   string `json:"updatedAt" gorm:"index"`
	DeletedAt   string `json:"deletedAt" gorm:"index;index:idx_image_generation_logs_user_deleted_created,priority:2"`
}
