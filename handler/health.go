package handler

import (
	"net/http"
	"os"
	"strings"

	"github.com/tigerowo/infinite-canvas/config"
	"github.com/tigerowo/infinite-canvas/repository"
)

func Healthz(w http.ResponseWriter, r *http.Request) {
	db, err := repository.DB()
	dbOK := err == nil
	if dbOK {
		sqlDB, _ := db.DB()
		dbOK = sqlDB.Ping() == nil
	}
	version, _ := os.ReadFile("VERSION")
	OK(w, map[string]any{
		"db":      dbOK,
		"version": strings.TrimSpace(string(version)),
		"storage": config.Cfg.StorageDriver,
	})
}
