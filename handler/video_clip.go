package handler

import (
	"encoding/json"
	"net/http"
	"path/filepath"
	"strings"

	"github.com/tigerowo/infinite-canvas/logger"
	"github.com/tigerowo/infinite-canvas/service"
)

// ClipVideoTask 截取视频任务的一段片段（起止时间单位为秒）。
func ClipVideoTask(w http.ResponseWriter, r *http.Request, taskID string) {
	user, ok := service.UserFromContext(r.Context())
	if !ok {
		Fail(w, "未登录或权限不足")
		return
	}
	var request struct {
		Start float64 `json:"start"`
		End   float64 `json:"end"`
	}
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		Fail(w, "请求格式错误")
		return
	}
	if request.End <= request.Start {
		Fail(w, "结束时间必须大于开始时间")
		return
	}
	task, found, err := service.GetUserVideoTask(user.ID, taskID)
	if err != nil || !found {
		Fail(w, "视频任务不存在")
		return
	}
	cached, err := service.CacheVideoResult(task)
	if err != nil {
		logger.Errorf("clip video cache failed: id=%s err=%v", taskID, err)
		Fail(w, "缓存视频失败")
		return
	}
	clipPath, err := service.ClipVideoResult(cached.CachedPath, request.Start, request.End)
	if err != nil {
		logger.Errorf("clip video failed: id=%s err=%v", taskID, err)
		Fail(w, "视频截取失败")
		return
	}
	OK(w, map[string]any{"url": "/api/video-clip/" + filepath.Base(clipPath)})
}

// ClipVideoByURL 下载指定视频 URL 后截取一段（起止时间单位为秒）。
func ClipVideoByURL(w http.ResponseWriter, r *http.Request) {
	if _, ok := service.UserFromContext(r.Context()); !ok {
		Fail(w, "未登录或权限不足")
		return
	}
	var request struct {
		URL   string  `json:"url"`
		Start float64 `json:"start"`
		End   float64 `json:"end"`
	}
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		Fail(w, "请求格式错误")
		return
	}
	if strings.TrimSpace(request.URL) == "" {
		Fail(w, "请提供视频地址")
		return
	}
	if request.End <= request.Start {
		Fail(w, "结束时间必须大于开始时间")
		return
	}
	clipPath, err := service.ClipVideoByURL(request.URL, request.Start, request.End)
	if err != nil {
		logger.Errorf("clip video by url failed: err=%v", err)
		Fail(w, err.Error())
		return
	}
	OK(w, map[string]any{"url": "/api/video-clip/" + filepath.Base(clipPath)})
}

// ConcatVideoClips 将多个剪辑片段（clip-*.mp4）按顺序拼接成一个视频。
func ConcatVideoClips(w http.ResponseWriter, r *http.Request) {
	if _, ok := service.UserFromContext(r.Context()); !ok {
		Fail(w, "未登录或权限不足")
		return
	}
	var request struct {
		Clips []string `json:"clips"`
	}
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		Fail(w, "请求格式错误")
		return
	}
	if len(request.Clips) < 2 {
		Fail(w, "至少需要两个片段才能拼接")
		return
	}
	concatPath, err := service.ConcatVideoResult(request.Clips)
	if err != nil {
		logger.Errorf("concat video failed: err=%v", err)
		Fail(w, err.Error())
		return
	}
	OK(w, map[string]any{"url": "/api/video-clip/" + filepath.Base(concatPath)})
}

// ConcatVideosByURL 下载多个视频 URL 后按顺序拼接。
func ConcatVideosByURL(w http.ResponseWriter, r *http.Request) {
	if _, ok := service.UserFromContext(r.Context()); !ok {
		Fail(w, "未登录或权限不足")
		return
	}
	var request struct {
		URLs []string `json:"urls"`
	}
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		Fail(w, "请求格式错误")
		return
	}
	if len(request.URLs) < 2 {
		Fail(w, "至少需要两个视频")
		return
	}
	concatPath, err := service.ConcatVideosByURL(request.URLs)
	if err != nil {
		logger.Errorf("concat videos by url failed: err=%v", err)
		Fail(w, err.Error())
		return
	}
	OK(w, map[string]any{"url": "/api/video-clip/" + filepath.Base(concatPath)})
}

// TransitionVideosByURL 下载两个视频 URL 后加转场效果。
func TransitionVideosByURL(w http.ResponseWriter, r *http.Request) {
	if _, ok := service.UserFromContext(r.Context()); !ok {
		Fail(w, "未登录或权限不足")
		return
	}
	var request struct {
		URLs       []string `json:"urls"`
		Transition string   `json:"transition"`
		Duration   float64  `json:"duration"`
	}
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		Fail(w, "请求格式错误")
		return
	}
	if len(request.URLs) != 2 {
		Fail(w, "转场需要两个视频")
		return
	}
	transitionPath, err := service.TransitionVideosByURL(request.URLs[0], request.URLs[1], request.Transition, request.Duration)
	if err != nil {
		logger.Errorf("transition videos by url failed: err=%v", err)
		Fail(w, err.Error())
		return
	}
	OK(w, map[string]any{"url": "/api/video-clip/" + filepath.Base(transitionPath)})
}

// TransitionVideoClips 给两个片段加转场效果（重编码，限核限时长）。
func TransitionVideoClips(w http.ResponseWriter, r *http.Request) {
	if _, ok := service.UserFromContext(r.Context()); !ok {
		Fail(w, "未登录或权限不足")
		return
	}
	var request struct {
		Clips      []string `json:"clips"`
		Transition string   `json:"transition"`
		Duration   float64  `json:"duration"`
	}
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		Fail(w, "请求格式错误")
		return
	}
	if len(request.Clips) != 2 {
		Fail(w, "转场需要两个片段")
		return
	}
	transitionPath, err := service.TransitionVideoResult(request.Clips, request.Transition, request.Duration)
	if err != nil {
		logger.Errorf("transition video failed: err=%v", err)
		Fail(w, err.Error())
		return
	}
	OK(w, map[string]any{"url": "/api/video-clip/" + filepath.Base(transitionPath)})
}

// ServeVideoClip 服务截取/拼接/转场出的视频产物（仅限 clip-*/concat-*/transition-*.mp4，防路径穿越）。
func ServeVideoClip(w http.ResponseWriter, r *http.Request, filename string) {
	path, ok := service.MediaFilePath(filename)
	if !ok {
		http.NotFound(w, r)
		return
	}
	http.ServeFile(w, r, path)
}
