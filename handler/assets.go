package handler

import (
	"github.com/tigerowo/infinite-canvas/logger"
	"encoding/json"
	"io"
	"net/http"
	"strings"

	"github.com/tigerowo/infinite-canvas/model"
	"github.com/tigerowo/infinite-canvas/service"
)

func Assets(w http.ResponseWriter, r *http.Request) {
	result, err := service.ListAssets(parseQuery(r))
	if err != nil {
		FailError(w, err)
		return
	}
	OK(w, result)
}

func AdminAssets(w http.ResponseWriter, r *http.Request) {
	result, err := service.ListAssets(parseQuery(r))
	if err != nil {
		FailError(w, err)
		return
	}
	OK(w, result)
}

func AdminSaveAsset(w http.ResponseWriter, r *http.Request) {
	var item model.Asset
	_ = json.NewDecoder(r.Body).Decode(&item)
	result, err := service.SaveAsset(item)
	if err != nil {
		FailError(w, err)
		return
	}
	OK(w, result)
}

// SearchSemanticAssets 语义搜索素材。
func SearchSemanticAssets(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Query string `json:"query"`
		TopK  int    `json:"topK"`
	}
	_ = json.NewDecoder(r.Body).Decode(&body)
	if body.Query == "" {
		Fail(w, "请输入搜索内容")
		return
	}
	result, err := service.SearchAssetsSemantic(body.Query, body.TopK)
	if err != nil {
		FailError(w, err)
		return
	}
	OK(w, result)
}

// InterrogateImage 反推图片提示词。
func InterrogateImage(w http.ResponseWriter, r *http.Request) {
	r.ParseMultipartForm(10 << 20) // 10 MB
	file, _, err := r.FormFile("image")
	if err != nil {
		Fail(w, "请上传图片文件")
		return
	}
	defer file.Close()
	prompt, err := service.InterrogateImage(file)
	if err != nil {
		FailError(w, err)
		return
	}
	OK(w, map[string]string{"prompt": prompt})
}

// AdminBatchImportAssets 批量导入素材。
func AdminBatchImportAssets(w http.ResponseWriter, r *http.Request) {
	var items []model.Asset
	if err := json.NewDecoder(r.Body).Decode(&items); err != nil {
		Fail(w, "请求格式错误: "+err.Error())
		return
	}
	if len(items) == 0 {
		Fail(w, "没有可导入的素材")
		return
	}
	if len(items) > 100 {
		Fail(w, "单次最多导入 100 个素材")
		return
	}
	result, err := service.BatchImportAssets(items)
	if err != nil {
		FailError(w, err)
		return
	}
	OK(w, result)
}

func AdminDeleteAsset(w http.ResponseWriter, r *http.Request, id string) {
	if err := service.DeleteAsset(id); err != nil {
		FailError(w, err)
		return
	}
	OK(w, true)
}

func AdminUploadAsset(w http.ResponseWriter, r *http.Request) {
	r.ParseMultipartForm(100 << 20)
	file, header, err := r.FormFile("file")
	if err != nil {
		Fail(w, "请选择要上传的文件")
		return
	}
	defer file.Close()
	data, err := io.ReadAll(file)
	if err != nil {
		FailError(w, err)
		return
	}
	contentType := header.Header.Get("Content-Type")
	if strings.TrimSpace(contentType) == "" {
		contentType = http.DetectContentType(data)
	}
	object, err := service.UploadStorageObjectWithProvider(r.Context(), header.Filename, contentType, data, nil)
	if err != nil {
		logger.Errorf("admin upload asset file failed: err=%v", err)
		Fail(w, "文件上传失败")
		return
	}
	item := model.Asset{
		Title:       r.FormValue("title"),
		Type:        model.AssetType(r.FormValue("type")),
		Category:    r.FormValue("category"),
		Description: r.FormValue("description"),
		URL:         object.URL,
		MimeType:    object.MimeType,
		FileSize:    object.Bytes,
	}
	if item.Title == "" {
		item.Title = header.Filename
	}
	if raw := r.FormValue("tags"); raw != "" {
		var tags []model.AssetTag
		if json.Unmarshal([]byte(raw), &tags) == nil {
			item.Tags = tags
		}
	}
	saved, err := service.SaveAsset(item)
	if err != nil {
		logger.Errorf("admin upload asset save failed: err=%v", err)
		Fail(w, "素材保存失败")
		return
	}
	OK(w, saved)
}
