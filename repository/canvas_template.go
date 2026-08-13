package repository

import (
	"github.com/tigerowo/infinite-canvas/model"
	"gorm.io/gorm"
)

// SaveCanvasTemplate 保存模板。
func SaveCanvasTemplate(item model.CanvasTemplate) (model.CanvasTemplate, error) {
	db, err := DB()
	if err != nil {
		return item, err
	}
	err = db.Save(&item).Error
	return item, err
}

// ListCanvasTemplates 分页查询模板。
func ListCanvasTemplates(keyword string, page, pageSize int) ([]model.CanvasTemplate, int64, error) {
	db, err := DB()
	if err != nil {
		return nil, 0, err
	}
	if pageSize <= 0 {
		pageSize = 20
	}
	if page <= 0 {
		page = 1
	}
	tx := db.Model(&model.CanvasTemplate{})
	if keyword != "" {
		like := "%" + keyword + "%"
		tx = tx.Where("title LIKE ? OR description LIKE ?", like, like)
	}
	var total int64
	if err := tx.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var items []model.CanvasTemplate
	err = tx.Order("updated_at desc").Offset((page - 1) * pageSize).Limit(pageSize).Find(&items).Error
	return items, total, err
}

// GetCanvasTemplateByID 获取模板详情。
func GetCanvasTemplateByID(id string) (*model.CanvasTemplate, error) {
	db, err := DB()
	if err != nil {
		return nil, err
	}
	var item model.CanvasTemplate
	err = db.Where("id = ?", id).First(&item).Error
	if err != nil {
		return nil, err
	}
	return &item, nil
}

// DeleteCanvasTemplate 删除模板。
func DeleteCanvasTemplate(id string) error {
	db, err := DB()
	if err != nil {
		return err
	}
	return db.Where("id = ?", id).Delete(&model.CanvasTemplate{}).Error
}

// IncrementCanvasTemplateUse 模板使用次数 +1。
func IncrementCanvasTemplateUse(id string) error {
	db, err := DB()
	if err != nil {
		return err
	}
	return db.Model(&model.CanvasTemplate{}).Where("id = ?", id).
		UpdateColumn("use_count", gorm.Expr("use_count + 1")).Error
}

// AdjustCanvasTemplateFavorite 模板收藏数增减（delta 为 ±1，下限 0）。
func AdjustCanvasTemplateFavorite(id string, delta int) error {
	db, err := DB()
	if err != nil {
		return err
	}
	return db.Model(&model.CanvasTemplate{}).Where("id = ?", id).
		UpdateColumn("favorite_count", gorm.Expr("MAX(favorite_count + ?, 0)", delta)).Error
}

// ListFeaturedCanvasTemplates 热门模板：按 收藏数 + 使用数×2 排序。
func ListFeaturedCanvasTemplates(limit int) ([]model.CanvasTemplate, error) {
	db, err := DB()
	if err != nil {
		return nil, err
	}
	if limit <= 0 {
		limit = 10
	}
	var items []model.CanvasTemplate
	err = db.Model(&model.CanvasTemplate{}).
		Where("scope = ? OR scope = ''", "public").
		Order("favorite_count + use_count * 2 desc, updated_at desc").
		Limit(limit).Find(&items).Error
	return items, err
}
