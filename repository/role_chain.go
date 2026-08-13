package repository

import "github.com/tigerowo/infinite-canvas/model"

func GetRoleChainByUser(userID string) (*model.RoleChain, error) {
	db, err := DB()
	if err != nil {
		return nil, err
	}
	var chain model.RoleChain
	err = db.Where("user_id = ?", userID).First(&chain).Error
	if err != nil {
		return nil, err
	}
	return &chain, nil
}

func SaveRoleChain(chain model.RoleChain) (model.RoleChain, error) {
	db, err := DB()
	if err != nil {
		return chain, err
	}
	return chain, db.Save(&chain).Error
}

func DeleteRoleChain(userID string) error {
	db, err := DB()
	if err != nil {
		return err
	}
	return db.Where("user_id = ?", userID).Delete(&model.RoleChain{}).Error
}

func ListRoleChainMentees(mentorID string) ([]model.RoleChain, error) {
	db, err := DB()
	if err != nil {
		return nil, err
	}
	var chains []model.RoleChain
	err = db.Where("mentor_id = ?", mentorID).Find(&chains).Error
	return chains, err
}
