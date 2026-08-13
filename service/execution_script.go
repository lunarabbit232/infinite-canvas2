package service

import (
	"bytes"
	"context"
	"encoding/json"
	"strings"

	"github.com/tigerowo/infinite-canvas/repository"
)

// ExecutionScriptRequest 执行词 Agent 请求体。
type ExecutionScriptRequest struct {
	Name        string          `json:"name"`
	Category    string          `json:"category"`
	Description string          `json:"description"`
	Data        json.RawMessage `json:"data"`
	Model       string          `json:"model"`
	ChannelID   string          `json:"channelId"`
	ChannelMode string          `json:"channelMode"`
	BaseURL     string          `json:"baseUrl"`
	APIKey      string          `json:"apiKey"`
	References  []string        `json:"references"`
}

// ExecutionScriptResponse 执行词 Agent 响应体。
type ExecutionScriptResponse struct {
	Script     string         `json:"script"`
	JSONExport map[string]any `json:"jsonExport"`
	Warnings   []string       `json:"warnings"`
	Model      string         `json:"model"`
}

// GenerateExecutionScript 执行词生成：把工作流 JSON 序列化，交 LLM 聚合为可复刻的执行词。
func GenerateExecutionScript(ctx context.Context, request ExecutionScriptRequest) (ExecutionScriptResponse, error) {
	result, warnings, modelName, err := runAgent(ctx, agentCallParams{
		endpoint:    "/workflows/execution-script",
		errorLabel:  "执行词",
		formatError: "执行词生成返回内容格式异常，请重试",
		inputError:  "请提供工作流数据",

		model:       request.Model,
		channelMode: request.ChannelMode,
		channelID:   request.ChannelID,
		baseURL:     request.BaseURL,
		apiKey:      request.APIKey,

		validateInput: func() (string, error) {
			data := bytes.TrimSpace(request.Data)
			if len(data) == 0 {
				return "", safeMessageError{message: "请提供工作流数据"}
			}
			// execution script 的 prompt 由内部构建，这里只校验数据不为空
			return "", nil
		},
		buildMessages: func(_ string, userID string) []map[string]any {
			return executionScriptMessages(request, userID)
		},
		normalize: func(content string) (any, []string, error) {
			m, w, e := normalizeExecutionScript(content)
			return m, w, e
		},
		temperature: 0.3,
	})
	if err != nil {
		return ExecutionScriptResponse{}, err
	}
	parsed, _ := result.(map[string]any)
	script, _ := parsed["script"].(string)
	return ExecutionScriptResponse{Script: script, JSONExport: parsed, Warnings: warnings, Model: modelName}, nil
}

// executionScriptMessages 构建执行词 Agent 的消息数组。
func executionScriptMessages(request ExecutionScriptRequest, userID string) []map[string]any {
	systemPrompt := ""
	if settings, err := repository.GetSettings(); err == nil {
		normalized := normalizeSettings(settings)
		systemPrompt = strings.TrimSpace(normalized.Public.ModelChannel.SystemPrompts.ExecutionScript)
	}
	if systemPrompt == "" {
		systemPrompt = defaultExecutionScriptSystemPrompt
	}

	var textBuilder strings.Builder
	if name := strings.TrimSpace(request.Name); name != "" {
		textBuilder.WriteString("工作流名称：" + name + "\n")
	}
	if category := strings.TrimSpace(request.Category); category != "" {
		textBuilder.WriteString("分类：" + category + "\n")
	}
	if description := strings.TrimSpace(request.Description); description != "" {
		textBuilder.WriteString("描述：" + description + "\n")
	}
	textBuilder.WriteString("\n工作流 JSON 数据：\n")
	textBuilder.WriteString(string(request.Data))

	prompt := textBuilder.String()
	if knowledge := SearchRoleKnowledge(userID, "execution", prompt, 5); knowledge != "" {
		systemPrompt += knowledge
	}
	messages := []map[string]any{{"role": "system", "content": systemPrompt}}
	var content []map[string]any
	content = append(content, map[string]any{"type": "text", "text": prompt})
	for _, dataURL := range request.References {
		dataURL = strings.TrimSpace(dataURL)
		if strings.HasPrefix(dataURL, "data:image/") {
			content = append(content, map[string]any{
				"type":      "image_url",
				"image_url": map[string]string{"url": dataURL},
			})
		}
	}
	if len(content) == 1 {
		messages = append(messages, map[string]any{"role": "user", "content": prompt})
	} else {
		messages = append(messages, map[string]any{"role": "user", "content": content})
	}
	return messages
}

// normalizeExecutionScript 将 LLM 返回内容解析为执行词结果。
func normalizeExecutionScript(content string) (map[string]any, []string, error) {
	jsonContent, err := normalizeJSONFromContent(content)
	if err != nil {
		return nil, nil, safeMessageError{message: "执行词生成返回内容格式异常，请重试"}
	}

	var result map[string]any
	if err := json.Unmarshal([]byte(jsonContent), &result); err != nil {
		return nil, nil, safeMessageError{message: "执行词生成返回内容格式异常，请重试"}
	}

	warnings := []string{}
	script, _ := result["script"].(string)
	if strings.TrimSpace(script) == "" {
		warnings = append(warnings, "未生成执行词正文，请检查返回内容")
	}
	steps, ok := result["steps"].([]any)
	if !ok || len(steps) == 0 {
		warnings = append(warnings, "未识别到执行步骤")
	}
	return result, warnings, nil
}

const defaultExecutionScriptSystemPrompt = `你是一个创作工作流解析助手。用户会给你一个 AI 创作工作流的完整 JSON（包含节点、连线、参数、提示词模板、素材引用等），请把它提炼成一份「执行词」——一段可供他人或 AI 完整复刻这套创作逻辑的可执行说明。

只输出 JSON，不要 Markdown 代码块或任何多余文字。JSON 结构如下：
{
  "title": "工作流标题",
  "overview": "用 2-3 句话概括这个工作流做什么、适合什么场景",
  "script": "执行词正文：用通顺的中文分步骤描述整套创作流程，包含每一步的动作、使用的提示词要点、关键参数（模型、尺寸、数量等）与素材引用，让一个没有看过原始 JSON 的人也能照此完整执行",
  "steps": [
    { "step": 1, "action": "步骤动作（动词开头，如：上传参考图、填写提示词、调整参数）", "prompt": "该步骤提示词（若有）", "parameters": "关键参数摘要（模型名、分辨率、时长等）" }
  ],
  "tips": ["实用建议1（如：720p 适合快速测试，1080p 用于最终输出）", "建议2"]
}

关键规则：
- 工作流中有变量表单的，说明每个变量怎么填、取值范围
- 有素材引用的，标明引用在哪个步骤使用、格式要求
- 有多个生成节点的，按拓扑顺序排列步骤，不要乱序
- tips 写实际的避坑建议，不写空泛的"注意细节"

要求：
1. script 完整自洽，可直接复制使用
2. steps 按执行顺序列出，每个 step 有实用信息
3. overview 让读者一眼判断这个工作流适不适合自己
4. tips 至少给 2 条具体建议
5. 严格输出 JSON，不要任何多余文字`
