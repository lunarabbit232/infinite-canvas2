package service

import (
	"strings"

	"github.com/tigerowo/infinite-canvas/model"
	"github.com/tigerowo/infinite-canvas/repository"
)

func ListUserProps(userID string) ([]model.Prop, error) {
	return repository.ListProps(strings.TrimSpace(userID))
}

func SaveProp(item model.Prop) (model.Prop, error) {
	item.UserID = strings.TrimSpace(item.UserID)
	item.Name = strings.TrimSpace(item.Name)
	if item.ID == "" {
		item.ID = newID("prop")
	}
	item.UpdatedAt = now()
	if item.CreatedAt == "" {
		item.CreatedAt = item.UpdatedAt
	}
	return repository.SaveProp(item)
}

func DeleteProp(userID string, id string) error {
	return repository.DeleteProp(strings.TrimSpace(userID), strings.TrimSpace(id))
}
