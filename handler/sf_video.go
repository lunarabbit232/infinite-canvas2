package handler

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"io"
	"mime"
	"mime/multipart"
	"strconv"
	"strings"

	"github.com/tigerowo/infinite-canvas/model"
)

// isSiliconflowVideoChannel 判断是否为硅基流动的视频模型渠道（Wan2.2 系列）。
// 硅基流动同一个渠道下既有文本/图像模型，也有视频模型，因此需要同时匹配 baseURL 与模型名。
func isSiliconflowVideoChannel(channel model.ModelChannel, modelName string) bool {
	baseURL := strings.ToLower(strings.TrimSpace(channel.BaseURL))
	model := strings.ToLower(strings.TrimSpace(modelName))
	return strings.Contains(baseURL, "siliconflow") && strings.Contains(model, "wan2.2")
}

// siliconflowImageSize 把前端传入的尺寸/比例映射为硅基流动的 image_size 枚举。
// 硅基流动仅支持 1280x720 / 720x1280 / 960x960 三种。
func siliconflowImageSize(raw string) string {
	size := strings.ToLower(strings.TrimSpace(raw))
	// "WxH" 格式：按宽高比判断横竖方，避免遗漏。
	if idx := strings.Index(size, "x"); idx > 0 {
		w, _ := strconv.Atoi(strings.TrimSpace(size[:idx]))
		h, _ := strconv.Atoi(strings.TrimSpace(size[idx+1:]))
		if w > 0 && h > 0 {
			if w > h {
				return "1280x720"
			}
			if h > w {
				return "720x1280"
			}
			return "960x960"
		}
	}
	// 比例格式。
	switch size {
	case "9:16", "2:3", "3:4", "portrait":
		return "720x1280"
	case "1:1", "square":
		return "960x960"
	}
	return "1280x720"
}

// normalizeSiliconflowVideoBody 把前端的 OpenAI 兼容请求体（JSON 或 multipart）转换为
// 硅基流动 /video/submit 的请求体：{model, prompt, image_size, negative_prompt?, image?}。
func normalizeSiliconflowVideoBody(body []byte, contentType string, modelName string, channel model.ModelChannel) ([]byte, string, error) {
	payload := map[string]any{}

	if !strings.HasPrefix(strings.ToLower(contentType), "multipart/form-data") {
		_ = json.Unmarshal(body, &payload)
	} else {
		_, params, err := mime.ParseMediaType(contentType)
		if err != nil {
			return body, contentType, nil
		}
		form, err := multipart.NewReader(bytes.NewReader(body), params["boundary"]).ReadForm(32 << 20)
		if err != nil {
			return body, contentType, nil
		}
		defer form.RemoveAll()

		for key, values := range form.Value {
			if len(values) == 0 {
				continue
			}
			if len(values) == 1 {
				payload[key] = parseKIEFormValue(values[0])
			} else {
				items := make([]any, 0, len(values))
				for _, value := range values {
					items = append(items, parseKIEFormValue(value))
				}
				payload[key] = items
			}
		}

		// 参考图可能以文件形式上传（input_reference / first_frame_url / image），转 base64 兜底。
		for field, headers := range form.File {
			if len(headers) == 0 {
				continue
			}
			if field != "input_reference" && field != "first_frame_url" && field != "image" {
				continue
			}
			if _, already := payload["_image_file"]; already {
				continue
			}
			if fh := headers[0]; fh != nil {
				if f, err := fh.Open(); err == nil {
					if data, err := io.ReadAll(io.LimitReader(f, 15<<20)); err == nil && len(data) > 0 {
						contentType := fh.Header.Get("Content-Type")
						if contentType == "" {
							contentType = "image/png"
						}
						payload["_image_file"] = "data:" + contentType + ";base64," + base64.StdEncoding.EncodeToString(data)
					}
					_ = f.Close()
				}
			}
		}
	}

	finalModel := strings.TrimSpace(modelName)
	if finalModel == "" {
		finalModel = strings.TrimSpace(toStringSafe(payload["model"]))
	}

	result := map[string]any{
		"model":      finalModel,
		"prompt":     toStringSafe(payload["prompt"]),
		"image_size": siliconflowImageSize(firstNonEmpty(toStringSafe(payload["image_size"]), toStringSafe(payload["size"]), toStringSafe(payload["aspect_ratio"]))),
	}

	if np := toStringSafe(payload["negative_prompt"]); np != "" {
		result["negative_prompt"] = np
	}

	if img := siliconflowImageInput(payload); img != "" {
		result["image"] = img
	}

	encoded, err := json.Marshal(result)
	if err != nil {
		return body, contentType, nil
	}
	return encoded, "application/json", nil
}

// siliconflowImageInput 提取 I2V 的参考图：优先公开 URL / data URL，其次 base64 兜底。
func siliconflowImageInput(payload map[string]any) string {
	for _, key := range []string{"image", "image_url", "first_frame_url", "input_reference", "_image_file"} {
		switch value := payload[key].(type) {
		case string:
			if value != "" && (strings.HasPrefix(value, "http://") || strings.HasPrefix(value, "https://") || strings.HasPrefix(value, "data:")) {
				return value
			}
		case []any:
			for _, item := range value {
				if s, ok := item.(string); ok && s != "" && (strings.HasPrefix(s, "http://") || strings.HasPrefix(s, "https://") || strings.HasPrefix(s, "data:")) {
					return s
				}
			}
		}
	}
	return ""
}

// transformSiliconflowCreateResponse 把 /video/submit 的响应 {requestId: "xxx"} 转换为
// 项目内部可识别的 {task_id: "xxx", status: "processing"}。
func transformSiliconflowCreateResponse(payload []byte, modelName string) ([]byte, bool) {
	var value map[string]any
	if err := json.Unmarshal(payload, &value); err != nil {
		return nil, false
	}
	requestID := firstNonEmpty(toStringSafe(value["requestId"]), toStringSafe(value["request_id"]))
	if requestID == "" {
		return nil, false
	}
	return jsonMarshal(map[string]any{
		"task_id": requestID,
		"status":  "processing",
	}), true
}

// transformSiliconflowStatusResponse 把 /video/status 的响应转换为项目内部结构。
// 硅基流动状态值为 InProgress / Succeed / Failed，视频链接在 results.videos[0].url。
func transformSiliconflowStatusResponse(payload []byte, modelName string) ([]byte, bool) {
	var value map[string]any
	if err := json.Unmarshal(payload, &value); err != nil {
		return nil, false
	}
	status := strings.ToLower(strings.TrimSpace(toStringSafe(value["status"])))
	videoURL := siliconflowResultURL(value)

	result := map[string]any{}
	switch status {
	case "succeed", "success", "succeeded", "completed", "complete", "done":
		if videoURL == "" {
			result["status"] = "failed"
			result["error"] = "视频生成完成但未返回链接"
		} else {
			result["status"] = "completed"
			result["progress"] = 100
			result["video_url"] = videoURL
		}
	case "failed", "fail", "error", "canceled", "cancelled":
		result["status"] = "failed"
		result["error"] = firstNonEmpty(toStringSafe(value["reason"]), "视频任务生成失败")
	default: // inprogress 等中间态
		result["status"] = "processing"
	}

	return jsonMarshal(result), true
}

// siliconflowResultURL 从 results.videos[0].url 提取视频链接。
func siliconflowResultURL(value map[string]any) string {
	results, ok := value["results"].(map[string]any)
	if !ok {
		return ""
	}
	videos, ok := results["videos"].([]any)
	if !ok || len(videos) == 0 {
		return ""
	}
	if first, ok := videos[0].(map[string]any); ok {
		if url := toStringSafe(first["url"]); url != "" {
			return url
		}
	}
	return ""
}
