package service

import (
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"
	"time"
)

const edgeTTSURL = "https://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=6A5AA1D4EAFF4E9FB37E23D68491D6F4"

var edgeTTSVoices = []TTSVoice{
	{ID: "zh-CN-XiaoxiaoNeural", Name: "晓晓（女，温柔）"},
	{ID: "zh-CN-YunxiNeural", Name: "云希（男，叙事）"},
	{ID: "zh-CN-XiaoyiNeural", Name: "晓伊（女，活泼）"},
	{ID: "zh-CN-YunjianNeural", Name: "云健（男，运动）"},
	{ID: "zh-CN-YunxiaNeural", Name: "云夏（男，卡通）"},
	{ID: "zh-CN-YunyangNeural", Name: "云扬（男，新闻）"},
	{ID: "zh-CN-XiaohanNeural", Name: "晓涵（女，温柔）"},
	{ID: "zh-CN-XiaomengNeural", Name: "晓梦（女，活泼）"},
	{ID: "zh-CN-XiaomoNeural", Name: "晓墨（女，沉静）"},
	{ID: "zh-CN-XiaoqiuNeural", Name: "晓秋（女，温暖）"},
}

type TTSVoice struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

func ListTTSVoices() []TTSVoice { return edgeTTSVoices }

func SynthesizeTTS(text, voice string) ([]byte, error) {
	text = strings.TrimSpace(text)
	if text == "" {
		return nil, fmt.Errorf("text is empty")
	}
	if len(text) > 5000 {
		text = text[:5000]
	}
	if voice == "" {
		voice = "zh-CN-XiaoxiaoNeural"
	}

	ssml := fmt.Sprintf(
		`<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="http://www.w3.org/2001/mstts" xml:lang="zh-CN"><voice name="%s"><prosody rate="0%%" pitch="0%%">%s</prosody></voice></speak>`,
		voice, escapeSSML(text),
	)

	var lastErr error
	for attempt := 0; attempt < 3; attempt++ {
		if attempt > 0 {
			time.Sleep(time.Duration(attempt) * 500 * time.Millisecond)
		}
		audio, err := synthesizeOnce(ssml)
		if err == nil && len(audio) >= 200 {
			return audio, nil
		}
		lastErr = err
	}
	if lastErr != nil {
		return nil, lastErr
	}
	return nil, fmt.Errorf("edge-tts returned empty response after retries")
}

func synthesizeOnce(ssml string) ([]byte, error) {
	req, err := http.NewRequest("POST", edgeTTSURL, strings.NewReader(ssml))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/ssml+xml")
	req.Header.Set("X-Microsoft-OutputFormat", "audio-24khz-48kbitrate-mono-mp3")
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 1024))
		log.Printf("edge-tts: status=%d body=%s", resp.StatusCode, string(body))
		return nil, fmt.Errorf("edge-tts returned status %d", resp.StatusCode)
	}

	ct := resp.Header.Get("Content-Type")
	if ct != "" && !strings.HasPrefix(ct, "audio/") {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
		return nil, fmt.Errorf("edge-tts unexpected content-type: %s body=%s", ct, string(body))
	}

	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	if len(raw) == 0 {
		return nil, fmt.Errorf("edge-tts returned empty response")
	}
	return raw, nil
}

func escapeSSML(text string) string {
	text = strings.ReplaceAll(text, "&", "&amp;")
	text = strings.ReplaceAll(text, "<", "&lt;")
	text = strings.ReplaceAll(text, ">", "&gt;")
	text = strings.ReplaceAll(text, `"`, "&quot;")
	text = strings.ReplaceAll(text, "'", "&apos;")
	return text
}
