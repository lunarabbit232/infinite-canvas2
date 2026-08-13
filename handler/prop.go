package handler

import (
	"github.com/tigerowo/infinite-canvas/logger"
	"encoding/json"
	"net/http"
	"strings"

	"github.com/tigerowo/infinite-canvas/model"
	"github.com/tigerowo/infinite-canvas/service"
)

func ListProps(w http.ResponseWriter, r *http.Request) {
	user, ok := service.UserFromContext(r.Context())
	if !ok {
		Fail(w, "未登录或权限不足")
		return
	}
	items, err := service.ListUserProps(user.ID)
	if err != nil {
		logger.Errorf("list props failed: user=%s err=%v", user.ID, err)
		Fail(w, "查询失败")
		return
	}
	if items == nil {
		items = []model.Prop{}
	}
	OK(w, items)
}

func SaveProp(w http.ResponseWriter, r *http.Request) {
	user, ok := service.UserFromContext(r.Context())
	if !ok {
		Fail(w, "未登录或权限不足")
		return
	}
	var item model.Prop
	if err := json.NewDecoder(r.Body).Decode(&item); err != nil {
		Fail(w, "请求格式错误")
		return
	}
	item.UserID = user.ID
	saved, err := service.SaveProp(item)
	if err != nil {
		logger.Errorf("save prop failed: user=%s err=%v", user.ID, err)
		Fail(w, "保存失败")
		return
	}
	OK(w, saved)
}

func DeleteProp(w http.ResponseWriter, r *http.Request, id string) {
	user, ok := service.UserFromContext(r.Context())
	if !ok {
		Fail(w, "未登录或权限不足")
		return
	}
	id = strings.TrimSpace(id)
	if id == "" {
		Fail(w, "道具不存在")
		return
	}
	if err := service.DeleteProp(user.ID, id); err != nil {
		logger.Errorf("delete prop failed: user=%s id=%s err=%v", user.ID, id, err)
		Fail(w, "删除失败")
		return
	}
	OK(w, map[string]any{"deleted": true})
}
