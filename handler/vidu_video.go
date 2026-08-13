package handler

import (
	"encoding/json"
	"fmt"
	"strings"

	"github.com/tigerowo/infinite-canvas/model"
)

func isViduChannel(channel model.ModelChannel, modelName string) bool {
	baseURL := strings.ToLower(strings.TrimSpace(channel.BaseURL))
	return strings.Contains(baseURL, "vidu.com")
}

func viduAuthHeader(channel model.ModelChannel) string {
	if isViduChannel(channel, "") {
		return "Token "
	}
	return "Bearer "
}

func normalizeViduVideoBody(body []byte, contentType string, modelName string, channel model.ModelChannel) ([]byte, string, error) {
	var payload map[string]any
	if err := json.Unmarshal(body, &payload); err != nil {
		return body, contentType, nil
	}

	vidu := map[string]any{
		"model":  modelName,
		"prompt": toStringSafe(payload["prompt"]),
	}

	if images := viduExtractImages(payload); len(images) > 0 {
		vidu["images"] = images
	}

	if duration := readFloatString(payload, "duration", "seconds"); duration > 0 {
		vidu["duration"] = int(duration)
	}
	if ratio, ok := payload["aspect_ratio"].(string); ok && ratio != "" {
		vidu["aspect_ratio"] = ratio
	} else if ratio, ok := payload["aspectRatio"].(string); ok && ratio != "" {
		vidu["aspect_ratio"] = ratio
	}
	if res, ok := payload["resolution"].(string); ok && res != "" {
		vidu["resolution"] = res
	}
	if seed := readFloatString(payload, "seed"); seed > 0 {
		vidu["seed"] = int(seed)
	}
	if style, ok := payload["style"].(string); ok && style != "" {
		vidu["style"] = style
	}
	if ma, ok := payload["movement_amplitude"].(string); ok && ma != "" {
		vidu["movement_amplitude"] = ma
	}
	if offPeak, ok := payload["off_peak"].(bool); ok {
		vidu["off_peak"] = offPeak
	}

	b, err := json.Marshal(vidu)
	return b, "application/json", err
}

func transformViduCreateVideoResponse(payload []byte, modelName string) ([]byte, bool) {
	var v map[string]any
	if err := json.Unmarshal(payload, &v); err != nil {
		return nil, false
	}
	if v["task_id"] == nil {
		return nil, false
	}
	v["status"] = v["state"]
	return jsonMarshal(v), true
}

func transformViduTaskStatusResponse(payload []byte, modelName string) ([]byte, bool) {
	var v map[string]any
	if err := json.Unmarshal(payload, &v); err != nil {
		return nil, false
	}
	creations, _ := v["creations"].([]any)
	if len(creations) > 0 {
		if item, ok := creations[0].(map[string]any); ok {
			if url, ok := item["url"].(string); ok && url != "" {
				v["video_url"] = url
				v["url"] = url
			}
			if id, ok := item["id"].(string); ok && id != "" {
				v["video_id"] = id
			}
		}
	}
	v["status"] = v["state"]
	if v["status"] != nil && toStringSafe(v["status"]) == "success" {
		v["progress"] = float64(100)
	}
	return jsonMarshal(v), true
}

func readViduCreateError(raw []byte) string {
	var v map[string]any
	if err := json.Unmarshal(raw, &v); err != nil {
		return ""
	}
	if v["task_id"] != nil {
		return ""
	}
	errCode := toStringSafe(v["err_code"])
	errMsg := toStringSafe(v["err_msg"])
	msg := toStringSafe(v["message"])
	if msg == "" {
		msg = toStringSafe(v["msg"])
	}
	return firstNonEmpty(errMsg, msg, firstNonEmpty(errCode, "Vidu 创建任务失败"))
}

func jsonMarshal(v any) []byte {
	b, _ := json.Marshal(v)
	return b
}

func readFloatString(data map[string]any, keys ...string) float64 {
	for _, key := range keys {
		switch v := data[key].(type) {
		case float64:
			return v
		case json.Number:
			f, _ := v.Float64()
			return f
		case string:
			var f float64
			_, _ = fmt.Sscanf(v, "%f", &f)
			return f
		}
	}
	return 0
}

func viduRequestBodyHasImages(body []byte) bool {
	var payload map[string]any
	if json.Unmarshal(body, &payload) != nil {
		return false
	}
	return len(viduExtractImages(payload)) > 0
}

func viduExtractImages(payload map[string]any) []string {
	var images []string
	for _, key := range []string{"images", "image_url", "imageUrls", "image_urls"} {
		switch v := payload[key].(type) {
		case []any:
			for _, item := range v {
				if s, ok := item.(string); ok && s != "" {
					images = append(images, s)
				}
			}
		case string:
			if v != "" {
				images = append(images, v)
			}
		}
	}
	return images
}
