package service

import (
	"strings"

	"github.com/tigerowo/infinite-canvas/repository"
)

// ExpandQuery 将查询中的中文词汇扩展为其同义词。
func ExpandQuery(query string) string {
	syns, _ := repository.ListTagSynonyms()
	tags, _ := repository.ListTags()
	// 构建 中文同义词 -> 英文标签名 映射
	zh2en := map[string]string{}
	for _, t := range tags {
		if t.NameZh != "" {
			zh2en[strings.ToLower(t.NameZh)] = t.Name
		}
	}
	// 收集同义词扩展
	extra := []string{}
	qLower := strings.ToLower(query)
	for _, s := range syns {
		sl := strings.ToLower(s.Synonym)
		if strings.Contains(qLower, sl) {
			// 找到同义词所属标签的英文名
			for _, t := range tags {
				if t.ID == s.TagID && t.Name != "" {
					// 如果查询中没有英文标签，追加
					if !strings.Contains(qLower, strings.ToLower(t.Name)) {
						extra = append(extra, t.Name)
					}
					break
				}
			}
		}
	}
	if len(extra) > 0 {
		return query + " " + strings.Join(extra, " ")
	}
	return query
}
