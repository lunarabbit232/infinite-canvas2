package service

import (
	"context"
	"encoding/json"
	"errors"
	"strings"

	"github.com/tigerowo/infinite-canvas/model"
	"github.com/tigerowo/infinite-canvas/repository"
	"github.com/google/uuid"
)

type CreativeWorkflowPayload struct {
	ID          string          `json:"id"`
	OwnerUserID string          `json:"ownerUserId,omitempty"`
	Scope       string          `json:"scope"`
	Name        string          `json:"name"`
	Category    string          `json:"category"`
	Description string          `json:"description"`
	Data        json.RawMessage `json:"data"`
	CreatedAt   string          `json:"createdAt"`
	UpdatedAt   string          `json:"updatedAt"`
	LastRunAt   string          `json:"lastRunAt,omitempty"`
	Editable    bool            `json:"editable"`
}

type WorkflowAgentDraftRequest struct {
	Prompt      string   `json:"prompt"`
	Scope       string   `json:"scope"`
	Model       string   `json:"model"`
	ChannelID   string   `json:"channelId"`
	ChannelMode string   `json:"channelMode"`
	BaseURL     string   `json:"baseUrl"`
	APIKey      string   `json:"apiKey"`
	References  []string `json:"references"`
}

type WorkflowAgentDraftResponse struct {
	Draft    any      `json:"draft"`
	Warnings []string `json:"warnings"`
	Model    string   `json:"model"`
}

func ListCreativeWorkflows(ctx context.Context) ([]CreativeWorkflowPayload, error) {
	user, ok := UserFromContext(ctx)
	if !ok || user.ID == "" {
		return nil, errors.New("请先登录")
	}
	records, err := repository.ListCreativeWorkflows(user.ID)
	if err != nil {
		return nil, err
	}
	result := make([]CreativeWorkflowPayload, 0, len(records))
	for _, record := range records {
		result = append(result, creativeWorkflowPayload(record, user.ID))
	}
	return result, nil
}

func SaveCreativeWorkflow(ctx context.Context, payload CreativeWorkflowPayload) (CreativeWorkflowPayload, error) {
	user, ok := UserFromContext(ctx)
	if !ok || user.ID == "" {
		return CreativeWorkflowPayload{}, errors.New("请先登录")
	}
	scope := strings.ToLower(strings.TrimSpace(payload.Scope))
	if scope != "public" {
		scope = "private"
	}
	current := now()
	id := strings.TrimSpace(payload.ID)
	var existing model.CreativeWorkflow
	if id != "" {
		record, found, err := repository.GetCreativeWorkflow(id)
		if err != nil {
			return CreativeWorkflowPayload{}, err
		}
		if found {
			if record.OwnerUserID != user.ID {
				return CreativeWorkflowPayload{}, errors.New("只能编辑自己的工作流")
			}
			existing = record
		}
	}
	if id == "" {
		id = uuid.NewString()
	}
	createdAt := existing.CreatedAt
	if createdAt == "" {
		createdAt = current
	}
	record := model.CreativeWorkflow{
		ID:          id,
		OwnerUserID: user.ID,
		Scope:       scope,
		Name:        strings.TrimSpace(payload.Name),
		Category:    strings.TrimSpace(payload.Category),
		Description: strings.TrimSpace(payload.Description),
		Data:        string(payload.Data),
		CreatedAt:   createdAt,
		UpdatedAt:   current,
		LastRunAt:   payload.LastRunAt,
	}
	if record.Name == "" {
		return CreativeWorkflowPayload{}, errors.New("请输入工作流名称")
	}
	if strings.TrimSpace(record.Data) == "" {
		record.Data = "{}"
	}
	saved, err := repository.SaveCreativeWorkflow(record)
	if err != nil {
		return CreativeWorkflowPayload{}, err
	}
	return creativeWorkflowPayload(saved, user.ID), nil
}

func DeleteCreativeWorkflow(ctx context.Context, id string) error {
	user, ok := UserFromContext(ctx)
	if !ok || user.ID == "" {
		return errors.New("请先登录")
	}
	record, found, err := repository.GetCreativeWorkflow(id)
	if err != nil {
		return err
	}
	if !found {
		return nil
	}
	if record.OwnerUserID != user.ID {
		return errors.New("只能删除自己的工作流")
	}
	return repository.DeleteCreativeWorkflow(id)
}

func creativeWorkflowPayload(record model.CreativeWorkflow, currentUserID string) CreativeWorkflowPayload {
	data := json.RawMessage(record.Data)
	if len(data) == 0 {
		data = json.RawMessage(`{}`)
	}
	return CreativeWorkflowPayload{
		ID:          record.ID,
		OwnerUserID: record.OwnerUserID,
		Scope:       record.Scope,
		Name:        record.Name,
		Category:    record.Category,
		Description: record.Description,
		Data:        data,
		CreatedAt:   record.CreatedAt,
		UpdatedAt:   record.UpdatedAt,
		LastRunAt:   record.LastRunAt,
		Editable:    record.OwnerUserID == currentUserID,
	}
}

func EvaluateWorkflowBranch(workflowData map[string]any, stepID string, stepResult map[string]any) model.EvaluateBranchResponse {
	conditions, _ := workflowData["conditions"].(map[string]any)
	if conditions == nil {
		return model.EvaluateBranchResponse{}
	}
	branches, _ := conditions[stepID].(map[string]any)
	if branches == nil {
		return model.EvaluateBranchResponse{}
	}
	status := strings.ToLower(strings.TrimSpace(toStringSafe(stepResult["status"])))
	var branch string
	switch status {
	case "completed", "success":
		branch = "success"
	case "failed", "error":
		branch = "failure"
	default:
		branch = status
	}
	if branch == "" {
		branch = "success"
	}
	nextID := toStringSafe(branches[branch])
	if nextID == "" {
		nextID = toStringSafe(branches["default"])
	}
	return model.EvaluateBranchResponse{NextStepID: nextID, Branch: branch}
}

func toStringSafe(value any) string {
	switch typed := value.(type) {
	case string:
		return typed
	case nil:
		return ""
	default:
		encoded, _ := json.Marshal(typed)
		return strings.Trim(string(encoded), `"`)
	}
}
