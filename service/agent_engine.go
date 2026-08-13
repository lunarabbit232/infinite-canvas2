package service

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/tigerowo/infinite-canvas/model"
)

// agentCallParams 统一 Agent 调用管线参数。四个 Draft/Generate 函数最终都归一到此。
type agentCallParams struct {
	endpoint     string // "/workflows/agent-draft"
	errorLabel   string // "工作流 Agent" / "编剧 Agent" / 等
	formatError  string // "工作流 Agent 返回内容格式异常，请重试" / 等
	inputError   string // "请输入工作流需求" / 等（prompt 为空的错误）

	model       string
	channelMode string
	channelID   string
	baseURL     string
	apiKey      string

	// validateInput: 校验输入并返回 prompt 字符串，失败返回 error
	validateInput func() (string, error)
	// buildMessages: 用 prompt 和 userID 构建完整的 messages 数组
	buildMessages func(prompt string, userID string) []map[string]any
	// normalize: 解析 LLM 返回内容，返回 (result, warnings, error)
	normalize   func(content string) (any, []string, error)
	temperature float64
}

// runAgent 执行一条 Agent 调用的完整管线：
// 鉴权→校验→选模型→选渠道→扣费→HTTP 调用→提取内容→标准化→日志。
// 返回 (result, warnings, modelName, error)。
// 四个 Agent 文件仅保留各自独有的 messages 构建和 normalize 逻辑，其余全部委托给此函数。
func runAgent(ctx context.Context, params agentCallParams) (any, []string, string, error) {
	startedAt := time.Now()

	// 1. 鉴权
	user, ok := UserFromContext(ctx)
	if !ok || user.ID == "" {
		return nil, nil, "", safeMessageError{message: "请先登录"}
	}

	// 2. 校验输入
	prompt, err := params.validateInput()
	if err != nil {
		return nil, nil, "", err
	}

	// 3. 选模型
	modelName, err := workflowDraftModel(params.model)
	if err != nil {
		return nil, nil, "", err
	}

	// 4. 渠道权限
	if params.channelMode != "local" && !UserCanUseRemoteModelChannel(user) {
		return nil, nil, "", safeMessageError{message: "当前账号未开放云端渠道"}
	}

	// 5. 选渠道
	channel, err := workflowDraftChannel(WorkflowAgentDraftRequest{
		ChannelMode: params.channelMode,
		ChannelID:   params.channelID,
		BaseURL:     params.baseURL,
		APIKey:      params.apiKey,
	}, modelName)
	if err != nil {
		return nil, nil, "", err
	}

	// 6. 计费
	credits, _ := ModelCost(modelName)
	chargedCredits := params.channelMode != "local"
	if chargedCredits {
		if err := ConsumeUserCredits(user.ID, modelName, credits, params.endpoint); err != nil {
			return nil, nil, "", err
		}
	}
	refundCredits := func() {
		if chargedCredits {
			_ = RefundUserCredits(user.ID, modelName, credits, params.endpoint)
		}
	}

	// 7. 构建 HTTP 请求
	body, _ := json.Marshal(map[string]any{
		"model":       modelName,
		"messages":    params.buildMessages(prompt, user.ID),
		"temperature": params.temperature,
	})

	httpRequest, err := http.NewRequest(
		http.MethodPost,
		BuildModelChannelURL(channel, "/chat/completions"),
		bytes.NewReader(body),
	)
	if err != nil {
		refundCredits()
		return nil, nil, "", err
	}
	httpRequest.Header.Set("Authorization", "Bearer "+channel.APIKey)
	httpRequest.Header.Set("Content-Type", "application/json")

	// 8. 发送请求
	displayName := firstNonEmpty(user.DisplayName, user.Username)
	logInput := func(status int, responseBody string, errMsg string) {
		SaveAICallLog(AICallLogInput{
			UserID:          user.ID,
			UserDisplayName: displayName,
			Endpoint:        params.endpoint,
			Method:          http.MethodPost,
			Model:           modelName,
			ChannelID:       channel.ID,
			ChannelName:     channel.Name,
			Status:          status,
			DurationMs:      time.Since(startedAt).Milliseconds(),
			Credits:         credits,
			RequestBody:     string(body),
			ResponseBody:    responseBody,
			Error:           errMsg,
		})
	}

	client := &http.Client{Timeout: time.Duration(maxInt(channel.Timeout, 600)) * time.Second}
	response, err := client.Do(httpRequest)
	if err != nil {
		refundCredits()
		logInput(0, "", err.Error())
		return nil, nil, "", err
	}
	defer response.Body.Close()

	responseBody, _ := io.ReadAll(response.Body)
	if response.StatusCode >= http.StatusBadRequest {
		refundCredits()
		logInput(response.StatusCode, string(responseBody), string(responseBody))
		return nil, nil, "", readChannelError(string(responseBody), params.errorLabel+"请求失败")
	}

	// 9. 提取并标准化内容
	content := extractChatMessage(string(responseBody))
	result, warnings, err := params.normalize(content)
	if err != nil {
		refundCredits()
		logInput(response.StatusCode, string(responseBody), err.Error())
		return nil, nil, "", err
	}

	logInput(response.StatusCode, string(responseBody), "")
	return result, warnings, modelName, nil
}

// normalizeJSONFromContent 从 LLM 返回的文本中提取 JSON（处理 markdown 包裹、前后文字修饰），
// 然后反序列化到目标变量 target。四个 normalize* 函数中的 JSON 截取逻辑共用此函数。
func normalizeJSONFromContent(content string) (string, error) {
	content = strings.TrimSpace(content)
	jsonStart := strings.Index(content, "{")
	if jsonStart < 0 {
		jsonStart = strings.Index(content, "[")
	}
	if jsonStart >= 0 {
		content = content[jsonStart:]
	}
	jsonEnd := strings.LastIndex(content, "}")
	if bracketEnd := strings.LastIndex(content, "]"); bracketEnd > jsonEnd {
		jsonEnd = bracketEnd
	}
	if jsonEnd >= 0 {
		content = content[:jsonEnd+1]
	}

	var test map[string]any
	if err := json.Unmarshal([]byte(content), &test); err != nil {
		// 也可能是一个数组
		var arr []any
		if err2 := json.Unmarshal([]byte(content), &arr); err2 != nil {
			return "", err
		}
	}
	return content, nil
}

// model.ModelChannel 类型引用（编译检查用）
var _ = model.ModelChannel{}
