package handler

import (
	"github.com/tigerowo/infinite-canvas/logger"
	"encoding/json"
	"net/http"
	"strings"

	"github.com/tigerowo/infinite-canvas/model"
	"github.com/tigerowo/infinite-canvas/service"
)

func ListKnowledgeEntries(w http.ResponseWriter, r *http.Request) {
	user, ok := service.UserFromContext(r.Context())
	if !ok || user.Role != "admin" {
		Fail(w, "无权访问")
		return
	}
	category := strings.TrimSpace(r.URL.Query().Get("category"))
	items, err := service.ListKnowledgeEntries(category)
	if err != nil {
		logger.Errorf("list knowledge failed: err=%v", err)
		Fail(w, "查询失败")
		return
	}
	if items == nil {
		items = []model.KnowledgeEntry{}
	}
	OK(w, items)
}

func SaveKnowledgeEntry(w http.ResponseWriter, r *http.Request) {
	user, ok := service.UserFromContext(r.Context())
	if !ok || user.Role != "admin" {
		Fail(w, "无权访问")
		return
	}
	var item model.KnowledgeEntry
	if err := json.NewDecoder(r.Body).Decode(&item); err != nil {
		Fail(w, "请求格式错误")
		return
	}
	saved, err := service.SaveKnowledgeEntry(item)
	if err != nil {
		logger.Errorf("save knowledge failed: err=%v", err)
		Fail(w, "保存失败")
		return
	}
	OK(w, saved)
}

func DeleteKnowledgeEntry(w http.ResponseWriter, r *http.Request, id string) {
	user, ok := service.UserFromContext(r.Context())
	if !ok || user.Role != "admin" {
		Fail(w, "无权访问")
		return
	}
	if err := service.DeleteKnowledgeEntry(strings.TrimSpace(id)); err != nil {
		logger.Errorf("delete knowledge failed: id=%s err=%v", id, err)
		Fail(w, "删除失败")
		return
	}
	OK(w, map[string]any{"deleted": true})
}
