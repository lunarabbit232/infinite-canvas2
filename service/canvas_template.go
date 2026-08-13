package service

import (
	"github.com/tigerowo/infinite-canvas/model"
	"github.com/tigerowo/infinite-canvas/repository"

	"github.com/google/uuid"
)

// SaveCanvasTemplate 保存模板。
func SaveCanvasTemplate(item model.CanvasTemplate) (*model.CanvasTemplate, error) {
	if item.ID == "" {
		item.ID = uuid.NewString()
	}
	if item.Scope == "" {
		item.Scope = "public"
	}
	saved, err := repository.SaveCanvasTemplate(item)
	if err != nil {
		return nil, err
	}
	return &saved, nil
}

// ListCanvasTemplates 分页查询模板。
func ListCanvasTemplates(keyword string, page, pageSize int) (*model.TemplateList, error) {
	items, total, err := repository.ListCanvasTemplates(keyword, page, pageSize)
	if err != nil {
		return nil, err
	}
	return &model.TemplateList{Items: items, Total: total}, nil
}

// InstantiateCanvasTemplate 导入模板并创建新画布项目数据。
func InstantiateCanvasTemplate(id string) (string, error) {
	tpl, err := repository.GetCanvasTemplateByID(id)
	if err != nil {
		return "", err
	}
	// 使用次数 +1（失败不阻塞导入）
	_ = repository.IncrementCanvasTemplateUse(id)
	// 返回模板数据，前端负责用新 ID 实例化
	return tpl.TemplateData, nil
}

// FavoriteCanvasTemplate 收藏/取消收藏模板（favorite=true 收藏，false 取消）。
func FavoriteCanvasTemplate(id string, favorite bool) error {
	if favorite {
		return repository.AdjustCanvasTemplateFavorite(id, 1)
	}
	return repository.AdjustCanvasTemplateFavorite(id, -1)
}

// FeaturedCanvasTemplates 热门推荐模板。
func FeaturedCanvasTemplates(limit int) ([]model.CanvasTemplate, error) {
	return repository.ListFeaturedCanvasTemplates(limit)
}

// DeleteCanvasTemplate 删除模板。
func DeleteCanvasTemplate(id string) error {
	return repository.DeleteCanvasTemplate(id)
}
