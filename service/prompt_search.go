package service

import (
	"github.com/tigerowo/infinite-canvas/logger"
	"fmt"
	"log"

	"github.com/tigerowo/infinite-canvas/repository"
)

// InitPromptSemanticSearch 初始化提示词语义搜索。
func InitPromptSemanticSearch() {
	if err := repository.InitPromptVectorCollection(); err != nil {
		logger.Errorf("[语义搜索] 提示词 Qdrant 初始化失败: %v", err)
	} else {
		log.Println("[语义搜索] 提示词 Qdrant 集合初始化完成")
	}
}

// SearchPromptsSemantic 提示词语义搜索。
func SearchPromptsSemantic(query string, topK int) ([]string, error) {
	if topK <= 0 {
		topK = 20
	}
	if topK > 100 {
		topK = 100
	}
	ids, err := repository.SearchPromptVectors(query, topK)
	if err != nil {
		return nil, fmt.Errorf("prompt vector search failed: %w", err)
	}
	return ids, nil
}

// VectorizePrompt 对提示词文本生成向量并存入 Qdrant。
func VectorizePrompt(promptID, text string) {
	if err := repository.UpsertPromptVector(promptID, text); err != nil {
		logger.Errorf("[语义搜索] 提示词向量化失败 id=%s: %v", promptID, err)
	}
}
