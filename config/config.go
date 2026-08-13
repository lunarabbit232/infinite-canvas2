package config

import (
	"github.com/tigerowo/infinite-canvas/logger"
	"crypto/rand"
	"encoding/base64"
	"log"
	"os"
	"path/filepath"
	"strings"

	"github.com/caarlos0/env/v11"
	"github.com/joho/godotenv"
)

type Config struct {
	Port                string `env:"PORT" envDefault:"8080"`
	AdminUsername       string `env:"ADMIN_USERNAME" envDefault:"admin"`
	AdminPassword       string `env:"ADMIN_PASSWORD" envDefault:"infinite-canvas"`
	JWTSecret           string `env:"JWT_SECRET"`
	JWTExpireHours      int    `env:"JWT_EXPIRE_HOURS" envDefault:"168"`
	StorageDriver       string `env:"STORAGE_DRIVER" envDefault:"sqlite"`
	DatabaseDSN         string `env:"DATABASE_DSN" envDefault:"data/infinite-canvas.db"`
	PublicBaseURL       string `env:"PUBLIC_BASE_URL"`
	LinuxDoAuthorizeURL string `env:"LINUX_DO_AUTHORIZE_URL" envDefault:"https://connect.linux.do/oauth2/authorize"`
	LinuxDoTokenURL     string `env:"LINUX_DO_TOKEN_URL" envDefault:"https://connect.linux.do/oauth2/token"`
	LinuxDoUserInfoURL  string `env:"LINUX_DO_USERINFO_URL" envDefault:"https://connect.linux.do/api/user"`
	AILogDir            string `env:"AI_LOG_DIR" envDefault:"data/logs/ai-calls"`
}

var Cfg Config

func Load() error {
	if err := godotenv.Load(); err != nil {
		log.Printf("dotenv load skipped: %v", err)
	}
	if err := env.Parse(&Cfg); err != nil {
		return err
	}
	normalizeDockerSQLiteDSN("/app/data")
	if err := ensureJWTSecret(); err != nil {
		return err
	}
	return nil
}

func ensureJWTSecret() error {
	if !isWeakSecret(Cfg.JWTSecret) {
		return nil
	}
	if secret, err := readPersistedSecret(); err == nil && secret != "" {
		Cfg.JWTSecret = secret
		return nil
	}
	secret, err := randomSecret()
	if err != nil {
		return err
	}
	Cfg.JWTSecret = secret
	if err := writePersistedSecret(secret); err != nil {
		logger.Errorf("persist jwt secret failed: %v", err)
	}
	return nil
}

func isWeakSecret(s string) bool {
	s = strings.TrimSpace(s)
	return s == "" || s == "infinite-canvas"
}

func persistedSecretPath() string {
	dsn := strings.TrimSpace(Cfg.DatabaseDSN)
	if i := strings.Index(dsn, "?"); i >= 0 {
		dsn = dsn[:i]
	}
	if dsn == "" || dsn == ":memory:" || strings.HasPrefix(dsn, "file:") {
		return filepath.Join("data", ".jwt-secret")
	}
	return filepath.Join(filepath.Dir(dsn), ".jwt-secret")
}

func readPersistedSecret() (string, error) {
	b, err := os.ReadFile(persistedSecretPath())
	if err != nil {
		return "", err
	}
	return strings.TrimSpace(string(b)), nil
}

func writePersistedSecret(secret string) error {
	p := persistedSecretPath()
	if err := os.MkdirAll(filepath.Dir(p), 0o700); err != nil {
		return err
	}
	return os.WriteFile(p, []byte(secret), 0o600)
}

func normalizeDockerSQLiteDSN(appDataDir string) {
	driver := strings.ToLower(strings.TrimSpace(Cfg.StorageDriver))
	if driver != "" && driver != "sqlite" {
		return
	}
	dsn := strings.TrimSpace(Cfg.DatabaseDSN)
	if dsn == "" || dsn == ":memory:" || strings.HasPrefix(dsn, "file:") {
		return
	}
	pathPart, suffix := dsn, ""
	if index := strings.Index(dsn, "?"); index >= 0 {
		pathPart = dsn[:index]
		suffix = dsn[index:]
	}
	if filepath.IsAbs(pathPart) {
		return
	}
	slashPath := filepath.ToSlash(pathPart)
	if slashPath != "data" && !strings.HasPrefix(slashPath, "data/") {
		return
	}
	if _, err := os.Stat(appDataDir); err != nil {
		return
	}
	Cfg.DatabaseDSN = filepath.Join(filepath.Dir(appDataDir), filepath.FromSlash(slashPath)) + suffix
}

func randomSecret() (string, error) {
	buf := make([]byte, 32)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(buf), nil
}
