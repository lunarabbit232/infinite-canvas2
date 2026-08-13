package repository

import "github.com/tigerowo/infinite-canvas/model"

func ListProps(userID string) ([]model.Prop, error) {
	db, err := DB()
	if err != nil {
		return nil, err
	}
	var items []model.Prop
	err = db.Where("user_id = ?", userID).Order("created_at DESC").Find(&items).Error
	return items, err
}

func SaveProp(item model.Prop) (model.Prop, error) {
	db, err := DB()
	if err != nil {
		return item, err
	}
	return item, db.Save(&item).Error
}

func DeleteProp(userID string, id string) error {
	db, err := DB()
	if err != nil {
		return err
	}
	return db.Where("user_id = ? AND id = ?", userID, id).Delete(&model.Prop{}).Error
}
