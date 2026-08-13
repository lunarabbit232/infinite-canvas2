package service

import (
	"github.com/tigerowo/infinite-canvas/logger"
	"time"

	"github.com/tigerowo/infinite-canvas/model"
	"github.com/tigerowo/infinite-canvas/repository"
)

func ListPrompts(q model.Query) (model.PromptList, error) {
	items, total, err := repository.ListPrompts(q)
	if err != nil {
		return model.PromptList{}, err
	}
	tags, err := repository.ListPromptTags(q)
	if err != nil {
		return model.PromptList{}, err
	}
	categories := promptCategoryCodes(ListPromptCategories())
	return model.PromptList{Items: items, Tags: tags, Categories: categories, Total: int(total)}, nil
}

func ListPromptCategories() []model.PromptCategory {
	categories, _ := repository.ListPromptCategories()
	return categories
}

func ListPromptsByIDs(ids []string) ([]model.Prompt, error) {
	return repository.ListPromptsByIDs(ids)
}

func SavePrompt(item model.Prompt) (model.Prompt, error) {
	now := time.Now().Format(time.RFC3339)
	if item.Category == "" {
		item.Category = repository.PromptCategories()[0].Category
	}
	if item.ID == "" {
		item.ID = newID(item.Category)
		item.CreatedAt = now
	} else {
		// 合并已有数据：只更新非空字段
		existing, err := repository.GetPromptByID(item.ID)
		if err == nil {
			if item.Title == "" { item.Title = existing.Title }
			if item.Prompt == "" { item.Prompt = existing.Prompt }
			if len(item.Tags) == 0 { item.Tags = existing.Tags }
			if item.CoverURL == "" { item.CoverURL = existing.CoverURL }
			if item.Preview == "" { item.Preview = existing.Preview }
			if item.CreatedAt == "" { item.CreatedAt = existing.CreatedAt }
		}
	}
	item.UpdatedAt = now
	category, ok := repository.PromptCategoryByCode(item.Category)
	if !ok {
		category = repository.PromptCategories()[0]
		item.Category = category.Category
	}
	item.GithubURL = ""
	return repository.SavePrompt(item)
}

func DeletePrompt(id string) error {
	if err := repository.DeletePrompt(id); err != nil {
		return err
	}
	if err := repository.DeletePromptVector(id); err != nil {
		logger.Errorf("[语义搜索] 提示词向量删除失败（不影响删除）: %v", err)
	}
	return nil
}

func DeletePrompts(ids []string) error {
	if len(ids) == 0 {
		return nil
	}
	if err := repository.DeletePrompts(ids); err != nil {
		return err
	}
	for _, id := range ids {
		if err := repository.DeletePromptVector(id); err != nil {
			logger.Errorf("[语义搜索] 提示词向量删除失败（不影响删除）: %v", err)
		}
	}
	return nil
}

func promptCategoryCodes(items []model.PromptCategory) []string {
	codes := []string{}
	for _, item := range items {
		if item.Category != "" {
			codes = append(codes, item.Category)
		}
	}
	return codes
}
