package repository

import (
	"time"

	"github.com/tigerowo/infinite-canvas/model"
)

// SaveWorkflowEvent 保存操作事件。
func SaveWorkflowEvent(event model.WorkflowEvent) error {
	db, err := DB()
	if err != nil {
		return err
	}
	if event.Timestamp == 0 {
		event.Timestamp = time.Now().UnixMilli()
	}
	return db.Create(&event).Error
}

// BatchSaveWorkflowEvents 批量保存事件。
func BatchSaveWorkflowEvents(events []model.WorkflowEvent) error {
	if len(events) == 0 {
		return nil
	}
	db, err := DB()
	if err != nil {
		return err
	}
	return db.CreateInBatches(events, 100).Error
}

// ListWorkflowEvents 按项目 + 时间范围查询事件。
func ListWorkflowEvents(projectID string, since int64, page, pageSize int) ([]model.WorkflowEvent, int64, error) {
	db, err := DB()
	if err != nil {
		return nil, 0, err
	}
	if pageSize <= 0 {
		pageSize = 50
	}
	if page <= 0 {
		page = 1
	}
	tx := db.Model(&model.WorkflowEvent{}).Where("project_id = ?", projectID)
	if since > 0 {
		tx = tx.Where("timestamp >= ?", since)
	}
	var total int64
	if err := tx.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var items []model.WorkflowEvent
	err = tx.Order("timestamp asc").Offset((page - 1) * pageSize).Limit(pageSize).Find(&items).Error
	return items, total, err
}

// GetWorkflowEventsByProject 获取项目的全部事件（用于回放）。
func GetWorkflowEventsByProject(projectID string) ([]model.WorkflowEvent, error) {
	db, err := DB()
	if err != nil {
		return nil, err
	}
	var items []model.WorkflowEvent
	err = db.Where("project_id = ?", projectID).Order("timestamp asc").Find(&items).Error
	return items, err
}

// DeleteWorkflowEvents 删除项目的事件记录。
func DeleteWorkflowEvents(projectID string) error {
	db, err := DB()
	if err != nil {
		return err
	}
	return db.Where("project_id = ?", projectID).Delete(&model.WorkflowEvent{}).Error
}
