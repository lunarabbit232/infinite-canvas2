package service

import (
	"context"
	"encoding/json"
	"strings"

	"github.com/tigerowo/infinite-canvas/model"
	"github.com/tigerowo/infinite-canvas/repository"
)

// DraftCreativeWorkflow 工作流 Agent：根据用户需求生成创意工作流 JSON 模板。
func DraftCreativeWorkflow(ctx context.Context, request WorkflowAgentDraftRequest) (WorkflowAgentDraftResponse, error) {
	result, warnings, modelName, err := runAgent(ctx, agentCallParams{
		endpoint:    "/workflows/agent-draft",
		errorLabel:  "工作流 Agent",
		formatError: "工作流 Agent 返回内容格式异常，请重试",
		inputError:  "请输入工作流需求",

		model:       request.Model,
		channelMode: request.ChannelMode,
		channelID:   request.ChannelID,
		baseURL:     request.BaseURL,
		apiKey:      request.APIKey,

		validateInput: func() (string, error) {
			prompt := strings.TrimSpace(request.Prompt)
			if prompt == "" {
				return "", safeMessageError{message: "请输入工作流需求"}
			}
			return prompt, nil
		},
		buildMessages: func(prompt string, userID string) []map[string]any {
			return workflowAgentMessages(prompt, userID, request.References)
		},
		normalize: func(content string) (any, []string, error) {
			return normalizeWorkflowDraft(content, request.Scope)
		},
		temperature: 0.2,
	})
	if err != nil {
		return WorkflowAgentDraftResponse{}, err
	}
	return WorkflowAgentDraftResponse{Draft: result, Warnings: warnings, Model: modelName}, nil
}

// workflowAgentMessages 构建工作流 Agent 的消息数组。
func workflowAgentMessages(prompt string, userID string, references []string) []map[string]any {
	systemPrompt := ""
	if settings, err := repository.GetSettings(); err == nil {
		normalized := normalizeSettings(settings)
		systemPrompt = strings.TrimSpace(normalized.Public.ModelChannel.SystemPrompts.WorkflowAgent)
	}
	if systemPrompt == "" {
		systemPrompt = "你是一个创意工作流设计助手。根据用户描述生成一个JSON格式的工作流模板。"
	}

	messages := []map[string]any{{"role": "system", "content": systemPrompt}}
	var content []map[string]any
	content = append(content, map[string]any{"type": "text", "text": prompt})
	for _, dataURL := range references {
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

// normalizeWorkflowDraft 将 LLM 返回内容解析为工作流 draft。
func normalizeWorkflowDraft(content string, scope string) (any, []string, error) {
	jsonContent, err := normalizeJSONFromContent(content)
	if err != nil {
		return nil, nil, safeMessageError{message: "工作流 Agent 返回内容格式异常，请重试"}
	}

	var draft map[string]any
	if err := json.Unmarshal([]byte(jsonContent), &draft); err != nil {
		return nil, nil, safeMessageError{message: "工作流 Agent 返回内容格式异常，请重试"}
	}

	warnings := []string{}
	if scope != "public" {
		draft["scope"] = "private"
	}

	// Sanitize variable keys: enforce [a-zA-Z0-9_-]
	if variables, ok := draft["variables"].([]any); ok {
		for i, v := range variables {
			if vmap, ok := v.(map[string]any); ok {
				if key, ok := vmap["key"].(string); ok {
					vmap["key"] = sanitizeVariableKey(key)
				}
				variables[i] = vmap
			}
		}
		draft["variables"] = variables
	}

	return draft, warnings, nil
}

// sanitizeVariableKey 净化变量名，只保留 [a-zA-Z0-9_-]。
func sanitizeVariableKey(key string) string {
	var result strings.Builder
	for _, r := range key {
		if (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9') || r == '_' || r == '-' {
			result.WriteRune(r)
		} else {
			result.WriteRune('_')
		}
	}
	out := result.String()
	if out == "" {
		return "var"
	}
	return out
}

// extractChatMessage 从 OpenAI chat completion 响应 JSON 中提取第一条消息的 content。
func extractChatMessage(responseBody string) string {
	var result struct {
		Choices []struct {
			Message struct {
				Content          string `json:"content"`
				ReasoningContent string `json:"reasoning_content"`
			} `json:"message"`
		} `json:"choices"`
	}
	if err := json.Unmarshal([]byte(responseBody), &result); err != nil {
		return responseBody
	}
	if len(result.Choices) > 0 {
		msg := result.Choices[0].Message
		if strings.TrimSpace(msg.Content) != "" {
			return msg.Content
		}
		if strings.TrimSpace(msg.ReasoningContent) != "" {
			return msg.ReasoningContent
		}
	}
	return responseBody
}

// readChannelError 从上游错误响应 JSON 中提取可读错误信息。
func readChannelError(body string, fallback string) safeMessageError {
	var payload struct {
		Error struct {
			Message string `json:"message"`
		} `json:"error"`
		Msg string `json:"msg"`
	}
	if err := json.Unmarshal([]byte(body), &payload); err == nil {
		if strings.TrimSpace(payload.Error.Message) != "" {
			return safeMessageError{message: payload.Error.Message}
		}
		if strings.TrimSpace(payload.Msg) != "" {
			return safeMessageError{message: payload.Msg}
		}
	}
	return safeMessageError{message: fallback}
}

// maxInt 返回两个 int 中较大的值。
func maxInt(a, b int) int {
	if a > b {
		return a
	}
	return b
}

// workflowDraftModel 解析 Agent 使用的模型名。
func workflowDraftModel(modelName string) (string, error) {
	modelName = strings.TrimSpace(modelName)
	if modelName != "" {
		return modelName, nil
	}
	settings, err := repository.GetSettings()
	if err != nil {
		return "", err
	}
	normalized := normalizeSettings(settings)
	if strings.TrimSpace(normalized.Public.ModelChannel.DefaultTextModel) != "" {
		return strings.TrimSpace(normalized.Public.ModelChannel.DefaultTextModel), nil
	}
	if strings.TrimSpace(normalized.Public.ModelChannel.DefaultModel) != "" {
		return strings.TrimSpace(normalized.Public.ModelChannel.DefaultModel), nil
	}
	for _, ch := range normalized.Private.Channels {
		for _, m := range ch.Models {
			if strings.TrimSpace(m) != "" {
				return strings.TrimSpace(m), nil
			}
		}
	}
	return "", safeMessageError{message: "请先配置文本模型"}
}

// workflowDraftChannel 解析 Agent 使用的模型渠道。
func workflowDraftChannel(request WorkflowAgentDraftRequest, modelName string) (model.ModelChannel, error) {
	if request.ChannelMode == "local" {
		channel := model.ModelChannel{
			ID:      strings.TrimSpace(request.ChannelID),
			Name:    "用户本地直连",
			BaseURL: strings.TrimSpace(request.BaseURL),
			APIKey:  strings.TrimSpace(request.APIKey),
			Models:  []string{modelName},
			Weight:  1,
			Timeout: 600,
		}
		if channel.BaseURL == "" || channel.APIKey == "" {
			return model.ModelChannel{}, safeMessageError{message: "文本模型本地直连渠道配置不完整"}
		}
		return channel, nil
	}
	return SelectModelChannel(modelName)
}
