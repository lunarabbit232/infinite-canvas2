package service

import (
	"encoding/base64"
	"io"
	"math"
	"math/rand"
	"net/http"
	"strings"

	"github.com/tigerowo/infinite-canvas/model"
	"github.com/tigerowo/infinite-canvas/repository"
)

func ListUserCharacters(userID string) ([]model.Character, error) {
	return repository.ListCharacters(strings.TrimSpace(userID))
}

func GetCharacter(userID string, id string) (model.Character, bool, error) {
	return repository.GetCharacter(strings.TrimSpace(userID), strings.TrimSpace(id))
}

func SaveCharacter(item model.Character) (model.Character, error) {
	item.UserID = strings.TrimSpace(item.UserID)
	item.Name = strings.TrimSpace(item.Name)
	if item.ID == "" {
		item.ID = newID("character")
	}
	item.UpdatedAt = now()
	if item.CreatedAt == "" {
		item.CreatedAt = item.UpdatedAt
	}
	return repository.SaveCharacter(item)
}

func DeleteCharacter(userID string, id string) error {
	return repository.DeleteCharacter(strings.TrimSpace(userID), strings.TrimSpace(id))
}

func GenerateCharacterViews(request model.GenerateCharacterViewsRequest) model.GenerateCharacterViewsResponse {
	name := strings.TrimSpace(request.Name)
	desc := strings.TrimSpace(request.Description)
	gender := strings.TrimSpace(request.Gender)
	style := strings.TrimSpace(request.Style)

	base := buildCharacterBase(name, desc, gender, style)

	return model.GenerateCharacterViewsResponse{
		Views: []model.CharacterViewPrompt{
			{Type: "front", Prompt: base + "正面全身视图，正视镜头，双臂自然垂放，面部清晰，人物居中。纯色浅灰背景。"},
			{Type: "side", Prompt: base + "侧面全身视图，身体朝向画面左方，头部自然向前，展示身体轮廓和服装侧面细节。纯色浅灰背景。"},
			{Type: "back", Prompt: base + "背面全身视图，背对镜头，展示背面发型、服装和整体轮廓。纯色浅灰背景。"},
		},
	}
}

func buildCharacterBase(name string, desc string, gender string, style string) string {
	var b strings.Builder
	b.WriteString("角色设计三视图，")
	if name != "" {
		b.WriteString("\"" + name + "\"，")
	}
	if gender != "" {
		b.WriteString(gender + "，")
	}
	if desc != "" {
		b.WriteString(desc + "，")
	}
	if style != "" {
		b.WriteString(style + "风格，")
	}
	b.WriteString("人物设计稿，高质量，高细节，全身，")
	return b.String()
}

func BuildCharacterAnchor(userID string, modelName string, characterIDs []string, prompt string) (string, []string) {
	if len(characterIDs) == 0 {
		return "", nil
	}
	var anchors []string
	var refs []string
	for _, id := range characterIDs {
		id = strings.TrimSpace(id)
		if id == "" {
			continue
		}
		ch, ok, _ := GetCharacter(userID, id)
		if !ok {
			continue
		}
		if strings.TrimSpace(ch.PromptTemplate) != "" {
			anchors = append(anchors, "【角色："+ch.Name+"】"+ch.PromptTemplate)
		} else {
			var desc strings.Builder
			desc.WriteString("【角色：" + ch.Name + "】")
			if ch.Description != "" {
				desc.WriteString(ch.Description)
			}
			if len(ch.PersonalityKeywords) > 0 {
				desc.WriteString("，性格：" + strings.Join(ch.PersonalityKeywords, "、"))
			}
			anchors = append(anchors, desc.String())
		}
		refs = append(refs, pickCharacterRefs(userID, id, prompt, ch.ReferenceURLs)...)
	}
	if len(anchors) == 0 {
		return "", refs
	}
	joined := strings.Join(anchors, "\n")
	header := "\n\n【角色锚定描述】以下角色描述具有最高优先级，生成时请严格遵循角色外貌特征，禁止自由发挥：\n" + joined

	modelKey := strings.ToLower(modelName)
	switch {
	case strings.Contains(modelKey, "vidu"):
		header += "\n\n【Vidu @subject 锁定】使用 @subject 实体引用语法绑定角色，确保多镜头面部一致。"
	case strings.Contains(modelKey, "kling"):
		header += "\n\n【Kling element_list 锁定】将角色参考图放入 element_list，每个镜头独立描述角色外观。使用 multi_shot 功能可一次生成多个连续镜头。"
	case strings.Contains(modelKey, "seedance") || strings.Contains(modelKey, "doubao"):
		header += "\n\n【Seedance 多图锁定】上传 3-5 张不同角度高清角色参考图，使用 element_list 拆分角色与场景元素。"
	default:
		header += "\n\n【模型建议】面部特写/对话 → Vidu Q3 (@subject) | 大场景/动作 → Seedance 2.0 | 上传 3-5 张多角度参考图可显著提升一致性。"
	}

	return header + "\n\n", refs
}

// pickCharacterRefs 为角色选择要注入的参考图：单张或无 prompt 时原样返回全部；
// 多张且 prompt 非空时，用 CLIP 选一张最贴合当前 prompt 的参考图，选图失败（CLIP
// 服务不可用 / 下载失败）则退回全塞，保证生成不被阻塞。
func pickCharacterRefs(userID string, characterID string, prompt string, referenceURLs []string) []string {
	cleaned := make([]string, 0, len(referenceURLs))
	for _, u := range referenceURLs {
		u = strings.TrimSpace(u)
		if u != "" {
			cleaned = append(cleaned, u)
		}
	}
	if len(cleaned) <= 1 || strings.TrimSpace(prompt) == "" {
		return cleaned
	}
	if best := PickBestCharacterRef(userID, characterID, prompt); best != "" {
		return []string{best}
	}
	return cleaned
}

// EnsureCharacterSeed 返回角色的固定 seed：已锁定（>0）则直接返回，
// 未锁定（=0）则随机生成一个并保存，实现「同角色复用同一 seed」。
func EnsureCharacterSeed(userID string, characterID string) int64 {
	ch, ok, _ := GetCharacter(userID, characterID)
	if !ok {
		return 0
	}
	if ch.Seed > 0 {
		return ch.Seed
	}
	ch.Seed = rand.Int63n(2147483646) + 1 // 1 ~ 2^31-1 的正整数
	if _, err := SaveCharacter(ch); err != nil {
		return ch.Seed
	}
	return ch.Seed
}

func cosSim(a, b []float64) float64 {
	if len(a) != len(b) || len(a) == 0 {
		return 0
	}
	var dot, normA, normB float64
	for i := range a {
		dot += a[i] * b[i]
		normA += a[i] * a[i]
		normB += b[i] * b[i]
	}
	if normA == 0 || normB == 0 {
		return 0
	}
	return dot / (math.Sqrt(normA) * math.Sqrt(normB))
}

func fetchImageBytes(url string) ([]byte, error) {
	if strings.HasPrefix(url, "data:") {
		idx := strings.Index(url, ";base64,")
		if idx < 0 {
			return nil, nil
		}
		return base64.StdEncoding.DecodeString(url[idx+8:])
	}
	req, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	resp, err := SafeProxyHTTPClient().Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		return nil, nil
	}
	return io.ReadAll(resp.Body)
}

func PickBestCharacterRef(userID string, characterID string, prompt string) string {
	ch, ok, _ := GetCharacter(userID, characterID)
	if !ok || len(ch.ReferenceURLs) == 0 {
		return ""
	}
	if len(ch.ReferenceURLs) == 1 || prompt == "" {
		return ch.ReferenceURLs[0]
	}

	promptVec, err := repository.TextEmbedding([]string{prompt})
	if err != nil || len(promptVec) == 0 {
		return ""
	}

	bestURL := ""
	bestScore := -1.0
	for _, url := range ch.ReferenceURLs {
		imgBytes, err := fetchImageBytes(url)
		if err != nil {
			continue
		}
		imgVec, err := repository.ImageEmbedding(imgBytes)
		if err != nil {
			continue
		}
		if s := cosSim(promptVec[0], imgVec); s > bestScore {
			bestScore = s
			bestURL = url
		}
	}
	return bestURL
}

func CheckCharacterConsistency(userID string, characterID string, imageBytes []byte) float64 {
	ch, ok, _ := GetCharacter(userID, characterID)
	if !ok || len(ch.ReferenceURLs) == 0 {
		return -1
	}

	genVec, err := repository.ImageEmbedding(imageBytes)
	if err != nil {
		return -1
	}

	var bestScore float64
	for _, url := range ch.ReferenceURLs {
		refBytes, err := fetchImageBytes(url)
		if err != nil {
			continue
		}
		refVec, err := repository.ImageEmbedding(refBytes)
		if err != nil {
			continue
		}
		if s := cosSim(genVec, refVec); s > bestScore {
			bestScore = s
		}
	}
	return bestScore
}

// CheckCharacterConsistencyByURL 下载结果图后与角色参考图做 CLIP 相似度比对。
// 返回 -1 表示无法比对（角色无参考图 / 图片下载失败 / embedding 服务不可用）。
func CheckCharacterConsistencyByURL(userID string, characterID string, imageURL string) float64 {
	imageURL = strings.TrimSpace(imageURL)
	if imageURL == "" {
		return -1
	}
	imageBytes, err := fetchImageBytes(imageURL)
	if err != nil || len(imageBytes) == 0 {
		return -1
	}
	return CheckCharacterConsistency(userID, characterID, imageBytes)
}
