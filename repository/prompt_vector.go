package repository

import (
	"encoding/json"
	"fmt"
	"strings"

	"github.com/google/uuid"
)

const promptCollection = "prompts"

// promptUUID 将任意 ID 转为 Qdrant 可用的 UUID。
func promptUUID(id string) string {
	return uuid.NewSHA1(uuid.NameSpaceOID, []byte(id)).String()
}

// InitPromptVectorCollection 创建 prompts Qdrant 集合。
func InitPromptVectorCollection() error {
	body := map[string]any{
		"vectors": map[string]any{
			"size":     vectorDim,
			"distance": "Cosine",
		},
	}
	err := qdrantPut(fmt.Sprintf("/collections/%s", promptCollection), body)
	if err != nil && strings.Contains(err.Error(), "already exists") {
		return nil
	}
	return err
}

// UpsertPromptVector 插入/更新提示词向量。
func UpsertPromptVector(promptID, text string) error {
	vec, err := TextEmbedding([]string{text})
	if err != nil {
		return err
	}
	if len(vec) == 0 {
		return fmt.Errorf("empty embedding for prompt %s", promptID)
	}
	body := map[string]any{
		"points": []map[string]any{{
			"id":      promptUUID(promptID),
			"vector":  vec[0],
			"payload": map[string]string{"text": text, "promptId": promptID},
		}},
	}
	return qdrantPut(fmt.Sprintf("/collections/%s/points", promptCollection), body)
}

// SearchPromptVectors 语义搜索提示词。
func SearchPromptVectors(query string, topK int) ([]string, error) {
	vec, err := TextEmbedding([]string{query})
	if err != nil {
		return nil, err
	}
	if len(vec) == 0 {
		return nil, fmt.Errorf("empty embedding for query")
	}
	body := map[string]any{
		"vector":       vec[0],
		"limit":        topK,
		"with_payload": true,
	}
	resp, err := qdrantPost(fmt.Sprintf("/collections/%s/points/search", promptCollection), body)
	if err != nil {
		return nil, err
	}
	var result struct {
		Result []struct {
			Payload map[string]string `json:"payload"`
		} `json:"result"`
	}
	if err := json.Unmarshal(resp, &result); err != nil {
		return nil, err
	}
	ids := make([]string, 0, len(result.Result))
	for _, r := range result.Result {
		if pid := r.Payload["promptId"]; pid != "" {
			ids = append(ids, pid)
		}
	}
	return ids, nil
}

// DeletePromptVector 删除提示词向量。
func DeletePromptVector(promptID string) error {
	body := map[string]any{
		"points": []string{promptUUID(promptID)},
	}
	_, err := qdrantPost(fmt.Sprintf("/collections/%s/points/delete", promptCollection), body)
	return err
}
