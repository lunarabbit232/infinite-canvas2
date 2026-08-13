package model

type KnowledgeVisibility string

const (
	KnowledgeVisibilityPublic   KnowledgeVisibility = "public"
	KnowledgeVisibilityMentees  KnowledgeVisibility = "mentees"
	KnowledgeVisibilityPrivate  KnowledgeVisibility = "private"
)

type KnowledgeEntry struct {
	ID         string              `json:"id" gorm:"primaryKey"`
	UserID     string              `json:"userId" gorm:"index"`
	Category   string              `json:"category" gorm:"index"`
	Title      string              `json:"title"`
	Content    string              `json:"content"`
	Keywords   string              `json:"keywords"`
	Visibility KnowledgeVisibility `json:"visibility"`
	CreatedAt  string              `json:"createdAt"`
	UpdatedAt  string              `json:"updatedAt"`
}
