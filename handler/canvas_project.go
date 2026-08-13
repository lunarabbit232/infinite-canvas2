package handler

import (
	"encoding/json"
	"net/http"

	"github.com/tigerowo/infinite-canvas/model"
	"github.com/tigerowo/infinite-canvas/service"
)

func UserCanvasProjects(w http.ResponseWriter, r *http.Request) {
	projects, err := service.CurrentUserCanvasProjects(r.Context())
	if err != nil {
		FailError(w, err)
		return
	}
	OK(w, projects)
}

func SaveUserCanvasProject(w http.ResponseWriter, r *http.Request) {
	var request struct {
		Data json.RawMessage `json:"data"`
	}
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil ||
		len(request.Data) == 0 {
		Fail(w, "数据内容不能为空")
		return
	}

	project, err := service.SaveCurrentUserCanvasProject(
		r.Context(),
		request.Data,
	)
	if err != nil {
		FailError(w, err)
		return
	}
	OK(w, project)
}

func SyncUserCanvasProjects(w http.ResponseWriter, r *http.Request) {
	var request struct {
		Projects []json.RawMessage `json:"projects"`
	}
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		Fail(w, "画布项目参数无效")
		return
	}

	projects, err := service.SyncCurrentUserCanvasProjects(
		r.Context(),
		request.Projects,
	)
	if err != nil {
		FailError(w, err)
		return
	}
	OK(w, projects)
}

func ResolveCanvasProjectEdges(w http.ResponseWriter, r *http.Request) {
	var request model.ResolveCanvasEdgesRequest
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		Fail(w, "请求参数无效")
		return
	}
	if request.ProjectID == "" || request.TargetNodeID == "" {
		Fail(w, "projectId 和 targetNodeId 不能为空")
		return
	}
	result, err := service.ResolveCanvasEdges(r.Context(), request.ProjectID, request.TargetNodeID)
	if err != nil {
		FailError(w, err)
		return
	}
	OK(w, result)
}
