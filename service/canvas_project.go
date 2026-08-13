package service

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"time"

	"github.com/tigerowo/infinite-canvas/model"
	"github.com/tigerowo/infinite-canvas/repository"
)

type canvasEdge struct {
	Source       string `json:"source"`
	Target       string `json:"target"`
	SourceHandle string `json:"sourceHandle"`
	TargetHandle string `json:"targetHandle"`
}

type canvasNode struct {
	ID   string `json:"id"`
	Type string `json:"type"`
}

type canvasProjectData struct {
	Nodes []canvasNode `json:"nodes"`
	Edges []canvasEdge `json:"edges"`
}

type canvasProjectMetadata struct {
	ID        string `json:"id"`
	CreatedAt string `json:"createdAt"`
	UpdatedAt string `json:"updatedAt"`
}

func canvasProjectFromRaw(
	userID string,
	raw json.RawMessage,
) (model.CanvasProject, error) {
	var metadata canvasProjectMetadata
	if len(raw) == 0 || json.Unmarshal(raw, &metadata) != nil {
		return model.CanvasProject{}, errors.New("画布项目数据无效")
	}

	metadata.ID = strings.TrimSpace(metadata.ID)
	metadata.CreatedAt = strings.TrimSpace(metadata.CreatedAt)
	metadata.UpdatedAt = strings.TrimSpace(metadata.UpdatedAt)
	if metadata.ID == "" || metadata.CreatedAt == "" ||
		metadata.UpdatedAt == "" {
		return model.CanvasProject{}, errors.New("画布项目数据无效")
	}

	return model.CanvasProject{
		UserID:      strings.TrimSpace(userID),
		ID:          metadata.ID,
		ProjectData: string(raw),
		CreatedAt:   metadata.CreatedAt,
		UpdatedAt:   metadata.UpdatedAt,
	}, nil
}

func canvasProjectsToRaw(
	projects []model.CanvasProject,
) []json.RawMessage {
	result := make([]json.RawMessage, 0, len(projects))
	for _, project := range projects {
		if strings.TrimSpace(project.ProjectData) != "" {
			result = append(
				result,
				json.RawMessage(project.ProjectData),
			)
		}
	}
	return result
}

func CurrentUserCanvasProjects(
	ctx context.Context,
) ([]json.RawMessage, error) {
	user, ok := UserFromContext(ctx)
	if !ok || user.ID == "" {
		return nil, errors.New("请先登录")
	}

	projects, err := repository.ListUserCanvasProjects(user.ID)
	if err != nil {
		return nil, err
	}
	return canvasProjectsToRaw(projects), nil
}

func SaveCurrentUserCanvasProject(
	ctx context.Context,
	raw json.RawMessage,
) (json.RawMessage, error) {
	user, ok := UserFromContext(ctx)
	if !ok || user.ID == "" {
		return nil, errors.New("请先登录")
	}

	project, err := canvasProjectFromRaw(user.ID, raw)
	if err != nil {
		return nil, err
	}
	saved, err := repository.SaveUserCanvasProject(project)
	if err != nil {
		return nil, err
	}
	if saved.DeletedAt != "" {
		return nil, errors.New("画布项目已删除")
	}
	return json.RawMessage(saved.ProjectData), nil
}

func SyncCurrentUserCanvasProjects(
	ctx context.Context,
	rawProjects []json.RawMessage,
) ([]json.RawMessage, error) {
	user, ok := UserFromContext(ctx)
	if !ok || user.ID == "" {
		return nil, errors.New("请先登录")
	}

	projects := make([]model.CanvasProject, 0, len(rawProjects))
	for _, raw := range rawProjects {
		project, err := canvasProjectFromRaw(user.ID, raw)
		if err != nil {
			return nil, err
		}
		projects = append(projects, project)
	}

	saved, err := repository.SaveUserCanvasProjects(user.ID, projects)
	if err != nil {
		return nil, err
	}
	return canvasProjectsToRaw(saved), nil
}

func DeleteCurrentUserCanvasProjects(
	ctx context.Context,
	projectIDs []string,
) error {
	user, ok := UserFromContext(ctx)
	if !ok || user.ID == "" {
		return errors.New("请先登录")
	}

	for _, projectID := range projectIDs {
		if strings.TrimSpace(projectID) != "" {
			return repository.SoftDeleteUserCanvasProjects(
				user.ID,
				projectIDs,
				time.Now().UTC().Format(time.RFC3339Nano),
			)
		}
	}
	return errors.New("画布项目参数无效")
}

func ResolveCanvasEdges(ctx context.Context, projectID string, targetNodeID string) (model.ResolveCanvasEdgesResponse, error) {
	user, ok := UserFromContext(ctx)
	if !ok || user.ID == "" {
		return model.ResolveCanvasEdgesResponse{}, errors.New("请先登录")
	}

	project, found, err := repository.GetUserCanvasProject(user.ID, projectID)
	if err != nil {
		return model.ResolveCanvasEdgesResponse{}, err
	}
	if !found {
		return model.ResolveCanvasEdgesResponse{}, errors.New("画布项目不存在")
	}

	var data canvasProjectData
	if err := json.Unmarshal([]byte(project.ProjectData), &data); err != nil {
		return model.ResolveCanvasEdgesResponse{}, errors.New("画布项目数据解析失败")
	}

	var edges []model.ResolvedCanvasEdge
	for _, edge := range data.Edges {
		if edge.Target != targetNodeID {
			continue
		}
		portType := resolvePortType(edge.TargetHandle)
		if imageTask, found, _ := repository.GetLatestCompletedCanvasImageTaskByNode(user.ID, edge.Source); found {
			edges = append(edges, model.ResolvedCanvasEdge{
				SourceNodeID: edge.Source,
				PortType:     portType,
				ImageURL:     imageTask.ImageURL,
				ImageTaskID:  imageTask.ID,
				Status:       imageTask.Status,
			})
		}
	}

	return model.ResolveCanvasEdgesResponse{Edges: edges}, nil
}

func resolvePortType(targetHandle string) string {
	switch strings.ToLower(strings.TrimSpace(targetHandle)) {
	case "firstframe", "first_frame", "first-frame":
		return "firstFrame"
	case "lastframe", "last_frame", "last-frame":
		return "lastFrame"
	default:
		return "reference"
	}
}
