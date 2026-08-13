package handler

import (
	"net/http"

	"github.com/tigerowo/infinite-canvas/service"
)

// TagTree 获取标签树。
func TagTree(w http.ResponseWriter, r *http.Request) {
	result, err := service.ListTagTree()
	if err != nil {
		FailError(w, err)
		return
	}
	OK(w, result)
}
