package handler

import (
	"github.com/tigerowo/infinite-canvas/logger"
	"encoding/json"
	"net/http"
	"strings"

	"github.com/tigerowo/infinite-canvas/model"
	"github.com/tigerowo/infinite-canvas/service"
)

type setMentorRequest struct {
	MentorID string `json:"mentorId"`
}

func SetMentor(w http.ResponseWriter, r *http.Request) {
	user, ok := service.UserFromContext(r.Context())
	if !ok || user.ID == "" {
		Fail(w, "请先登录")
		return
	}
	var req setMentorRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		Fail(w, "请求格式错误")
		return
	}
	if err := service.SetMentor(user.ID, req.MentorID); err != nil {
		Fail(w, err.Error())
		return
	}
	OK(w, map[string]any{"ok": true})
}

func GetRoleChain(w http.ResponseWriter, r *http.Request) {
	user, ok := service.UserFromContext(r.Context())
	if !ok || user.ID == "" {
		Fail(w, "请先登录")
		return
	}
	chain, err := service.GetRoleChain(user.ID)
	if err != nil {
		OK(w, map[string]any{"mentorId": ""})
		return
	}
	OK(w, chain)
}

func ListMentees(w http.ResponseWriter, r *http.Request) {
	user, ok := service.UserFromContext(r.Context())
	if !ok || user.ID == "" {
		Fail(w, "请先登录")
		return
	}
	mentees, err := service.ListMentees(user.ID)
	if err != nil {
		logger.Errorf("list mentees failed: err=%v", err)
		Fail(w, "查询失败")
		return
	}
	if mentees == nil {
		mentees = []model.RoleChain{}
	}
	OK(w, mentees)
}

func SaveUserKnowledge(w http.ResponseWriter, r *http.Request) {
	user, ok := service.UserFromContext(r.Context())
	if !ok || user.ID == "" {
		Fail(w, "请先登录")
		return
	}
	var item model.KnowledgeEntry
	if err := json.NewDecoder(r.Body).Decode(&item); err != nil {
		Fail(w, "请求格式错误")
		return
	}
	saved, err := service.SaveUserKnowledge(user.ID, item)
	if err != nil {
		logger.Errorf("save user knowledge failed: err=%v", err)
		Fail(w, "保存失败")
		return
	}
	OK(w, saved)
}

func ListUserKnowledge(w http.ResponseWriter, r *http.Request) {
	user, ok := service.UserFromContext(r.Context())
	if !ok || user.ID == "" {
		Fail(w, "请先登录")
		return
	}
	category := strings.TrimSpace(r.URL.Query().Get("category"))
	items, err := service.ListUserKnowledge(user.ID, category)
	if err != nil {
		logger.Errorf("list user knowledge failed: err=%v", err)
		Fail(w, "查询失败")
		return
	}
	if items == nil {
		items = []model.KnowledgeEntry{}
	}
	OK(w, items)
}

func DeleteUserKnowledge(w http.ResponseWriter, r *http.Request, id string) {
	user, ok := service.UserFromContext(r.Context())
	if !ok || user.ID == "" {
		Fail(w, "请先登录")
		return
	}
	if err := service.DeleteUserKnowledge(user.ID, id); err != nil {
		logger.Errorf("delete user knowledge failed: id=%s err=%v", id, err)
		Fail(w, "删除失败")
		return
	}
	OK(w, map[string]any{"deleted": true})
}
