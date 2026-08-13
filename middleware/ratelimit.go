package middleware

import (
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/tigerowo/infinite-canvas/handler"
)

type rateWindow struct {
	count   int
	resetAt time.Time
}

type rateLimiter struct {
	mu          sync.Mutex
	limit       int
	window      time.Duration
	windows     map[string]*rateWindow
	lastCleanup time.Time
}

func newRateLimiter(limit int, window time.Duration) *rateLimiter {
	return &rateLimiter{limit: limit, window: window, windows: make(map[string]*rateWindow)}
}

func (r *rateLimiter) allow(key string) bool {
	now := time.Now()
	r.mu.Lock()
	defer r.mu.Unlock()

	if now.Sub(r.lastCleanup) > r.window {
		for k, w := range r.windows {
			if now.After(w.resetAt) {
				delete(r.windows, k)
			}
		}
		r.lastCleanup = now
	}

	w, ok := r.windows[key]
	if !ok || now.After(w.resetAt) {
		r.windows[key] = &rateWindow{count: 1, resetAt: now.Add(r.window)}
		return true
	}
	if w.count >= r.limit {
		return false
	}
	w.count++
	return true
}

// RateLimit 返回一个按客户端 IP 计数的固定窗口限流中间件。
func RateLimit(limit int, window time.Duration) gin.HandlerFunc {
	rl := newRateLimiter(limit, window)
	return func(c *gin.Context) {
		if !rl.allow(c.ClientIP()) {
			handler.FailWithStatus(c.Writer, http.StatusTooManyRequests, "请求过于频繁，请稍后再试")
			c.Abort()
			return
		}
		c.Next()
	}
}
