package handler

import (
	"github.com/tigerowo/infinite-canvas/logger"
	"encoding/json"
	"net/http"
	"strings"

	"github.com/tigerowo/infinite-canvas/model"
	"github.com/tigerowo/infinite-canvas/service"
)

func ListCharacters(w http.ResponseWriter, r *http.Request) {
	user, ok := service.UserFromContext(r.Context())
	if !ok {
		Fail(w, "未登录或权限不足")
		return
	}
	items, err := service.ListUserCharacters(user.ID)
	if err != nil {
		logger.Errorf("list characters failed: user=%s err=%v", user.ID, err)
		Fail(w, "查询失败")
		return
	}
	if items == nil {
		items = []model.Character{}
	}
	OK(w, items)
}

func SaveCharacter(w http.ResponseWriter, r *http.Request) {
	user, ok := service.UserFromContext(r.Context())
	if !ok {
		Fail(w, "未登录或权限不足")
		return
	}
	var item model.Character
	if err := json.NewDecoder(r.Body).Decode(&item); err != nil {
		Fail(w, "请求格式错误")
		return
	}
	item.UserID = user.ID
	saved, err := service.SaveCharacter(item)
	if err != nil {
		logger.Errorf("save character failed: user=%s err=%v", user.ID, err)
		Fail(w, "保存失败")
		return
	}
	OK(w, saved)
}

func DeleteCharacter(w http.ResponseWriter, r *http.Request, id string) {
	user, ok := service.UserFromContext(r.Context())
	if !ok {
		Fail(w, "未登录或权限不足")
		return
	}
	id = strings.TrimSpace(id)
	if id == "" {
		Fail(w, "角色不存在")
		return
	}
	if err := service.DeleteCharacter(user.ID, id); err != nil {
		logger.Errorf("delete character failed: user=%s id=%s err=%v", user.ID, id, err)
		Fail(w, "删除失败")
		return
	}
	OK(w, map[string]any{"deleted": true})
}

func GenerateCharacterViews(w http.ResponseWriter, r *http.Request) {
	var request model.GenerateCharacterViewsRequest
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		Fail(w, "请求格式错误")
		return
	}
	if request.Description == "" && request.Name == "" {
		Fail(w, "请提供角色名称或描述")
		return
	}
	result := service.GenerateCharacterViews(request)
	OK(w, result)
}

type checkCharacterConsistencyRequest struct {
	CharacterID string `json:"characterId"`
	ImageURL    string `json:"imageUrl"`
}

func CheckCharacterConsistency(w http.ResponseWriter, r *http.Request) {
	user, ok := service.UserFromContext(r.Context())
	if !ok {
		Fail(w, "未登录或权限不足")
		return
	}
	var request checkCharacterConsistencyRequest
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		Fail(w, "请求格式错误")
		return
	}
	if strings.TrimSpace(request.CharacterID) == "" || strings.TrimSpace(request.ImageURL) == "" {
		Fail(w, "请提供角色 ID 和结果图片地址")
		return
	}
	score := service.CheckCharacterConsistencyByURL(user.ID, request.CharacterID, request.ImageURL)
	OK(w, map[string]any{"score": score, "characterId": request.CharacterID})
}
