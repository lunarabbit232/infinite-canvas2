package handler

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/tigerowo/infinite-canvas/model"
	"github.com/tigerowo/infinite-canvas/service"
)

func UserWorkflows(w http.ResponseWriter, r *http.Request) {
	workflows, err := service.ListCreativeWorkflows(r.Context())
	if err != nil {
		FailError(w, err)
		return
	}
	OK(w, workflows)
}

func SaveUserWorkflow(w http.ResponseWriter, r *http.Request) {
	var request service.CreativeWorkflowPayload
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		Fail(w, "工作流数据格式错误")
		return
	}
	workflow, err := service.SaveCreativeWorkflow(r.Context(), request)
	if err != nil {
		FailError(w, err)
		return
	}
	OK(w, workflow)
}

func DeleteUserWorkflow(w http.ResponseWriter, r *http.Request, id string) {
	if err := service.DeleteCreativeWorkflow(r.Context(), id); err != nil {
		FailError(w, err)
		return
	}
	OK(w, true)
}

func DraftUserWorkflow(w http.ResponseWriter, r *http.Request) {
	var request service.WorkflowAgentDraftRequest
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		Fail(w, "工作流需求格式错误")
		return
	}
	result, err := service.DraftCreativeWorkflow(r.Context(), request)
	if err != nil {
		FailError(w, err)
		return
	}
	OK(w, result)
}

func DraftUserStoryboard(w http.ResponseWriter, r *http.Request) {
	var request service.StoryboardDraftRequest
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		Fail(w, "创作主题格式错误")
		return
	}
	result, err := service.DraftStoryboard(r.Context(), request)
	if err != nil {
		FailError(w, err)
		return
	}
	OK(w, result)
}

func GenerateUserExecutionScript(w http.ResponseWriter, r *http.Request) {
	var request service.ExecutionScriptRequest
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		Fail(w, "工作流数据格式错误")
		return
	}
	result, err := service.GenerateExecutionScript(r.Context(), request)
	if err != nil {
		FailError(w, err)
		return
	}
	OK(w, result)
}

func DraftUserDirectorAdvice(w http.ResponseWriter, r *http.Request) {
	var request service.DirectorDraftRequest
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		Fail(w, "剧本内容格式错误")
		return
	}
	result, err := service.DraftDirectorAdvice(r.Context(), request)
	if err != nil {
		FailError(w, err)
		return
	}
	OK(w, result)
}

func AdminAICallLogs(w http.ResponseWriter, r *http.Request) {
	list, err := service.ListAICallLogs(parseQuery(r))
	if err != nil {
		FailError(w, err)
		return
	}
	OK(w, list)
}

// ClientAICallLog 接收前端本地直连渠道的 AI 调用日志上报。
func ClientAICallLog(w http.ResponseWriter, r *http.Request) {
	user, ok := service.UserFromContext(r.Context())
	if !ok || user.ID == "" {
		Fail(w, "请先登录")
		return
	}
	var request service.AICallLogInput
	_ = json.NewDecoder(r.Body).Decode(&request)
	if !service.LocalDirectAILogEnabled() {
		OK(w, true)
		return
	}
	request.UserID = user.ID
	request.UserDisplayName = firstNonEmpty(user.DisplayName, user.Username)
	service.SaveAICallLog(request)
	OK(w, true)
}

func AdminDeleteAICallLogs(w http.ResponseWriter, r *http.Request) {
	days := 7
	if v := r.URL.Query().Get("olderThanDays"); v != "" {
		if parsed, err := strconv.Atoi(v); err == nil && parsed > 0 {
			days = parsed
		}
	}
	removed, err := service.DeleteAICallLogsOlderThan(days)
	if err != nil {
		FailError(w, err)
		return
	}
	OK(w, map[string]int{"removedFiles": removed})
}

func EvaluateWorkflowBranch(w http.ResponseWriter, r *http.Request) {
	var request model.EvaluateBranchRequest
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		Fail(w, "请求参数无效")
		return
	}
	if request.StepID == "" {
		Fail(w, "stepId 不能为空")
		return
	}
	if request.WorkflowData == nil {
		request.WorkflowData = map[string]any{}
	}
	if request.StepResult == nil {
		request.StepResult = map[string]any{}
	}
	result := service.EvaluateWorkflowBranch(request.WorkflowData, request.StepID, request.StepResult)
	OK(w, result)
}
