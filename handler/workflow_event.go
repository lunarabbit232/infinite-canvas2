package handler

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/tigerowo/infinite-canvas/model"
	"github.com/tigerowo/infinite-canvas/service"
)

// RecordWorkflowEvent 记录工作流操作事件。
func RecordWorkflowEvent(w http.ResponseWriter, r *http.Request) {
	var body struct {
		ProjectID string `json:"projectId"`
		EventType string `json:"eventType"`
		NodeID    string `json:"nodeId"`
		Payload   string `json:"payload"`
		UserID    string `json:"userId"`
		SessionID string `json:"sessionId"`
	}
	_ = json.NewDecoder(r.Body).Decode(&body)
	if body.ProjectID == "" || body.EventType == "" {
		Fail(w, "缺少 projectId 或 eventType")
		return
	}
	event, err := service.RecordWorkflowEvent(body.ProjectID, body.EventType, body.NodeID, body.Payload, body.UserID, body.SessionID)
	if err != nil {
		FailError(w, err)
		return
	}
	OK(w, event)
}

// BatchRecordWorkflowEvents 批量记录事件。
func BatchRecordWorkflowEvents(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Events []model.WorkflowEvent `json:"events"`
	}
	_ = json.NewDecoder(r.Body).Decode(&body)
	if len(body.Events) == 0 {
		Fail(w, "事件列表为空")
		return
	}
	if err := service.BatchRecordWorkflowEvents(body.Events); err != nil {
		FailError(w, err)
		return
	}
	OK(w, nil)
}

// ListWorkflowEvents 分页查询工作流事件。
func ListWorkflowEvents(w http.ResponseWriter, r *http.Request) {
	projectID := r.URL.Query().Get("projectId")
	if projectID == "" {
		Fail(w, "缺少 projectId")
		return
	}
	since, _ := strconv.ParseInt(r.URL.Query().Get("since"), 10, 64)
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	pageSize, _ := strconv.Atoi(r.URL.Query().Get("pageSize"))
	result, err := service.ListWorkflowEvents(projectID, since, page, pageSize)
	if err != nil {
		FailError(w, err)
		return
	}
	OK(w, result)
}

// ReplayWorkflowEvents 回放事件流。
func ReplayWorkflowEvents(w http.ResponseWriter, r *http.Request) {
	projectID := r.URL.Query().Get("projectId")
	if projectID == "" {
		Fail(w, "缺少 projectId")
		return
	}
	result, err := service.ReplayWorkflowEvents(projectID)
	if err != nil {
		FailError(w, err)
		return
	}
	OK(w, result)
}
