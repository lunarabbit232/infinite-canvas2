package service

import (
	"github.com/tigerowo/infinite-canvas/logger"
	"strings"
	"time"

	"github.com/tigerowo/infinite-canvas/model"
	"github.com/tigerowo/infinite-canvas/repository"
)

func ListAssets(q model.Query) (model.AssetList, error) {
	items, total, err := repository.ListAssets(q)
	if err != nil {
		return model.AssetList{}, err
	}
	tags, err := repository.ListAssetTags(q)
	if err != nil {
		return model.AssetList{}, err
	}
	return model.AssetList{Items: items, Tags: tags, Total: int(total)}, nil
}

func SaveAsset(item model.Asset) (model.Asset, error) {
	now := time.Now().Format(time.RFC3339)
	if item.Type == "" {
		item.Type = model.AssetTypeText
	}
	if item.ID == "" {
		item.ID = newID("asset")
		item.CreatedAt = now
	}
	item.UpdatedAt = now
	if item.CoverURL == "" {
		item.CoverURL = assetCoverURL(item)
	}
	saved, err := repository.SaveAsset(item)
	if err != nil {
		return saved, err
	}
	indexAssetVector(saved)
	return saved, nil
}

// BatchImportAssets 批量导入素材。
// 每个 item 的 ID/CreatedAt/UpdatedAt 已在调用方预填充。
func BatchImportAssets(items []model.Asset) (model.BatchImportResult, error) {
	now := time.Now().Format(time.RFC3339)
	result := model.BatchImportResult{}

	for i := range items {
		if items[i].Type == "" {
			items[i].Type = model.AssetTypeImage
		}
		if items[i].ID == "" {
			items[i].ID = newID("asset")
		}
		if items[i].CreatedAt == "" {
			items[i].CreatedAt = now
		}
		items[i].UpdatedAt = now
		if items[i].CoverURL == "" {
			items[i].CoverURL = assetCoverURL(items[i])
		}
	}

	saved, err := repository.BatchSaveAssets(items)
	if err != nil {
		return result, err
	}
	for _, a := range saved {
		indexAssetVector(a)
	}
	result.Succeeded = len(saved)
	result.Items = saved
	return result, nil
}

func DeleteAsset(id string) error {
	if err := repository.DeleteAsset(id); err != nil {
		return err
	}
	if err := repository.DeleteAssetVector(id); err != nil {
		logger.Errorf("[语义搜索] 素材向量删除失败（不影响删除）: %v", err)
	}
	return nil
}

// indexAssetVector 为素材生成语义向量并写入 Qdrant。失败不阻断，仅记日志。
func indexAssetVector(item model.Asset) {
	text := strings.TrimSpace(item.Title + " " + item.Description)
	if text == "" {
		return
	}
	if err := repository.UpsertAssetVector(item.ID, text); err != nil {
		logger.Errorf("[语义搜索] 素材向量索引失败（不影响保存）: %v", err)
	}
}

func assetCoverURL(item model.Asset) string {
	if item.CoverURL != "" {
		return item.CoverURL
	}
	if item.Type == model.AssetTypeImage || item.Type == model.AssetTypeVideo {
		return item.URL
	}
	return ""
}
