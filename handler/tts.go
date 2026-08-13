package handler

import (
	"encoding/json"
	"net/http"
	"github.com/tigerowo/infinite-canvas/service"
)

func TTSVoices(w http.ResponseWriter, r *http.Request) {
	_, ok := service.UserFromContext(r.Context())
	if !ok {
		Fail(w, "未登录")
		return
	}
	OK(w, service.ListTTSVoices())
}

type ttsSynthesizeRequest struct {
	Text  string `json:"text"`
	Voice string `json:"voice"`
}

func TTSSynthesize(w http.ResponseWriter, r *http.Request) {
	_, ok := service.UserFromContext(r.Context())
	if !ok {
		Fail(w, "未登录")
		return
	}
	var req ttsSynthesizeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		Fail(w, "请求格式错误")
		return
	}
	if req.Text == "" {
		Fail(w, "请输入旁白文本")
		return
	}
	audio, err := service.SynthesizeTTS(req.Text, req.Voice)
	if err != nil {
		Fail(w, "语音合成失败: "+err.Error())
		return
	}
	w.Header().Set("Content-Type", "audio/mpeg")
	w.Header().Set("Content-Disposition", "attachment; filename=voice.mp3")
	w.Write(audio)
}
