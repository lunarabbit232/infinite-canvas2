package model

type AssetType string

const (
	AssetTypeText  AssetType = "text"
	AssetTypeImage AssetType = "image"
	AssetTypeVideo AssetType = "video"
	AssetTypeAudio AssetType = "audio"
)

// AssetTag 素材标签（支持层级、颜色）。
type AssetTag struct {
	Name   string `json:"name"`
	Color  string `json:"color,omitempty"`
	Parent string `json:"parent,omitempty"`
}

// Asset 素材记录。
type Asset struct {
	ID          string     `json:"id" gorm:"primaryKey"`
	Title       string     `json:"title"`
	Type        AssetType  `json:"type"`
	CoverURL    string     `json:"coverUrl"`
	Tags        []AssetTag `json:"tags" gorm:"serializer:json"`
	Category    string     `json:"category"`
	Description string     `json:"description"`
	Content     string     `json:"content,omitempty"`
	URL         string     `json:"url,omitempty"`
	// 多维分类
	Usage  string `json:"usage"`  // 剧本/配音/参考图/音效
	Style  string `json:"style"`  // 写实/二次元/赛博朋克
	Source string `json:"source"` // 自上传/模板库/社区
	// 文件元数据
	FileSize   int64  `json:"fileSize,omitempty"`
	MimeType   string `json:"mimeType,omitempty"`
	DurationMs int64  `json:"durationMs,omitempty"`
	Width      int    `json:"width,omitempty"`
	Height     int    `json:"height,omitempty"`
	CreatedAt  string `json:"createdAt"`
	UpdatedAt  string `json:"updatedAt"`
}

// AssetList 素材分页结果。
type AssetList struct {
	Items []Asset  `json:"items"`
	Tags  []string `json:"tags"`
	Total int      `json:"total"`
}

// BatchImportResult 批量导入结果。
type BatchImportResult struct {
	Succeeded int     `json:"succeeded"`
	Failed    int     `json:"failed"`
	Items     []Asset `json:"items"`
	Errors    []string `json:"errors,omitempty"`
}
