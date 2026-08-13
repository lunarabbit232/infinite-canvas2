package repository

import (
	"github.com/tigerowo/infinite-canvas/model"
	"gorm.io/gorm"
)

// ListAssets 按查询条件返回素材分页列表。
func ListAssets(q model.Query) ([]model.Asset, int64, error) {
	db, err := DB()
	if err != nil {
		return nil, 0, err
	}
	q.Normalize()
	tx := applyAssetFilters(db.Model(&model.Asset{}), q)

	var total int64
	if err := tx.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var items []model.Asset
	err = tx.Order("updated_at desc").Offset(q.Offset()).Limit(q.PageSize).Find(&items).Error
	return items, total, err
}

// ListAssetTags 返回去重后的素材标签名列表。
func ListAssetTags(q model.Query) ([]string, error) {
	db, err := DB()
	if err != nil {
		return nil, err
	}
	q.Normalize()
	q.Tags = nil
	tx := applyAssetFilters(db.Model(&model.Asset{}), q)

	var items []model.Asset
	if err := tx.Select("tags").Find(&items).Error; err != nil {
		return nil, err
	}
	return assetTagNames(items), nil
}

// ListAssetsByIDs 按 ID 列表查询素材。
func ListAssetsByIDs(ids []string) ([]model.Asset, error) {
	db, err := DB()
	if err != nil {
		return nil, err
	}
	if len(ids) == 0 {
		return []model.Asset{}, nil
	}
	var items []model.Asset
	err = db.Where("id IN ?", ids).Find(&items).Error
	return items, err
}

// SaveAsset 保存素材。
func SaveAsset(item model.Asset) (model.Asset, error) {
	db, err := DB()
	if err != nil {
		return item, err
	}
	if saved, ok, err := findAsset(db, item.ID); err != nil {
		return item, err
	} else if ok && item.CreatedAt == "" {
		item.CreatedAt = saved.CreatedAt
	}
	return item, db.Save(&item).Error
}

// BatchSaveAssets 批量保存素材。
func BatchSaveAssets(items []model.Asset) ([]model.Asset, error) {
	if len(items) == 0 {
		return items, nil
	}
	db, err := DB()
	if err != nil {
		return nil, err
	}
	err = db.Create(&items).Error
	return items, err
}

// DeleteAsset 删除指定素材。
func DeleteAsset(id string) error {
	db, err := DB()
	if err != nil {
		return err
	}
	return db.Delete(&model.Asset{}, "id = ?", id).Error
}

// applyAssetFilters 应用素材列表搜索条件。
func applyAssetFilters(tx *gorm.DB, q model.Query) *gorm.DB {
	if q.Keyword != "" {
		like := "%" + q.Keyword + "%"
		tx = tx.Where("title LIKE ? OR description LIKE ? OR content LIKE ?", like, like, like)
	}
	if isActiveAssetOption(q.Type) {
		tx = tx.Where("type = ?", q.Type)
	}
	if q.Usage != "" {
		tx = tx.Where("usage = ?", q.Usage)
	}
	if q.Style != "" {
		tx = tx.Where("style = ?", q.Style)
	}
	return applyAssetTagsFilter(tx, q.Tags)
}

func findAsset(db *gorm.DB, id string) (model.Asset, bool, error) {
	item := model.Asset{}
	err := db.Where("id = ?", id).First(&item).Error
	if err == gorm.ErrRecordNotFound {
		return model.Asset{}, false, nil
	}
	return item, err == nil, err
}

func applyAssetTagsFilter(tx *gorm.DB, tags []string) *gorm.DB {
	if len(tags) == 0 {
		return tx
	}
	for _, tag := range tags {
		tx = tx.Where(assetJSONTagsContains(tx), tag)
	}
	return tx
}

func assetTagNames(items []model.Asset) []string {
	seen := map[string]bool{}
	names := []string{}
	for _, item := range items {
		for _, tag := range item.Tags {
			if tag.Name != "" && !seen[tag.Name] {
				seen[tag.Name] = true
				names = append(names, tag.Name)
			}
		}
	}
	return names
}

func assetJSONTagsContains(tx *gorm.DB) string {
	switch tx.Dialector.Name() {
	case "mysql":
		return "JSON_CONTAINS(tags, JSON_QUOTE(?))"
	case "postgres":
		return "jsonb_exists(tags::jsonb, ?)"
	default:
		return "EXISTS (SELECT 1 FROM json_each(tags) WHERE json_extract(value, '$.name') = ?)"
	}
}

func isActiveAssetOption(value string) bool {
	return value != "" && value != "全部" && value != "all"
}
