package repository

import (
	"sort"

	"github.com/tigerowo/infinite-canvas/model"
)

func ListKnowledgeEntries(category string) ([]model.KnowledgeEntry, error) {
	db, err := DB()
	if err != nil {
		return nil, err
	}
	var items []model.KnowledgeEntry
	q := db.Order("created_at DESC")
	if category != "" {
		q = q.Where("category = ?", category)
	}
	err = q.Find(&items).Error
	return items, err
}

func SaveKnowledgeEntry(item model.KnowledgeEntry) (model.KnowledgeEntry, error) {
	db, err := DB()
	if err != nil {
		return item, err
	}
	return item, db.Save(&item).Error
}

func DeleteKnowledgeEntry(id string) error {
	db, err := DB()
	if err != nil {
		return err
	}
	return db.Where("id = ?", id).Delete(&model.KnowledgeEntry{}).Error
}

func ListKnowledgeByUser(userID string, category string) ([]model.KnowledgeEntry, error) {
	db, err := DB()
	if err != nil {
		return nil, err
	}
	var items []model.KnowledgeEntry
	q := db.Order("created_at DESC")
	if category != "" {
		q = q.Where("category = ?", category)
	}
	q = q.Where("user_id = ?", userID)
	err = q.Find(&items).Error
	return items, err
}

func ListRoleKnowledge(userID string, mentorIDs []string, category string) ([]model.KnowledgeEntry, error) {
	db, err := DB()
	if err != nil {
		return nil, err
	}
	var items []model.KnowledgeEntry
	q := db.Order("created_at DESC")
	if category != "" {
		q = q.Where("category = ?", category)
	}
	q = q.Where("user_id = '' OR user_id = ? OR (user_id IN ? AND visibility IN ?)",
		userID, mentorIDs, []model.KnowledgeVisibility{model.KnowledgeVisibilityPublic, model.KnowledgeVisibilityMentees})
	err = q.Find(&items).Error
	return items, err
}

// ListKnowledgeByIDs 按 ID 列表取知识条目，保留传入的 ID 顺序（向量相关性降序），
// 并复用 ListRoleKnowledge 的可见范围过滤（全局 + 自己 + 导师公开/可传学员）。
func ListKnowledgeByIDs(ids []string, userID string, mentorIDs []string, category string) ([]model.KnowledgeEntry, error) {
	if len(ids) == 0 {
		return []model.KnowledgeEntry{}, nil
	}
	db, err := DB()
	if err != nil {
		return nil, err
	}
	var items []model.KnowledgeEntry
	q := db.Where("id IN ?", ids)
	if category != "" {
		q = q.Where("category = ?", category)
	}
	q = q.Where("user_id = '' OR user_id = ? OR (user_id IN ? AND visibility IN ?)",
		userID, mentorIDs, []model.KnowledgeVisibility{model.KnowledgeVisibilityPublic, model.KnowledgeVisibilityMentees})
	if err := q.Find(&items).Error; err != nil {
		return nil, err
	}
	order := make(map[string]int, len(ids))
	for i, id := range ids {
		order[id] = i
	}
	sort.SliceStable(items, func(i, j int) bool {
		return order[items[i].ID] < order[items[j].ID]
	})
	return items, nil
}

func DeleteKnowledgeByUser(userID string) error {
	db, err := DB()
	if err != nil {
		return err
	}
	return db.Where("user_id = ?", userID).Delete(&model.KnowledgeEntry{}).Error
}
