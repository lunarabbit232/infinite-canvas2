package service

import (
	"context"
	"encoding/json"
	"strings"

	"github.com/tigerowo/infinite-canvas/repository"
)

// StoryboardDraftRequest 编剧 Agent 请求体。
type StoryboardDraftRequest struct {
	Prompt      string   `json:"prompt"`
	Mode        string   `json:"mode"`
	Model       string   `json:"model"`
	ChannelID   string   `json:"channelId"`
	ChannelMode string   `json:"channelMode"`
	BaseURL     string   `json:"baseUrl"`
	APIKey      string   `json:"apiKey"`
	References  []string `json:"references"`
}

// StoryboardDraftResponse 编剧 Agent 响应体。
type StoryboardDraftResponse struct {
	Storyboard any      `json:"storyboard"`
	Warnings   []string `json:"warnings"`
	Model      string   `json:"model"`
}

// DraftStoryboard 编剧 Agent：根据创作主题生成分镜脚本（JSON：场景/镜头/提示词）。
func DraftStoryboard(ctx context.Context, request StoryboardDraftRequest) (StoryboardDraftResponse, error) {
	result, warnings, modelName, err := runAgent(ctx, agentCallParams{
		endpoint:    "/workflows/storyboard-draft",
		errorLabel:  "编剧 Agent",
		formatError: "编剧 Agent 返回内容格式异常，请重试",
		inputError:  "请输入创作主题",

		model:       request.Model,
		channelMode: request.ChannelMode,
		channelID:   request.ChannelID,
		baseURL:     request.BaseURL,
		apiKey:      request.APIKey,

		validateInput: func() (string, error) {
			prompt := strings.TrimSpace(request.Prompt)
			if prompt == "" {
				return "", safeMessageError{message: "请输入创作主题"}
			}
			return prompt, nil
		},
		buildMessages: func(prompt string, userID string) []map[string]any {
			return storyboardAgentMessages(prompt, userID, request.Mode, request.References)
		},
		normalize: func(content string) (any, []string, error) {
			return normalizeStoryboard(content)
		},
		temperature: 0.4,
	})
	if err != nil {
		return StoryboardDraftResponse{}, err
	}
	return StoryboardDraftResponse{Storyboard: result, Warnings: warnings, Model: modelName}, nil
}

// storyboardAgentMessages 构建编剧 Agent 的消息数组。
func storyboardAgentMessages(prompt string, userID string, mode string, references []string) []map[string]any {
	systemPrompt := ""
	if settings, err := repository.GetSettings(); err == nil {
		normalized := normalizeSettings(settings)
		systemPrompt = strings.TrimSpace(normalized.Public.ModelChannel.SystemPrompts.StoryboardAgent)
	}
	if systemPrompt == "" {
		switch mode {
		case "analyze":
			systemPrompt = storyboardAnalyzePrompt
		case "graph":
			systemPrompt = storyboardGraphPrompt
		case "adapt":
			systemPrompt = storyboardAdaptPrompt
		case "review":
			systemPrompt = storyboardReviewPrompt
		default:
			systemPrompt = defaultStoryboardSystemPrompt
		}
	}
	if knowledge := SearchRoleKnowledge(userID, "storyboard", prompt, 5); knowledge != "" {
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

// normalizeStoryboard 将 LLM 返回内容解析为分镜脚本。
func normalizeStoryboard(content string) (any, []string, error) {
	jsonContent, err := normalizeJSONFromContent(content)
	if err != nil {
		return nil, nil, safeMessageError{message: "编剧 Agent 返回内容格式异常，请重试"}
	}

	var storyboard map[string]any
	if err := json.Unmarshal([]byte(jsonContent), &storyboard); err != nil {
		return nil, nil, safeMessageError{message: "编剧 Agent 返回内容格式异常，请重试"}
	}

	warnings := []string{}
	scenes, ok := storyboard["scenes"].([]any)
	if !ok || len(scenes) == 0 {
		warnings = append(warnings, "未识别到分镜场景，请检查生成结果")
	}
	return storyboard, warnings, nil
}

// ============================================================
// 编剧 Agent 的内置系统提示词（不同 mode 对应不同 prompt）
// ============================================================

const defaultStoryboardSystemPrompt = `你是一位专业编剧兼分镜师。根据用户给出的创作主题，生成一份可直接用于 AI 生图/生视频的分镜脚本，只输出 JSON，不要 Markdown 代码块或任何解释文字。

JSON 结构如下：
{
  "title": "作品标题",
  "theme": "主题概括（一句话核心冲突 + 情感走向）",
  "emotionalArc": "情绪弧线描述，如：压抑→挣扎→释放→释然",
  "scenes": [
    {
      "scene": 1,
      "location": "场景地点（具体，有视觉信息）",
      "time": "日/夜/黄昏/黎明等",
      "atmosphere": "场景氛围（如：寂静压抑/温馨怀旧/紧张急迫）",
      "summary": "本场景剧情概要（谁做了什么，冲突/转折是什么）",
      "shots": [
        {
          "shot": 1,
          "type": "景别（大远景/全景/中景/近景/特写）",
          "description": "画面内容描述（主体 + 动作 + 情绪 + 环境细节）",
          "camera": "运镜与机位（如：低角度缓慢推近、手持跟拍、固定中景过肩）",
          "lighting": "光线方案（如：暖调逆光、冷调侧光、高反差顶光），与场景氛围匹配",
          "duration": 5,
          "continuity": "与上一镜的衔接要点（人物位置、动作延续、视线方向），第一镜填'开场'",
          "prompt": "可直接用于生图模型的完整提示词（包含主体、动作、环境、机位、光线、风格，自洽完整）"
        }
      ]
    }
  ]
}

关键规则：
- 场景衔接：上一个场景的结尾情绪自然过渡到下一个场景的开头氛围
- 情绪弧线：全片情绪有起伏变化，不要从头到尾一个调子
- 具体优于抽象：地点写"江南小镇石板路，青苔斑驳，雾气弥漫"，不要只写"小镇"
- 每个画面描述都必须写清楚主体在做什么以及情绪状态

要求：
1. 每个场景 2-4 个镜头，全片 3-6 个场景
2. prompt 字段必须完整可用，可直接粘贴到生图工具
3. continuity 确保镜头间人物位置、动作、视线的逻辑衔接
4. duration 为镜头时长（秒），取整数，对话场景 5-8，动作场景 3-5
5. 严格输出 JSON，不要任何多余文字`

const storyboardAnalyzePrompt = `你是一位资深剧本分析师。请对用户提供的故事进行深度解析，输出 JSON：

{
  "analysis": {
    "theme": "核心主题",
    "genre": "类型",
    "structure": "叙事结构（三幕/多线/倒叙等）",
    "tone": "整体基调"
  },
  "characters": [{"name": "姓名","role": "主角/配角/反派","personality": "性格关键词","arc": "角色成长弧线","relationships": [{"target": "对方姓名","type": "师徒/恋人/宿敌/同盟"}]}],
  "plotPoints": [{"act": 1,"points": ["关键情节1","关键情节2"]}],
  "conflicts": [{"type": "人与环境/人与人/内心","description": "冲突描述"}]
}`

const storyboardGraphPrompt = `你是一位故事图谱分析师。请提取故事中的人物关系图和情节节点，输出 JSON：

{
  "graph": {
    "nodes": [
      {"id": "char_1","label": "角色名","group": "主角/配角/反派/第三方","traits": "3-5个关键词"}
    ],
    "edges": [
      {"source": "char_1","target": "char_2","label": "师徒/恋人/宿敌","weight": 3}
    ],
    "timeline": [
      {"chapter": 1,"event": "事件描述","involved": ["char_1","char_2"]}
    ]
  }
}`

const storyboardAdaptPrompt = `你是一位专业编剧，擅长改编创作。请对用户提供的故事进行改编处理，输出 JSON：
{
  "title": "改编后标题",
  "adaptation": {"approach": "忠实/现代化/反转/跨界","changes": ["改编点1","改编点2"]},
  "scenes": [
    {"scene": 1,"location": "...","time": "...","summary": "...","shots": [{"shot": 1,"type": "...","description": "...","camera": "...","duration": 5,"prompt": "..."}]}
  ],
  "review": {"pacing": "节奏评估","fidelity": "改编忠实度评估","suggestions": ["建议1"]}
}`

const storyboardReviewPrompt = `你是一位剧本审校专家。请对用户提供的剧本章节进行审校，逐项指出问题并给出修复建议，输出 JSON：
{
  "scores": {"logic": 8,"pacing": 7,"dialogue": 9,"visual": 6,"overall": 7.5},
  "issues": [
    {"chapter": 1,"type": "逻辑/节奏/对白/画面","severity": "严重/一般/建议","description": "问题描述","fix": "修复建议"}
  ],
  "summary": "总体评价和改进方向"
}`
