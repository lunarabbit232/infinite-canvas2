package handler

import (
	"github.com/tigerowo/infinite-canvas/logger"
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/tigerowo/infinite-canvas/model"
	"github.com/tigerowo/infinite-canvas/service"
)

func Prompts(w http.ResponseWriter, r *http.Request) {
	result, err := service.ListPrompts(parseQuery(r))
	if err != nil {
		FailError(w, err)
		return
	}
	OK(w, result)
}

// SearchSemanticPrompts 提示词语义搜索（含降级：embedding 不可用时回退关键词）。
func SearchSemanticPrompts(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Query string `json:"query"`
		TopK  int    `json:"topK"`
	}
	_ = json.NewDecoder(r.Body).Decode(&body)
	if body.Query == "" {
		Fail(w, "请输入搜索内容")
		return
	}
	if body.TopK <= 0 {
		body.TopK = 20
	}

	expandedQuery := service.ExpandQuery(body.Query)
	ids, err := service.SearchPromptsSemantic(expandedQuery, body.TopK)
	if err != nil {
		logger.Errorf("[语义搜索] 向量检索失败，降级关键词: %v", err)
		// 降级：关键词搜索
		q := model.Query{Keyword: body.Query, PageSize: body.TopK}
		result, kwErr := service.ListPrompts(q)
		if kwErr != nil {
			FailError(w, kwErr)
			return
		}
		OK(w, map[string]any{"items": result.Items, "total": result.Total, "query": body.Query, "fallback": true})
		return
	}

	results, err := service.ListPromptsByIDs(ids)
	if err != nil {
		FailError(w, err)
		return
	}
	OK(w, map[string]any{"items": results, "total": len(results), "query": body.Query})
}

// SearchHybridPrompts 混合检索：标签预过滤 + 向量排序。
func SearchHybridPrompts(w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query().Get("q")
	if query == "" {
		Fail(w, "请输入搜索内容")
		return
	}
	tagFilter := r.URL.Query().Get("tag")
	topK, _ := strconv.Atoi(r.URL.Query().Get("topK"))
	if topK <= 0 {
		topK = 20
	}

	// 1. 先用标签 AND 过滤（如果有）
	var preFiltered []model.Prompt
	if tagFilter != "" {
		q := model.Query{Tags: []string{tagFilter}, PageSize: 500}
		result, err := service.ListPrompts(q)
		if err != nil {
			FailError(w, err)
			return
		}
		preFiltered = result.Items
	}

	// 2. 向量搜索
	expandedQuery := service.ExpandQuery(query)
	ids, err := service.SearchPromptsSemantic(expandedQuery, 100)
	if err != nil {
		logger.Errorf("[混合检索] 向量检索失败，降级关键词: %v", err)
		q := model.Query{Keyword: query, PageSize: topK}
		if tagFilter != "" {
			q.Tags = []string{tagFilter}
		}
		result, kwErr := service.ListPrompts(q)
		if kwErr != nil {
			FailError(w, kwErr)
			return
		}
		OK(w, map[string]any{"items": result.Items, "total": result.Total, "query": query, "fallback": true})
		return
	}

	// 3. 加载提示词并按向量顺序排列，同时应用标签过滤
	allResults, _ := service.ListPromptsByIDs(ids)
	ordered := []model.Prompt{}
	tagMatch := map[string]bool{}
	if len(preFiltered) > 0 {
		for _, p := range preFiltered {
			tagMatch[p.ID] = true
		}
	}
	for _, id := range ids {
		for _, p := range allResults {
			if p.ID == id {
				if len(preFiltered) == 0 || tagMatch[p.ID] {
					ordered = append(ordered, p)
				}
				break
			}
		}
	}
	if len(ordered) > topK {
		ordered = ordered[:topK]
	}
	OK(w, map[string]any{"items": ordered, "total": len(ordered), "query": query})
}
