package service

import (
	"fmt"

	"github.com/tigerowo/infinite-canvas/model"
	"github.com/tigerowo/infinite-canvas/repository"

	"github.com/google/uuid"
)

// ListAssetPrompts 获取素材关联提示词列表。
func ListAssetPrompts(assetID string) ([]model.AssetPromptDetail, error) {
	return repository.ListAssetPrompts(assetID)
}

// BindPromptToAsset 绑定提示词到素材。
func BindPromptToAsset(assetID, promptID, promptType string, sortOrder int) (*model.AssetPrompt, error) {
	// 去重检查
	existing, _ := repository.GetAssetPromptByPromptID(assetID, promptID)
	if existing != nil {
		return existing, nil
	}

	if sortOrder <= 0 {
		sortOrder = 1
	}
	item := model.AssetPrompt{
		ID:        uuid.NewString(),
		AssetID:   assetID,
		PromptID:  promptID,
		Type:      promptType,
		SortOrder: sortOrder,
	}
	saved, err := repository.SaveAssetPrompt(item)
	if err != nil {
		return nil, fmt.Errorf("绑定失败: %w", err)
	}
	return &saved, nil
}

// UnbindPromptFromAsset 解除绑定。
func UnbindPromptFromAsset(id string) error {
	return repository.DeleteAssetPrompt(id)
}
