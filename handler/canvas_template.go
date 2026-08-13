package handler

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/tigerowo/infinite-canvas/model"
	"github.com/tigerowo/infinite-canvas/service"
)

// SaveCanvasTemplate 保存模板。
func SaveCanvasTemplate(w http.ResponseWriter, r *http.Request) {
	var item model.CanvasTemplate
	_ = json.NewDecoder(r.Body).Decode(&item)
	if item.Title == "" {
		Fail(w, "缺少模板标题")
		return
	}
	result, err := service.SaveCanvasTemplate(item)
	if err != nil {
		FailError(w, err)
		return
	}
	OK(w, result)
}

// ListCanvasTemplates 模板列表。
func ListCanvasTemplates(w http.ResponseWriter, r *http.Request) {
	keyword := r.URL.Query().Get("keyword")
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	pageSize, _ := strconv.Atoi(r.URL.Query().Get("pageSize"))
	result, err := service.ListCanvasTemplates(keyword, page, pageSize)
	if err != nil {
		FailError(w, err)
		return
	}
	OK(w, result)
}

// InstantiateCanvasTemplate 导入模板。
func InstantiateCanvasTemplate(w http.ResponseWriter, r *http.Request) {
	var body struct {
		ID string `json:"id"`
	}
	_ = json.NewDecoder(r.Body).Decode(&body)
	if body.ID == "" {
		Fail(w, "缺少模板 ID")
		return
	}
	data, err := service.InstantiateCanvasTemplate(body.ID)
	if err != nil {
		FailError(w, err)
		return
	}
	OK(w, map[string]string{"templateData": data})
}

// DeleteCanvasTemplate 删除模板。
func DeleteCanvasTemplate(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		Fail(w, "缺少模板 ID")
		return
	}
	err := service.DeleteCanvasTemplate(id)
	if err != nil {
		FailError(w, err)
		return
	}
	OK(w, nil)
}

// FavoriteCanvasTemplate 收藏/取消收藏模板。
func FavoriteCanvasTemplate(w http.ResponseWriter, r *http.Request) {
	var body struct {
		ID       string `json:"id"`
		Favorite bool   `json:"favorite"`
	}
	_ = json.NewDecoder(r.Body).Decode(&body)
	if body.ID == "" {
		Fail(w, "缺少模板 ID")
		return
	}
	if err := service.FavoriteCanvasTemplate(body.ID, body.Favorite); err != nil {
		FailError(w, err)
		return
	}
	OK(w, true)
}

// FeaturedTemplates 热门推荐模板列表。
func FeaturedTemplates(w http.ResponseWriter, r *http.Request) {
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	items, err := service.FeaturedCanvasTemplates(limit)
	if err != nil {
		FailError(w, err)
		return
	}
	OK(w, items)
}
