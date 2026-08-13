package handler

import (
	"encoding/json"
	"net/http"

	"github.com/tigerowo/infinite-canvas/service"
)

// AssetPrompts 获取素材关联提示词列表。
func AssetPrompts(w http.ResponseWriter, r *http.Request) {
	assetID := r.URL.Query().Get("assetId")
	if assetID == "" {
		Fail(w, "缺少 assetId")
		return
	}
	result, err := service.ListAssetPrompts(assetID)
	if err != nil {
		FailError(w, err)
		return
	}
	OK(w, result)
}

// BindPromptToAsset 绑定提示词到素材。
func BindPromptToAsset(w http.ResponseWriter, r *http.Request) {
	var body struct {
		AssetID   string `json:"assetId"`
		PromptID  string `json:"promptId"`
		Type      string `json:"type"`
		SortOrder int    `json:"sortOrder"`
	}
	_ = json.NewDecoder(r.Body).Decode(&body)
	if body.AssetID == "" || body.PromptID == "" {
		Fail(w, "缺少 assetId 或 promptId")
		return
	}
	if body.Type == "" {
		body.Type = "positive"
	}
	result, err := service.BindPromptToAsset(body.AssetID, body.PromptID, body.Type, body.SortOrder)
	if err != nil {
		FailError(w, err)
		return
	}
	OK(w, result)
}

// UnbindPromptFromAsset 解除提示词绑定。
func UnbindPromptFromAsset(w http.ResponseWriter, r *http.Request) {
	var body struct {
		ID string `json:"id"`
	}
	_ = json.NewDecoder(r.Body).Decode(&body)
	if body.ID == "" {
		Fail(w, "缺少 id")
		return
	}
	err := service.UnbindPromptFromAsset(body.ID)
	if err != nil {
		FailError(w, err)
		return
	}
	OK(w, nil)
}
