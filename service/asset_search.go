package service

import (
	"github.com/tigerowo/infinite-canvas/logger"
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"

	"github.com/tigerowo/infinite-canvas/model"
	"github.com/tigerowo/infinite-canvas/repository"
)

// InitSemanticSearch 初始化语义搜索基础设施（非致命）。
func InitSemanticSearch() {
	if err := repository.InitVectorCollection(); err != nil {
		logger.Errorf("[语义搜索] Qdrant 初始化失败（不影响正常使用）: %v", err)
	} else {
		log.Println("[语义搜索] Qdrant 集合初始化完成")
	}
}

// SemanticSearchResult 语义搜索结果。
type SemanticSearchResult struct {
	Items []model.Asset `json:"items"`
	Total int           `json:"total"`
	Query string        `json:"query"`
}

// SearchAssetsSemantic 语义搜索素材。先向量检索拿到 ID 列表，再从数据库加载完整信息。
func SearchAssetsSemantic(query string, topK int) (*SemanticSearchResult, error) {
	if topK <= 0 {
		topK = 20
	}
	if topK > 100 {
		topK = 100
	}

	ids, err := repository.SearchAssetVectors(query, topK)
	if err != nil {
		return nil, fmt.Errorf("vector search failed: %w", err)
	}
	if len(ids) == 0 {
		return &SemanticSearchResult{Items: []model.Asset{}, Total: 0, Query: query}, nil
	}

	items, err := repository.ListAssetsByIDs(ids)
	if err != nil {
		return nil, err
	}

	// 按向量搜索结果顺序排列
	ordered := make([]model.Asset, 0, len(ids))
	index := make(map[string]model.Asset, len(items))
	for _, a := range items {
		index[a.ID] = a
	}
	for _, id := range ids {
		if a, ok := index[id]; ok {
			ordered = append(ordered, a)
		}
	}
	return &SemanticSearchResult{Items: ordered, Total: len(ordered), Query: query}, nil
}

// InterrogateImage 调用 Python 服务反推图片提示词。
func InterrogateImage(imageData io.Reader) (string, error) {
	var buf bytes.Buffer
	_, err := io.Copy(&buf, imageData)
	if err != nil {
		return "", fmt.Errorf("读取图片失败: %w", err)
	}
	return InterrogateImageBytes(buf.Bytes())
}

func InterrogateImageBytes(imageBytes []byte) (string, error) {
	resp, err := http.Post(repository.GetEmbedURL()+"/interrogate", "image/png", bytes.NewReader(imageBytes))
	if err != nil {
		return "", fmt.Errorf("AI 服务不可用: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		body, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("AI 服务返回错误 %d: %s", resp.StatusCode, string(body))
	}

	var result struct {
		Prompt string `json:"prompt"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		// 尝试作为纯文本读取
		body, _ := io.ReadAll(resp.Body)
		if len(body) == 0 {
			return "", fmt.Errorf("AI 服务返回空结果")
		}
		return string(body), nil
	}
	return result.Prompt, nil
}
