package repository

import (
	"errors"

	"github.com/tigerowo/infinite-canvas/model"
	"gorm.io/gorm"
)

func ListCreativeWorkflows(userID string) ([]model.CreativeWorkflow, error) {
	db, err := DB()
	if err != nil {
		return nil, err
	}
	var workflows []model.CreativeWorkflow
	err = db.Where("scope = ? OR owner_user_id = ?", "public", userID).Order("updated_at DESC").Find(&workflows).Error
	return workflows, err
}

func GetCreativeWorkflow(id string) (model.CreativeWorkflow, bool, error) {
	db, err := DB()
	if err != nil {
		return model.CreativeWorkflow{}, false, err
	}
	var workflow model.CreativeWorkflow
	err = db.First(&workflow, "id = ?", id).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return model.CreativeWorkflow{}, false, nil
		}
		return model.CreativeWorkflow{}, false, err
	}
	return workflow, true, nil
}

func SaveCreativeWorkflow(workflow model.CreativeWorkflow) (model.CreativeWorkflow, error) {
	db, err := DB()
	if err != nil {
		return workflow, err
	}
	return workflow, db.Save(&workflow).Error
}

func DeleteCreativeWorkflow(id string) error {
	db, err := DB()
	if err != nil {
		return err
	}
	return db.Delete(&model.CreativeWorkflow{}, "id = ?", id).Error
}
