package repository

import (
	"github.com/tigerowo/infinite-canvas/model"
)

// ListAssetPrompts 获取素材关联的所有提示词。
func ListAssetPrompts(assetID string) ([]model.AssetPromptDetail, error) {
	db, err := DB()
	if err != nil {
		return nil, err
	}
	var items []model.AssetPromptDetail
	err = db.Table("asset_prompts").
		Select("asset_prompts.*, prompts.title as prompt_title, prompts.prompt as prompt_text, prompts.tags as prompt_tags, prompts.category").
		Joins("left join prompts on prompts.id = asset_prompts.prompt_id").
		Where("asset_prompts.asset_id = ?", assetID).
		Order("asset_prompts.sort_order asc").
		Find(&items).Error
	return items, err
}

// SaveAssetPrompt 创建或更新素材-提示词关联。
func SaveAssetPrompt(item model.AssetPrompt) (model.AssetPrompt, error) {
	db, err := DB()
	if err != nil {
		return item, err
	}
	err = db.Save(&item).Error
	return item, err
}

// DeleteAssetPrompt 删除素材-提示词关联。
func DeleteAssetPrompt(id string) error {
	db, err := DB()
	if err != nil {
		return err
	}
	return db.Delete(&model.AssetPrompt{}, "id = ?", id).Error
}

// GetAssetPromptByPromptID 检查关联是否已存在。
func GetAssetPromptByPromptID(assetID, promptID string) (*model.AssetPrompt, error) {
	db, err := DB()
	if err != nil {
		return nil, err
	}
	var item model.AssetPrompt
	err = db.Where("asset_id = ? AND prompt_id = ?", assetID, promptID).First(&item).Error
	if err != nil {
		return nil, err
	}
	return &item, nil
}
