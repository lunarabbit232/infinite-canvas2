package handler

import (
	"encoding/json"
	"net/http"

	"github.com/tigerowo/infinite-canvas/service"
)

func UserConfig(w http.ResponseWriter, r *http.Request) {
	config, err := service.CurrentUserConfig(r.Context())
	if err != nil {
		FailError(w, err)
		return
	}
	OK(w, config)
}

func SaveUserModelConfig(w http.ResponseWriter, r *http.Request) {
	var request struct {
		Config json.RawMessage `json:"config"`
	}
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil || len(request.Config) == 0 {
		Fail(w, "配置内容不能为空")
		return
	}
	config, err := service.SaveCurrentUserModelConfig(r.Context(), request.Config)
	if err != nil {
		FailError(w, err)
		return
	}
	OK(w, config)
}

func DeleteUserCanvasProjects(w http.ResponseWriter, r *http.Request) {
	var request struct {
		IDs []string `json:"ids"`
	}
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil ||
		len(request.IDs) == 0 {
		Fail(w, "画布项目参数无效")
		return
	}
	if err := service.DeleteCurrentUserCanvasProjects(
		r.Context(),
		request.IDs,
	); err != nil {
		Fail(w, err.Error())
		return
	}
	OK(w, map[string]bool{"deleted": true})
}

func UserImageHistory(w http.ResponseWriter, r *http.Request) {
	data, err := service.CurrentUserImageHistory(r.Context())
	if err != nil {
		FailError(w, err)
		return
	}
	OK(w, json.RawMessage(data))
}

func SaveUserImageHistory(w http.ResponseWriter, r *http.Request) {
	var request struct {
		Data json.RawMessage `json:"data"`
	}
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil || len(request.Data) == 0 {
		Fail(w, "数据内容不能为空")
		return
	}
	data, err := service.SaveCurrentUserImageHistory(r.Context(), request.Data)
	if err != nil {
		FailError(w, err)
		return
	}
	OK(w, json.RawMessage(data))
}

func UserAssetData(w http.ResponseWriter, r *http.Request) {
	data, err := service.CurrentUserAssetData(r.Context())
	if err != nil {
		FailError(w, err)
		return
	}
	OK(w, json.RawMessage(data))
}

func SaveUserAssetData(w http.ResponseWriter, r *http.Request) {
	var request struct {
		Data json.RawMessage `json:"data"`
	}
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil || len(request.Data) == 0 {
		Fail(w, "数据内容不能为空")
		return
	}
	data, err := service.SaveCurrentUserAssetData(r.Context(), request.Data)
	if err != nil {
		FailError(w, err)
		return
	}
	OK(w, json.RawMessage(data))
}
