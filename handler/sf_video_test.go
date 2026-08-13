package handler

import (
	"encoding/json"
	"testing"

	"github.com/tigerowo/infinite-canvas/model"
)

func TestSiliconflowImageSize(t *testing.T) {
	cases := map[string]string{
		"1280x720":  "1280x720",
		"720x1280":  "720x1280",
		"960x960":   "960x960",
		"16:9":      "1280x720",
		"9:16":      "720x1280",
		"1:1":       "960x960",
		"auto":      "1280x720",
		"":          "1280x720",
		"1920x1080": "1280x720",
		"1080x1920": "720x1280",
	}
	for in, want := range cases {
		if got := siliconflowImageSize(in); got != want {
			t.Errorf("siliconflowImageSize(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestTransformSiliconflowCreateResponse(t *testing.T) {
	out, ok := transformSiliconflowCreateResponse([]byte(`{"requestId":"k6c86xim31fv"}`), "")
	if !ok {
		t.Fatal("should transform")
	}
	var m map[string]any
	_ = json.Unmarshal(out, &m)
	if m["task_id"] != "k6c86xim31fv" || m["status"] != "processing" {
		t.Fatalf("unexpected: %s", out)
	}
}

func TestTransformSiliconflowStatusSucceed(t *testing.T) {
	out, ok := transformSiliconflowStatusResponse([]byte(`{"status":"Succeed","position":0,"reason":"","results":{"videos":[{"url":"http://x/v.mp4"}],"timings":{"inference":184.86},"seed":1}}`), "")
	if !ok {
		t.Fatal("should transform")
	}
	var m map[string]any
	_ = json.Unmarshal(out, &m)
	if m["status"] != "completed" || m["video_url"] != "http://x/v.mp4" {
		t.Fatalf("unexpected: %s", out)
	}
}

func TestTransformSiliconflowStatusInProgress(t *testing.T) {
	out, ok := transformSiliconflowStatusResponse([]byte(`{"status":"InProgress","position":0,"results":null}`), "")
	if !ok {
		t.Fatal("should transform")
	}
	var m map[string]any
	_ = json.Unmarshal(out, &m)
	if m["status"] != "processing" {
		t.Fatalf("unexpected: %s", out)
	}
}

func TestTransformSiliconflowStatusFailed(t *testing.T) {
	out, ok := transformSiliconflowStatusResponse([]byte(`{"status":"Failed","reason":"余额不足"}`), "")
	if !ok {
		t.Fatal("should transform")
	}
	var m map[string]any
	_ = json.Unmarshal(out, &m)
	if m["status"] != "failed" || m["error"] != "余额不足" {
		t.Fatalf("unexpected: %s", out)
	}
}

func TestNormalizeSiliconflowVideoBodyJSON(t *testing.T) {
	channel := model.ModelChannel{ID: "siliconflow", BaseURL: "https://api.siliconflow.cn/v1", APIKey: "sk-test"}
	body := []byte(`{"model":"Wan-AI/Wan2.2-T2V-A14B","prompt":"一只猫","size":"1280x720"}`)
	out, contentType, err := normalizeSiliconflowVideoBody(body, "application/json", "Wan-AI/Wan2.2-T2V-A14B", channel)
	if err != nil {
		t.Fatal(err)
	}
	if contentType != "application/json" {
		t.Fatalf("contentType = %s", contentType)
	}
	var m map[string]any
	_ = json.Unmarshal(out, &m)
	if m["model"] != "Wan-AI/Wan2.2-T2V-A14B" || m["prompt"] != "一只猫" || m["image_size"] != "1280x720" {
		t.Fatalf("unexpected: %s", out)
	}
}

func TestNormalizeSiliconflowVideoBodyI2V(t *testing.T) {
	channel := model.ModelChannel{ID: "siliconflow", BaseURL: "https://api.siliconflow.cn/v1", APIKey: "sk-test"}
	body := []byte(`{"model":"Wan-AI/Wan2.2-I2V-A14B","prompt":"动起来","first_frame_url":"https://img.example.com/a.png","aspect_ratio":"9:16"}`)
	out, _, err := normalizeSiliconflowVideoBody(body, "application/json", "Wan-AI/Wan2.2-I2V-A14B", channel)
	if err != nil {
		t.Fatal(err)
	}
	var m map[string]any
	_ = json.Unmarshal(out, &m)
	if m["image_size"] != "720x1280" || m["image"] != "https://img.example.com/a.png" {
		t.Fatalf("unexpected: %s", out)
	}
}
