package model

// Tag 标签（支持层级分类）。
type Tag struct {
	ID        int64  `json:"id" gorm:"primaryKey;autoIncrement"`
	Name      string `json:"name" gorm:"index"`
	NameZh    string `json:"nameZh"`
	Level     int    `json:"level"` // 1=一级分类, 2=二级标签
	ParentID  int64  `json:"parentId"`
	Category  string `json:"category"` // 所属一级分类名
	SortOrder int    `json:"sortOrder"`
}

// TagSynonym 标签同义词。
type TagSynonym struct {
	ID     int64  `json:"id" gorm:"primaryKey;autoIncrement"`
	TagID  int64  `json:"tagId" gorm:"index"`
	Synonym string `json:"synonym"`
}

// TagTree 带子标签的层级结构。
type TagTree struct {
	Tag      Tag    `json:"tag"`
	Children []Tag  `json:"children,omitempty"`
	Synonyms []string `json:"synonyms,omitempty"`
}
