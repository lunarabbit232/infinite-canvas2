package service

import (
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"time"
)

const (
	ffmpegPath  = "bin/ffmpeg"
	ffprobePath = "bin/ffprobe"
)

// runFFmpeg 启动 ffmpeg 并带 5 分钟超时保护，超时强杀进程防卡死。
func runFFmpeg(args []string) error {
	cmd := exec.Command(ffmpegPath, args...)
	if err := cmd.Start(); err != nil {
		return fmt.Errorf("ffmpeg 启动失败: %w", err)
	}
	done := make(chan error, 1)
	go func() { done <- cmd.Wait() }()
	select {
	case err := <-done:
		return err
	case <-time.After(5 * time.Minute):
		_ = cmd.Process.Kill()
		return fmt.Errorf("ffmpeg 操作超时")
	}
}

// probeDuration 用 ffprobe 读取视频时长（秒）。
func probeDuration(path string) (float64, error) {
	cmd := exec.Command(ffprobePath, "-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", path)
	out, err := cmd.Output()
	if err != nil {
		return 0, err
	}
	return strconv.ParseFloat(strings.TrimSpace(string(out)), 64)
}

// ClipVideo 用 ffmpeg 流复制截取视频片段（-c copy 不重编码，CPU 极轻）。
func ClipVideo(srcPath string, startSec, endSec float64, dstPath string) error {
	if startSec < 0 {
		startSec = 0
	}
	if endSec <= startSec {
		return fmt.Errorf("结束时间必须大于开始时间")
	}
	return runFFmpeg([]string{
		"-y",
		"-ss", fmt.Sprintf("%.3f", startSec),
		"-to", fmt.Sprintf("%.3f", endSec),
		"-i", srcPath,
		"-c", "copy",
		dstPath,
	})
}

// ClipVideoResult 将缓存视频截取为一段新片段，返回本地文件路径。
func ClipVideoResult(srcPath string, startSec, endSec float64) (string, error) {
	if err := os.MkdirAll(videoCacheDir, 0o755); err != nil {
		return "", err
	}
	dstPath := filepath.Join(videoCacheDir, "clip-"+newID("clip")+".mp4")
	if err := ClipVideo(srcPath, startSec, endSec, dstPath); err != nil {
		os.Remove(dstPath)
		return "", err
	}
	return dstPath, nil
}

// downloadVideoToTemp 安全下载视频 URL 到临时文件，返回路径（调用方负责清理）。
func downloadVideoToTemp(videoURL string) (string, error) {
	resp, err := SafeProxyHTTPClient().Get(videoURL)
	if err != nil {
		return "", fmt.Errorf("下载视频失败: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		return "", fmt.Errorf("下载视频失败: HTTP %d", resp.StatusCode)
	}
	tmpFile, err := os.CreateTemp("", "video-src-*.mp4")
	if err != nil {
		return "", err
	}
	tmpName := tmpFile.Name()
	if _, err := io.Copy(tmpFile, resp.Body); err != nil {
		tmpFile.Close()
		os.Remove(tmpName)
		return "", err
	}
	if err := tmpFile.Close(); err != nil {
		os.Remove(tmpName)
		return "", err
	}
	return tmpName, nil
}

// ClipVideoByURL 下载视频 URL（安全下载，防 SSRF）后截取一段，返回本地路径。
func ClipVideoByURL(videoURL string, startSec, endSec float64) (string, error) {
	tmpName, err := downloadVideoToTemp(videoURL)
	if err != nil {
		return "", err
	}
	defer os.Remove(tmpName)
	return ClipVideoResult(tmpName, startSec, endSec)
}

// ConcatVideosByURL 下载多个视频 URL 后流拼接，返回本地路径。
func ConcatVideosByURL(urls []string) (string, error) {
	if len(urls) < 2 {
		return "", fmt.Errorf("至少需要两个视频")
	}
	tmpPaths := make([]string, 0, len(urls))
	for _, u := range urls {
		tmp, err := downloadVideoToTemp(u)
		if err != nil {
			for _, p := range tmpPaths {
				os.Remove(p)
			}
			return "", err
		}
		tmpPaths = append(tmpPaths, tmp)
	}
	defer func() {
		for _, p := range tmpPaths {
			os.Remove(p)
		}
	}()
	if err := os.MkdirAll(videoCacheDir, 0o755); err != nil {
		return "", err
	}
	dstPath := filepath.Join(videoCacheDir, "concat-"+newID("concat")+".mp4")
	if err := ConcatVideos(tmpPaths, dstPath); err != nil {
		os.Remove(dstPath)
		return "", err
	}
	return dstPath, nil
}

// TransitionVideosByURL 下载两个视频 URL 后加转场，返回本地路径。
func TransitionVideosByURL(url1, url2, transition string, duration float64) (string, error) {
	tmp1, err := downloadVideoToTemp(url1)
	if err != nil {
		return "", err
	}
	defer os.Remove(tmp1)
	tmp2, err := downloadVideoToTemp(url2)
	if err != nil {
		return "", err
	}
	defer os.Remove(tmp2)
	if err := os.MkdirAll(videoCacheDir, 0o755); err != nil {
		return "", err
	}
	dstPath := filepath.Join(videoCacheDir, "transition-"+newID("transition")+".mp4")
	if err := TransitionVideos(tmp1, tmp2, transition, duration, dstPath); err != nil {
		os.Remove(dstPath)
		return "", err
	}
	return dstPath, nil
}

// ConcatVideos 用 concat demuxer 流拼接多段同参数视频（零重编码，CPU 极轻）。
func ConcatVideos(srcPaths []string, dstPath string) error {
	if len(srcPaths) < 2 {
		return fmt.Errorf("至少需要两个片段才能拼接")
	}
	listFile := dstPath + ".txt"
	var b strings.Builder
	for _, p := range srcPaths {
		abs, err := filepath.Abs(p)
		if err != nil {
			abs = p
		}
		b.WriteString("file '" + filepath.ToSlash(abs) + "'\n")
	}
	if err := os.WriteFile(listFile, []byte(b.String()), 0o644); err != nil {
		return err
	}
	defer os.Remove(listFile)
	return runFFmpeg([]string{
		"-y",
		"-f", "concat",
		"-safe", "0",
		"-i", listFile,
		"-c", "copy",
		dstPath,
	})
}

// ConcatVideoResult 将多个剪辑片段名拼接成一个视频，返回本地路径。
func ConcatVideoResult(names []string) (string, error) {
	paths := make([]string, 0, len(names))
	for _, n := range names {
		p, ok := MediaFilePath(n)
		if !ok {
			return "", fmt.Errorf("非法片段名: %s", n)
		}
		if _, err := os.Stat(p); err != nil {
			return "", fmt.Errorf("片段不存在: %s", n)
		}
		paths = append(paths, p)
	}
	if err := os.MkdirAll(videoCacheDir, 0o755); err != nil {
		return "", err
	}
	dstPath := filepath.Join(videoCacheDir, "concat-"+newID("concat")+".mp4")
	if err := ConcatVideos(paths, dstPath); err != nil {
		os.Remove(dstPath)
		return "", err
	}
	return dstPath, nil
}

// TransitionVideos 用 xfade 给两段视频加转场（重编码，限核 -threads 2 + veryfast）。
func TransitionVideos(src1, src2 string, transition string, duration float64, dstPath string) error {
	if duration <= 0 {
		duration = 1
	}
	if duration > 2 {
		duration = 2 // 限转场时长，防长时间重编码
	}
	dur1, err := probeDuration(src1)
	if err != nil {
		return fmt.Errorf("读取第一段时长失败: %w", err)
	}
	offset := dur1 - duration
	if offset < 0 {
		return fmt.Errorf("第一段视频时长不足，无法转场")
	}
	filter := fmt.Sprintf("[0:v][1:v]xfade=transition=%s:duration=%.3f:offset=%.3f[v]", transition, duration, offset)
	return runFFmpeg([]string{
		"-y",
		"-i", src1,
		"-i", src2,
		"-filter_complex", filter,
		"-map", "[v]",
		"-c:v", "libx264",
		"-preset", "veryfast",
		"-threads", "2",
		"-pix_fmt", "yuv420p",
		dstPath,
	})
}

// TransitionVideoResult 给两个片段加转场，返回本地路径。
func TransitionVideoResult(names []string, transition string, duration float64) (string, error) {
	if len(names) != 2 {
		return "", fmt.Errorf("转场需要两个片段")
	}
	if strings.TrimSpace(transition) == "" {
		transition = "fade"
	}
	paths := make([]string, 0, 2)
	for _, n := range names {
		p, ok := MediaFilePath(n)
		if !ok {
			return "", fmt.Errorf("非法片段名: %s", n)
		}
		if _, err := os.Stat(p); err != nil {
			return "", fmt.Errorf("片段不存在: %s", n)
		}
		paths = append(paths, p)
	}
	if err := os.MkdirAll(videoCacheDir, 0o755); err != nil {
		return "", err
	}
	dstPath := filepath.Join(videoCacheDir, "transition-"+newID("transition")+".mp4")
	if err := TransitionVideos(paths[0], paths[1], transition, duration, dstPath); err != nil {
		os.Remove(dstPath)
		return "", err
	}
	return dstPath, nil
}

// MediaFilePath 返回 data/videos 下某个剪辑/拼接/转场产物的本地路径（防路径穿越）。
func MediaFilePath(name string) (string, bool) {
	base := filepath.Base(name)
	if filepath.Ext(base) != ".mp4" {
		return "", false
	}
	stem := strings.TrimSuffix(base, ".mp4")
	for _, prefix := range []string{"clip-", "concat-", "transition-"} {
		if strings.HasPrefix(stem, prefix) {
			return filepath.Join(videoCacheDir, base), true
		}
	}
	return "", false
}
