package repository

import (
	"errors"
	"strings"

	"github.com/tigerowo/infinite-canvas/model"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

func ListUserCanvasProjects(userID string) ([]model.CanvasProject, error) {
	db, err := DB()
	if err != nil {
		return nil, err
	}

	var projects []model.CanvasProject
	err = db.Where(
		"user_id = ? AND deleted_at = ''",
		strings.TrimSpace(userID),
	).Order("updated_at DESC").Find(&projects).Error
	return projects, err
}

func GetUserCanvasProject(userID string, projectID string) (model.CanvasProject, bool, error) {
	db, err := DB()
	if err != nil {
		return model.CanvasProject{}, false, err
	}
	var project model.CanvasProject
	err = db.Where("user_id = ? AND id = ? AND deleted_at = ''", userID, projectID).First(&project).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return model.CanvasProject{}, false, nil
	}
	if err != nil {
		return model.CanvasProject{}, false, err
	}
	return project, true, nil
}

func SaveUserCanvasProject(
	project model.CanvasProject,
) (model.CanvasProject, error) {
	db, err := DB()
	if err != nil {
		return project, err
	}

	project.UserID = strings.TrimSpace(project.UserID)
	project.ID = strings.TrimSpace(project.ID)

	var current model.CanvasProject
	err = db.First(
		&current,
		"user_id = ? AND id = ?",
		project.UserID,
		project.ID,
	).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return project, db.Create(&project).Error
	}
	if err != nil {
		return project, err
	}
	if current.DeletedAt != "" || current.UpdatedAt > project.UpdatedAt {
		return current, nil
	}

	result := db.Model(&model.CanvasProject{}).
		Where(
			"user_id = ? AND id = ? AND deleted_at = '' AND updated_at <= ?",
			project.UserID,
			project.ID,
			project.UpdatedAt,
		).
		Updates(map[string]any{
			"project_data": project.ProjectData,
			"updated_at":   project.UpdatedAt,
		})
	if result.Error != nil {
		return project, result.Error
	}
	if result.RowsAffected == 0 {
		if err := db.First(
			&current,
			"user_id = ? AND id = ?",
			project.UserID,
			project.ID,
		).Error; err != nil {
			return project, err
		}
		return current, nil
	}
	return project, nil
}

func SaveUserCanvasProjects(
	userID string,
	projects []model.CanvasProject,
) ([]model.CanvasProject, error) {
	for _, project := range projects {
		project.UserID = userID
		if _, err := SaveUserCanvasProject(project); err != nil {
			return nil, err
		}
	}
	return ListUserCanvasProjects(userID)
}

func SoftDeleteUserCanvasProjects(
	userID string,
	ids []string,
	deletedAt string,
) error {
	ids = uniqueTrimmedValues(ids...)
	if len(ids) == 0 {
		return nil
	}

	db, err := DB()
	if err != nil {
		return err
	}

	records := make([]model.CanvasProject, 0, len(ids))
	for _, id := range ids {
		records = append(records, model.CanvasProject{
			UserID:    strings.TrimSpace(userID),
			ID:        id,
			CreatedAt: deletedAt,
			UpdatedAt: deletedAt,
			DeletedAt: deletedAt,
		})
	}

	return db.Clauses(clause.OnConflict{
		Columns: []clause.Column{
			{Name: "user_id"},
			{Name: "id"},
		},
		DoUpdates: clause.AssignmentColumns([]string{
			"project_data",
			"updated_at",
			"deleted_at",
		}),
	}).Create(&records).Error
}

func CleanupDeletedCanvasProjects(before string) error {
	db, err := DB()
	if err != nil {
		return err
	}

	return db.Where(
		"deleted_at <> '' AND deleted_at < ?",
		before,
	).Delete(&model.CanvasProject{}).Error
}
