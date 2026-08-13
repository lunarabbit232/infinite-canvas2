package repository

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/google/uuid"
)

const knowledgeCollection = "knowledge"

// knowledgeUUID 将知识条目 ID 转为 Qdrant 可用的 UUID。
func knowledgeUUID(id string) string {
	return uuid.NewSHA1(uuid.NameSpaceOID, []byte(id)).String()
}

// InitKnowledgeVectorCollection 创建 knowledge Qdrant 集合（幂等）。
func InitKnowledgeVectorCollection() error {
	body := map[string]any{
		"vectors": map[string]any{
			"size":     vectorDim,
			"distance": "Cosine",
		},
	}
	err := qdrantPut(fmt.Sprintf("/collections/%s", knowledgeCollection), body)
	if err != nil && strings.Contains(err.Error(), "already exists") {
		return nil
	}
	return err
}

// UpsertKnowledgeVector 插入/更新知识条目向量。
func UpsertKnowledgeVector(knowledgeID, text string) error {
	if strings.TrimSpace(text) == "" {
		return nil
	}
	vec, err := TextEmbedding([]string{text})
	if err != nil {
		return err
	}
	if len(vec) == 0 {
		return fmt.Errorf("empty embedding for knowledge %s", knowledgeID)
	}
	body := map[string]any{
		"points": []map[string]any{{
			"id":      knowledgeUUID(knowledgeID),
			"vector":  vec[0],
			"payload": map[string]string{"text": text, "knowledgeId": knowledgeID},
		}},
	}
	return qdrantPut(fmt.Sprintf("/collections/%s/points", knowledgeCollection), body)
}

// SearchKnowledgeVectors 语义搜索知识条目，返回匹配的 knowledge ID 列表（相关性降序）。
func SearchKnowledgeVectors(query string, topK int) ([]string, error) {
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
	resp, err := qdrantPost(fmt.Sprintf("/collections/%s/points/search", knowledgeCollection), body)
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
		if kid := r.Payload["knowledgeId"]; kid != "" {
			ids = append(ids, kid)
		}
	}
	return ids, nil
}

// DeleteKnowledgeVector 删除指定知识条目的向量。
func DeleteKnowledgeVector(knowledgeID string) error {
	body := map[string]any{
		"points": []string{knowledgeUUID(knowledgeID)},
	}
	_, err := qdrantPost(fmt.Sprintf("/collections/%s/points/delete", knowledgeCollection), body)
	return err
}

// KnowledgeVectorCount 返回 knowledge 集合当前的向量点数。
func KnowledgeVectorCount() (int, error) {
	resp, err := http.Get(getQdrantURL() + "/collections/" + knowledgeCollection)
	if err != nil {
		return 0, err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		b, _ := io.ReadAll(resp.Body)
		return 0, fmt.Errorf("qdrant error %d: %s", resp.StatusCode, string(b))
	}
	var result struct {
		Result struct {
			PointsCount int `json:"points_count"`
		} `json:"result"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return 0, err
	}
	return result.Result.PointsCount, nil
}
