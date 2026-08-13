package service

import (
	"context"
	"encoding/json"
	"strings"

	"github.com/tigerowo/infinite-canvas/repository"
)

// DirectorDraftRequest 导演 Agent 请求体。
type DirectorDraftRequest struct {
	Prompt      string   `json:"prompt"`
	Model       string   `json:"model"`
	ChannelID   string   `json:"channelId"`
	ChannelMode string   `json:"channelMode"`
	BaseURL     string   `json:"baseUrl"`
	APIKey      string   `json:"apiKey"`
	References  []string `json:"references"`
}

// DirectorDraftResponse 导演 Agent 响应体。
type DirectorDraftResponse struct {
	Advice   any      `json:"advice"`
	Warnings []string `json:"warnings"`
	Model    string   `json:"model"`
}

// DraftDirectorAdvice 导演 Agent：输入剧本段落，输出机位/镜头参数/运镜建议（知识内嵌版，RAG 留待迭代）。
func DraftDirectorAdvice(ctx context.Context, request DirectorDraftRequest) (DirectorDraftResponse, error) {
	result, warnings, modelName, err := runAgent(ctx, agentCallParams{
		endpoint:    "/workflows/director-draft",
		errorLabel:  "导演 Agent",
		formatError: "导演 Agent 返回内容格式异常，请重试",
		inputError:  "请输入剧本段落或场景描述",

		model:       request.Model,
		channelMode: request.ChannelMode,
		channelID:   request.ChannelID,
		baseURL:     request.BaseURL,
		apiKey:      request.APIKey,

		validateInput: func() (string, error) {
			prompt := strings.TrimSpace(request.Prompt)
			if prompt == "" {
				return "", safeMessageError{message: "请输入剧本段落或场景描述"}
			}
			return prompt, nil
		},
		buildMessages: func(prompt string, userID string) []map[string]any {
			return directorAgentMessages(prompt, userID, request.References)
		},
		normalize: func(content string) (any, []string, error) {
			return normalizeDirectorAdvice(content)
		},
		temperature: 0.4,
	})
	if err != nil {
		return DirectorDraftResponse{}, err
	}
	return DirectorDraftResponse{Advice: result, Warnings: warnings, Model: modelName}, nil
}

// directorAgentMessages 构建导演 Agent 的消息数组。
func directorAgentMessages(prompt string, userID string, references []string) []map[string]any {
	systemPrompt := ""
	if settings, err := repository.GetSettings(); err == nil {
		normalized := normalizeSettings(settings)
		systemPrompt = strings.TrimSpace(normalized.Public.ModelChannel.SystemPrompts.DirectorAgent)
	}
	if systemPrompt == "" {
		systemPrompt = defaultDirectorSystemPrompt
	}
	if knowledge := SearchRoleKnowledge(userID, "director", prompt, 5); knowledge != "" {
		systemPrompt += knowledge
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

// normalizeDirectorAdvice 将 LLM 返回内容解析为导演建议。
func normalizeDirectorAdvice(content string) (any, []string, error) {
	jsonContent, err := normalizeJSONFromContent(content)
	if err != nil {
		return nil, nil, safeMessageError{message: "导演 Agent 返回内容格式异常，请重试"}
	}

	var advice map[string]any
	if err := json.Unmarshal([]byte(jsonContent), &advice); err != nil {
		return nil, nil, safeMessageError{message: "导演 Agent 返回内容格式异常，请重试"}
	}

	warnings := []string{}
	shots, ok := advice["shots"].([]any)
	if !ok || len(shots) == 0 {
		warnings = append(warnings, "未识别到镜头建议，请检查生成结果")
	}
	return advice, warnings, nil
}

const defaultDirectorSystemPrompt = `你是一位资深电影导演兼摄影指导，精通镜头语言。根据用户提供的剧本段落或场景描述，给出专业的导演建议，只输出 JSON，不要 Markdown 代码块或任何多余文字。

JSON 结构如下：
{
  "analysis": "对剧本段落的导演视角分析（情绪基调、节奏、视觉重点）",
  "shots": [
    {
      "shot": 1,
      "type": "景别（大远景/全景/中景/近景/特写/大特写）",
      "angle": "机位角度（平视/仰拍/俯拍/过肩/主观视角等）",
      "lens": "焦距建议（如 24mm 广角 / 50mm 标准 / 85mm 中长焦 / 135mm 长焦）",
      "aperture": "光圈建议（如 f/1.8 浅景深 / f/8 全景深）",
      "movement": "运镜方式（固定/推/拉/摇/移/跟/升降/手持）",
      "composition": "构图建议（三分法/对称/引导线/框架构图等）",
      "lighting": "光线描述（暖调/冷调/高反差/柔光等），与场景情绪匹配",
      "reason": "这样设计的理由（情绪、叙事、视觉逻辑）",
      "continuity": "与上一镜的衔接要点（人物位置、视线方向、动作延续、影调一致），第一镜填'开场'",
      "prompt": "可直接用于生图/生视频的完整提示词（含主体、机位、景别、光线、风格，自洽完整）"
    }
  ]
}

导演知识要点：
- 景别递进：大远景交代环境 → 全景交代关系 → 中景推进叙事 → 近景表情绪 → 特写强调细节。同一场景从大到小递进。
- 角度选择：仰拍显威严压迫，俯拍显渺小宿命，平视客观中立，过肩建立人物关系，主观镜头代入角色。
- 运镜意图：推镜头聚焦注意，拉镜头揭示环境，摇镜头展示空间，跟拍强调临场，手持增加紧张。
- 焦距与空间：广角(14-35mm)夸张纵深感 → 大场景；标准(35-70mm)自然平实 → 叙事；长焦(85-200mm)压缩空间 → 孤立感、肖像。
- 光圈与景深：大光圈(f/1.4-f/2.8)浅景深突出主体、情绪感；小光圈(f/8-f/16)全景深交代环境、史诗感。
- 光线与情绪：暖调温馨怀旧(黄昏、烛光)，冷调疏离紧张(阴天、月光)，高反差戏剧冲突，柔光浪漫柔和。
- 人物构图：近景特写留 headroom 少量，视线方向留白；对话戏用正反打过肩，避免跳切。
- 连续性：相邻镜头保持统一的影调、主体位置逻辑（左出右入）、视线方向匹配，除非刻意打破制造不安。

要求：
1. 每段给 2-4 个镜头建议，镜头间有景别递进和逻辑关联
2. prompt 字段完整可用，可直接粘贴到生图/生视频工具
3. continuity 字段确保相邻镜头的人物位置、动作、视线、影调有逻辑延续
4. 严格输出 JSON，不要任何多余文字`
