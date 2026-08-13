package repository

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"

	"github.com/google/uuid"
)

const (
	qdrantURL    = "http://localhost:6333"
	embedURL     = "http://localhost:8765"
	collection   = "assets"
	vectorDim    = 512
)

func getQdrantURL() string {
	if u := os.Getenv("QDRANT_URL"); u != "" {
		return u
	}
	return qdrantURL
}

func GetEmbedURL() string {
	if u := os.Getenv("EMBED_URL"); u != "" {
		return u
	}
	return embedURL
}

// InitVectorCollection 创建 Qdrant 集合（幂等）。
func InitVectorCollection() error {
	body := map[string]any{
		"vectors": map[string]any{
			"size":     vectorDim,
			"distance": "Cosine",
		},
	}
	err := qdrantPut(fmt.Sprintf("/collections/%s", collection), body)
	if err != nil && strings.Contains(err.Error(), "already exists") {
		return nil
	}
	return err
}

// assetUUID 将素材 ID 转为 Qdrant 可用的 UUID。
func assetUUID(id string) string {
	return uuid.NewSHA1(uuid.NameSpaceOID, []byte(id)).String()
}

// UpseertAssetVector 插入或更新素材向量。
func UpsertAssetVector(assetID, text string) error {
	vec, err := TextEmbedding([]string{text})
	if err != nil {
		return err
	}
	if len(vec) == 0 {
		return fmt.Errorf("empty embedding for asset %s", assetID)
	}
	body := map[string]any{
		"points": []map[string]any{{
			"id":      assetUUID(assetID),
			"vector":  vec[0],
			"payload": map[string]string{"text": text, "assetId": assetID},
		}},
	}
	return qdrantPut(fmt.Sprintf("/collections/%s/points", collection), body)
}

// SearchAssetVectors 语义搜索，返回匹配的 asset ID 列表。
func SearchAssetVectors(query string, topK int) ([]string, error) {
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
	resp, err := qdrantPost(fmt.Sprintf("/collections/%s/points/search", collection), body)
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
		if aid := r.Payload["assetId"]; aid != "" {
			ids = append(ids, aid)
		}
	}
	return ids, nil
}

// DeleteAssetVector 删除指定素材的向量。
func DeleteAssetVector(assetID string) error {
	body := map[string]any{
		"points": []string{assetUUID(assetID)},
	}
	_, err := qdrantPost(fmt.Sprintf("/collections/%s/points/delete", collection), body)
	return err
}

// ImageEmbedding 调用 Python embedding 服务获取图片向量。
func ImageEmbedding(imageBytes []byte) ([]float64, error) {
	resp, err := http.Post(GetEmbedURL()+"/embed/image", "application/octet-stream", bytes.NewReader(imageBytes))
	if err != nil {
		return nil, fmt.Errorf("embedding service error: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		b, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("embedding service returned %d: %s", resp.StatusCode, string(b))
	}
	var result struct {
		Vector []float64 `json:"vector"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}
	return result.Vector, nil
}

// TextEmbedding 调用 Python embedding 服务。
func TextEmbedding(texts []string) ([][]float64, error) {
	body, _ := json.Marshal(map[string]any{"texts": texts})
	resp, err := http.Post(GetEmbedURL()+"/embed/text", "application/json", bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("embedding service error: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		b, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("embedding service returned %d: %s", resp.StatusCode, string(b))
	}
	var result struct {
		Vectors [][]float64 `json:"vectors"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}
	return result.Vectors, nil
}

func qdrantPut(path string, body any) error {
	payload, _ := json.Marshal(body)
	req, _ := http.NewRequest(http.MethodPut, getQdrantURL()+path, bytes.NewReader(payload))
	req.Header.Set("Content-Type", "application/json")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		b, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("qdrant error %d: %s", resp.StatusCode, string(b))
	}
	return nil
}

func qdrantPost(path string, body any) ([]byte, error) {
	payload, _ := json.Marshal(body)
	resp, err := http.Post(getQdrantURL()+path, "application/json", bytes.NewReader(payload))
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	b, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("qdrant error %d: %s", resp.StatusCode, string(b))
	}
	return b, nil
}
