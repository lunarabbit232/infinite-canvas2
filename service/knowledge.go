package service

import (
	"errors"
	"sort"
	"strings"

	"gorm.io/gorm"

	"github.com/tigerowo/infinite-canvas/logger"
	"github.com/tigerowo/infinite-canvas/model"
	"github.com/tigerowo/infinite-canvas/repository"
)

func ListKnowledgeEntries(category string) ([]model.KnowledgeEntry, error) {
	return repository.ListKnowledgeEntries(strings.TrimSpace(category))
}

func SaveKnowledgeEntry(item model.KnowledgeEntry) (model.KnowledgeEntry, error) {
	item.Title = strings.TrimSpace(item.Title)
	item.Category = strings.TrimSpace(item.Category)
	item.Content = strings.TrimSpace(item.Content)
	if item.ID == "" {
		item.ID = newID("knowledge")
	}
	item.UpdatedAt = now()
	if item.CreatedAt == "" {
		item.CreatedAt = item.UpdatedAt
	}
	saved, err := repository.SaveKnowledgeEntry(item)
	if err != nil {
		return saved, err
	}
	indexKnowledgeVector(saved)
	return saved, nil
}

func DeleteKnowledgeEntry(id string) error {
	id = strings.TrimSpace(id)
	if err := repository.DeleteKnowledgeEntry(id); err != nil {
		return err
	}
	go func() {
		if err := repository.DeleteKnowledgeVector(id); err != nil {
			logger.Errorf("delete knowledge vector failed: id=%s err=%v", id, err)
		}
	}()
	return nil
}

// indexKnowledgeVector 异步写入知识条目向量（fail-open，失败不影响保存）。
func indexKnowledgeVector(item model.KnowledgeEntry) {
	text := strings.TrimSpace(item.Title + " " + item.Content)
	if text == "" {
		return
	}
	id := item.ID
	go func() {
		if err := repository.UpsertKnowledgeVector(id, text); err != nil {
			logger.Errorf("index knowledge vector failed: id=%s err=%v", id, err)
		}
	}()
}

func BuildKnowledgeContext(category string) string {
	entries, err := repository.ListKnowledgeEntries(category)
	if err != nil || len(entries) == 0 {
		return ""
	}
	if len(entries) > 5 {
		entries = entries[:5]
	}
	var builder strings.Builder
	builder.WriteString("\n\n# 知识库参考资料\n以下是你应该运用的领域知识：\n\n")
	for _, entry := range entries {
		builder.WriteString("## ")
		builder.WriteString(entry.Title)
		builder.WriteString("\n")
		builder.WriteString(entry.Content)
		builder.WriteString("\n\n")
	}
	return builder.String()
}

func BuildRoleKnowledgeContext(userID string, category string) string {
	return SearchRoleKnowledge(userID, category, "", 0)
}

func SearchRoleKnowledge(userID string, category string, query string, topN int) string {
	mentorIDs := collectMentorIDs(userID)
	if topN <= 0 {
		topN = 5
	}
	query = strings.TrimSpace(query)

	entries, err := repository.ListRoleKnowledge(userID, mentorIDs, category)
	if err != nil || len(entries) == 0 {
		return ""
	}

	if query == "" {
		if len(entries) > topN {
			entries = entries[:topN]
		}
		return buildKnowledgeContext(entries)
	}

	// 1. 关键词检索（规则引擎，精确命中优先）
	if hasKeywordMatch(entries, query) {
		return buildKnowledgeContext(rankByKeywordMatch(entries, query, topN))
	}

	// 2. 关键词完全未命中 → 向量语义召回兜底（fail-open）
	if vecEntries := semanticSearchKnowledge(userID, mentorIDs, category, query, topN); len(vecEntries) > 0 {
		return buildKnowledgeContext(vecEntries)
	}

	// 3. 都失败 → 返回前 topN（原 fallback）
	return buildKnowledgeContext(rankByKeywordMatch(entries, query, topN))
}

// hasKeywordMatch 判断 query 的关键词是否命中任意条目的 Keywords/Title/Content。
func hasKeywordMatch(entries []model.KnowledgeEntry, query string) bool {
	keywords := extractKeywords(query)
	if len(keywords) == 0 {
		return false
	}
	for _, e := range entries {
		entryKeywords := strings.ToLower(e.Keywords)
		entryTitle := strings.ToLower(e.Title)
		entryContent := strings.ToLower(e.Content)
		for _, kw := range keywords {
			kw = strings.ToLower(kw)
			if strings.Contains(entryKeywords, kw) || strings.Contains(entryTitle, kw) || strings.Contains(entryContent, kw) {
				return true
			}
		}
	}
	return false
}

// semanticSearchKnowledge 向量召回后按可见范围精确过滤，返回相关性降序的条目。
func semanticSearchKnowledge(userID string, mentorIDs []string, category string, query string, topN int) []model.KnowledgeEntry {
	ids, err := repository.SearchKnowledgeVectors(query, topN*3)
	if err != nil || len(ids) == 0 {
		return nil
	}
	entries, err := repository.ListKnowledgeByIDs(ids, userID, mentorIDs, category)
	if err != nil || len(entries) == 0 {
		return nil
	}
	if len(entries) > topN {
		entries = entries[:topN]
	}
	return entries
}

func buildKnowledgeContext(entries []model.KnowledgeEntry) string {
	var builder strings.Builder
	builder.WriteString("\n\n# 知识库参考资料\n以下是你应该运用的领域知识：\n\n")
	for _, entry := range entries {
		builder.WriteString("## ")
		builder.WriteString(entry.Title)
		builder.WriteString("\n")
		builder.WriteString(entry.Content)
		builder.WriteString("\n\n")
	}
	return builder.String()
}

var stopWords = map[string]bool{
	"的": true, "了": true, "是": true, "在": true, "和": true, "也": true, "就": true, "都": true,
	"不": true, "把": true, "被": true, "对": true, "从": true, "到": true, "与": true, "或": true,
	"要": true, "能": true, "会": true, "可": true, "以": true, "而": true, "且": true, "但": true,
	"着": true, "之": true, "中": true, "后": true, "前": true, "下": true, "上": true, "里": true,
	"外": true, "等": true, "有": true, "来": true, "去": true, "这": true, "那": true, "些": true,
	"个": true, "让": true, "用": true, "将": true, "为": true, "很": true, "还": true, "更": true,
	"只": true, "做": true, "想": true, "知道": true, "可以": true, "怎么": true, "什么": true,
	"如何": true, "帮我": true, "请": true, "一个": true, "这个": true, "那个": true, "一下": true,
}

func extractKeywords(text string) []string {
	var words []string
	current := strings.Builder{}
	for _, r := range text {
		if r <= ' ' || r == '，' || r == '。' || r == '！' || r == '？' || r == '；' || r == '：' ||
			r == '、' || r == '"' || r == '\'' || r == '（' || r == '）' || r == '《' || r == '》' ||
			r == '【' || r == '】' || r == '…' || r == '—' || r == '「' || r == '」' || r == ',' ||
			r == '.' || r == '!' || r == '?' {
			if current.Len() > 0 {
				w := current.String()
				current.Reset()
				if !stopWords[w] && len([]rune(w)) >= 2 {
					words = append(words, w)
				}
			}
		} else {
			current.WriteRune(r)
		}
	}
	if current.Len() > 0 {
		w := current.String()
		if !stopWords[w] && len([]rune(w)) >= 2 {
			words = append(words, w)
		}
	}
	return words
}

func rankByKeywordMatch(entries []model.KnowledgeEntry, query string, topN int) []model.KnowledgeEntry {
	keywords := extractKeywords(query)
	if len(keywords) == 0 {
		if len(entries) > topN {
			return entries[:topN]
		}
		return entries
	}
	type scored struct {
		entry model.KnowledgeEntry
		score int
	}
	var scoredEntries []scored
	for _, e := range entries {
		s := 0
		entryKeywords := strings.ToLower(e.Keywords)
		entryTitle := strings.ToLower(e.Title)
		entryContent := strings.ToLower(e.Content)
		for _, kw := range keywords {
			kw = strings.ToLower(kw)
			s += strings.Count(entryKeywords, kw) * 3
			s += strings.Count(entryTitle, kw) * 2
			s += strings.Count(entryContent, kw)
		}
		if s > 0 {
			scoredEntries = append(scoredEntries, scored{entry: e, score: s})
		}
	}
	if len(scoredEntries) == 0 {
		if len(entries) > topN {
			return entries[:topN]
		}
		return entries
	}
	sort.Slice(scoredEntries, func(i, j int) bool {
		return scoredEntries[i].score > scoredEntries[j].score
	})
	result := make([]model.KnowledgeEntry, 0, topN)
	for i := 0; i < len(scoredEntries) && i < topN; i++ {
		result = append(result, scoredEntries[i].entry)
	}
	return result
}

func collectMentorIDs(userID string) []string {
	var ids []string
	currentID := userID
	for i := 0; i < 20; i++ {
		chain, err := repository.GetRoleChainByUser(currentID)
		if err != nil || chain.MentorID == "" {
			break
		}
		ids = append(ids, chain.MentorID)
		currentID = chain.MentorID
	}
	return ids
}

func SetMentor(userID string, mentorID string) error {
	userID = strings.TrimSpace(userID)
	mentorID = strings.TrimSpace(mentorID)
	if userID == "" {
		return errors.New("用户 ID 不能为空")
	}
	if mentorID == "" {
		return repository.DeleteRoleChain(userID)
	}
	if userID == mentorID {
		return errors.New("不能将自己设为导师")
	}
	chain := model.RoleChain{
		UserID:   userID,
		MentorID: mentorID,
	}
	existing, err := repository.GetRoleChainByUser(userID)
	if err == nil {
		chain.ID = existing.ID
		chain.CreatedAt = existing.CreatedAt
	}
	if chain.ID == "" {
		chain.ID = newID("rc")
	}
	chain.UpdatedAt = now()
	if chain.CreatedAt == "" {
		chain.CreatedAt = chain.UpdatedAt
	}
	_, saveErr := repository.SaveRoleChain(chain)
	return saveErr
}

func GetRoleChain(userID string) (*model.RoleChain, error) {
	return repository.GetRoleChainByUser(strings.TrimSpace(userID))
}

func ListMentees(userID string) ([]model.RoleChain, error) {
	return repository.ListRoleChainMentees(strings.TrimSpace(userID))
}

func SaveUserKnowledge(userID string, item model.KnowledgeEntry) (model.KnowledgeEntry, error) {
	item.UserID = strings.TrimSpace(userID)
	item.Title = strings.TrimSpace(item.Title)
	item.Category = strings.TrimSpace(item.Category)
	item.Content = strings.TrimSpace(item.Content)
	if item.Visibility == "" {
		item.Visibility = model.KnowledgeVisibilityPrivate
	}
	if item.ID == "" {
		item.ID = newID("knowledge")
	}
	item.UpdatedAt = now()
	if item.CreatedAt == "" {
		item.CreatedAt = item.UpdatedAt
	}
	existing, err := repository.ListKnowledgeByUser(userID, "")
	if err == nil {
		for _, e := range existing {
			if e.ID == item.ID {
				item.CreatedAt = e.CreatedAt
				break
			}
		}
	}
	saved, err := repository.SaveKnowledgeEntry(item)
	if err != nil {
		return saved, err
	}
	indexKnowledgeVector(saved)
	return saved, nil
}

func ListUserKnowledge(userID string, category string) ([]model.KnowledgeEntry, error) {
	return repository.ListKnowledgeByUser(strings.TrimSpace(userID), strings.TrimSpace(category))
}

func DeleteUserKnowledge(userID string, id string) error {
	entry, err := repository.ListKnowledgeByUser(userID, "")
	if err != nil {
		return err
	}
	found := false
	for _, e := range entry {
		if e.ID == id && e.UserID == userID {
			found = true
			break
		}
	}
	if !found {
		return gorm.ErrRecordNotFound
	}
	id = strings.TrimSpace(id)
	if err := repository.DeleteKnowledgeEntry(id); err != nil {
		return err
	}
	go func() {
		if err := repository.DeleteKnowledgeVector(id); err != nil {
			logger.Errorf("delete knowledge vector failed: id=%s err=%v", id, err)
		}
	}()
	return nil
}

// InitKnowledgeSemanticSearch 初始化知识库语义搜索（非致命）。
func InitKnowledgeSemanticSearch() {
	if err := repository.InitKnowledgeVectorCollection(); err != nil {
		logger.Errorf("[知识库] Qdrant 集合初始化失败（不影响正常使用）: %v", err)
	} else {
		logger.Infof("[知识库] Qdrant 集合初始化完成")
	}
}

// EnsureKnowledgeVectors 启动时兜底：若 knowledge 集合为空但库中已有知识，则批量向量化。
func EnsureKnowledgeVectors() {
	count, err := repository.KnowledgeVectorCount()
	if err != nil {
		logger.Errorf("[知识库] 查询向量数失败（不影响正常使用）: %v", err)
		return
	}
	if count > 0 {
		return
	}
	entries, err := repository.ListKnowledgeEntries("")
	if err != nil {
		logger.Errorf("[知识库] 读取知识条目失败: %v", err)
		return
	}
	indexed := 0
	for _, e := range entries {
		if err := repository.UpsertKnowledgeVector(e.ID, strings.TrimSpace(e.Title+" "+e.Content)); err != nil {
			logger.Errorf("index knowledge vector failed: id=%s err=%v", e.ID, err)
			continue
		}
		indexed++
	}
	logger.Infof("[知识库] 已向量化 %d 条知识", indexed)
}
