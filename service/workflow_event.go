package service

import (
	"encoding/json"
	"fmt"

	"github.com/tigerowo/infinite-canvas/model"
	"github.com/tigerowo/infinite-canvas/repository"

	"github.com/google/uuid"
)

// RecordWorkflowEvent 记录单个操作事件。
func RecordWorkflowEvent(projectID, eventType, nodeID, payload, userID, sessionID string) (*model.WorkflowEvent, error) {
	event := model.WorkflowEvent{
		ID:        uuid.NewString(),
		ProjectID: projectID,
		EventType: eventType,
		NodeID:    nodeID,
		Payload:   payload,
		UserID:    userID,
		SessionID: sessionID,
	}
	if err := repository.SaveWorkflowEvent(event); err != nil {
		return nil, fmt.Errorf("记录事件失败: %w", err)
	}
	return &event, nil
}

// BatchRecordWorkflowEvents 批量记录事件。
func BatchRecordWorkflowEvents(events []model.WorkflowEvent) error {
	return repository.BatchSaveWorkflowEvents(events)
}

// ListWorkflowEvents 分页查询事件。
func ListWorkflowEvents(projectID string, since int64, page, pageSize int) (*model.WorkflowEventList, error) {
	items, total, err := repository.ListWorkflowEvents(projectID, since, page, pageSize)
	if err != nil {
		return nil, err
	}
	return &model.WorkflowEventList{
		Items:    items,
		Total:    total,
		Page:     page,
		PageSize: pageSize,
	}, nil
}

// ReplayWorkflowEvents 回放事件流，重建节点和连线。
func ReplayWorkflowEvents(projectID string) (*model.WorkflowReplayResult, error) {
	events, err := repository.GetWorkflowEventsByProject(projectID)
	if err != nil {
		return nil, err
	}

	nodes := []any{}
	edges := []any{}
	nodeMap := map[string]any{}

	for _, e := range events {
		switch e.EventType {
		case model.EventNodeCreated:
			var node any
			if e.Payload != "" {
				_ = json.Unmarshal([]byte(e.Payload), &node)
			}
			if node != nil {
				nodes = append(nodes, node)
				nodeMap[e.NodeID] = node
			}
		case model.EventNodeDeleted:
			delete(nodeMap, e.NodeID)
			nodes = removeFromAnySlice(nodes, e.NodeID)
		case model.EventEdgeAdded:
			var edge any
			if e.Payload != "" {
				_ = json.Unmarshal([]byte(e.Payload), &edge)
			}
			if edge != nil {
				edges = append(edges, edge)
			}
		case model.EventEdgeDeleted:
			edges = removeFromAnySlice(edges, e.NodeID)
		case model.EventNodeMoved, model.EventParamChanged:
			// 位置/参数更新：payload 包含更新后的节点数据
			if e.Payload != "" && e.NodeID != "" {
				var updated any
				_ = json.Unmarshal([]byte(e.Payload), &updated)
				if updated != nil {
					nodeMap[e.NodeID] = updated
				}
			}
		}
	}

	// 从 map 重建有序节点列表
	rebuiltNodes := []any{}
	for _, n := range nodes {
		if id := getNodeID(n); id != "" {
			if updated, ok := nodeMap[id]; ok {
				rebuiltNodes = append(rebuiltNodes, updated)
			} else {
				rebuiltNodes = append(rebuiltNodes, n)
			}
		}
	}

	return &model.WorkflowReplayResult{
		Events: events,
		Nodes:  rebuiltNodes,
		Edges:  edges,
	}, nil
}

func getNodeID(node any) string {
	if m, ok := node.(map[string]any); ok {
		if id, ok := m["id"].(string); ok {
			return id
		}
	}
	return ""
}

func removeFromAnySlice(slice []any, nodeID string) []any {
	result := []any{}
	for _, item := range slice {
		if getNodeID(item) != nodeID {
			result = append(result, item)
		}
	}
	return result
}
