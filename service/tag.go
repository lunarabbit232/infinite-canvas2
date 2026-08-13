package service

import (
	"github.com/tigerowo/infinite-canvas/model"
	"github.com/tigerowo/infinite-canvas/repository"
)

// ListTagTree 获取标签树。
func ListTagTree() ([]model.TagTree, error) {
	return repository.ListTagTree()
}
