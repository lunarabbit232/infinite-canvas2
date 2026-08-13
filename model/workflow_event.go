package model

// WorkflowEvent 工作流操作事件（Event Sourcing 不可变记录）。
type WorkflowEvent struct {
	ID        string `json:"id" gorm:"primaryKey"`
	ProjectID string `json:"projectId" gorm:"index"`
	EventType string `json:"eventType"`
	NodeID    string `json:"nodeId"`
	Payload   string `json:"payload"` // JSON: {old, new, ...}
	Timestamp int64  `json:"timestamp"`
	UserID    string `json:"userId"`
	SessionID string `json:"sessionId"`
}

// 事件类型枚举
const (
	EventNodeCreated  = "node_created"
	EventNodeDeleted  = "node_deleted"
	EventNodeMoved    = "node_moved"
	EventEdgeAdded    = "edge_added"
	EventEdgeDeleted  = "edge_deleted"
	EventParamChanged = "param_changed"
	EventAIGenerated  = "ai_generated"
)

// WorkflowEventList 事件分页结果。
type WorkflowEventList struct {
	Items    []WorkflowEvent `json:"items"`
	Total    int64           `json:"total"`
	Page     int             `json:"page"`
	PageSize int             `json:"pageSize"`
}

// WorkflowReplayResult 回放结果。
type WorkflowReplayResult struct {
	Events []WorkflowEvent `json:"events"`
	Nodes  []any           `json:"nodes"`  // 重建后的节点列表
	Edges  []any           `json:"edges"`  // 重建后的连线列表
}
