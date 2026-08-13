package repository

import (
	"errors"
	"time"

	"github.com/tigerowo/infinite-canvas/model"
	"gorm.io/gorm"
)

func userConfigTimestamp() string {
	return time.Now().UTC().Format(time.RFC3339Nano)
}

func GetUserConfig(userID string) (model.UserConfig, bool, error) {
	db, err := DB()
	if err != nil {
		return model.UserConfig{}, false, err
	}

	var config model.UserConfig
	err = db.First(&config, "user_id = ?", userID).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return model.UserConfig{}, false, nil
	}
	if err != nil {
		return model.UserConfig{}, false, err
	}
	return config, true, nil
}

func SaveUserConfig(config model.UserConfig) (model.UserConfig, error) {
	db, err := DB()
	if err != nil {
		return config, err
	}

	config.UpdatedAt = userConfigTimestamp()
	return config, db.Save(&config).Error
}
