package model

type CanvasProject struct {
	UserID      string `json:"userId" gorm:"primaryKey;index:idx_canvas_projects_user_deleted_updated,priority:1"`
	ID          string `json:"id" gorm:"primaryKey"`
	ProjectData string `json:"projectData" gorm:"type:text"`
	CreatedAt   string `json:"createdAt"`
	UpdatedAt   string `json:"updatedAt" gorm:"index:idx_canvas_projects_user_deleted_updated,priority:3"`
	DeletedAt   string `json:"deletedAt" gorm:"not null;default:'';index:idx_canvas_projects_deleted_at;index:idx_canvas_projects_user_deleted_updated,priority:2"`
}

type ResolveCanvasEdgesRequest struct {
	ProjectID    string `json:"projectId"`
	TargetNodeID string `json:"targetNodeId"`
}

type ResolvedCanvasEdge struct {
	SourceNodeID string `json:"sourceNodeId"`
	PortType     string `json:"portType"`
	ImageURL     string `json:"imageUrl"`
	ImageTaskID  string `json:"imageTaskId"`
	Status       string `json:"status"`
}

type ResolveCanvasEdgesResponse struct {
	Edges []ResolvedCanvasEdge `json:"edges"`
}
