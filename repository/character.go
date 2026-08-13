package repository

import "github.com/tigerowo/infinite-canvas/model"

func ListCharacters(userID string) ([]model.Character, error) {
	db, err := DB()
	if err != nil {
		return nil, err
	}
	var items []model.Character
	err = db.Where("user_id = ?", userID).Order("created_at DESC").Find(&items).Error
	return items, err
}

func GetCharacter(userID string, id string) (model.Character, bool, error) {
	db, err := DB()
	if err != nil {
		return model.Character{}, false, err
	}
	var item model.Character
	err = db.Where("user_id = ? AND id = ?", userID, id).First(&item).Error
	if err != nil {
		return model.Character{}, false, nil
	}
	return item, true, nil
}

func SaveCharacter(item model.Character) (model.Character, error) {
	db, err := DB()
	if err != nil {
		return item, err
	}
	return item, db.Save(&item).Error
}

func DeleteCharacter(userID string, id string) error {
	db, err := DB()
	if err != nil {
		return err
	}
	return db.Where("user_id = ? AND id = ?", userID, id).Delete(&model.Character{}).Error
}
