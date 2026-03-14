package api

import (
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"
)

const (
	defaultPublicHistoryFileName    = "public-history.jsonl"
	defaultPublicHistoryHours       = 24
	defaultPublicHistoryIntervalSec = 30
)

type Config struct {
	PublicIDSalt           string
	PublicHistoryPath      string
	PublicHistoryHours     int
	PublicHistoryInterval  time.Duration
	PublicHistoryRetention time.Duration
}

func LoadConfigFromEnv() (Config, error) {
	hours, err := positiveEnvInt("PUBLIC_HISTORY_RETENTION_HOURS", defaultPublicHistoryHours)
	if err != nil {
		return Config{}, err
	}

	intervalSeconds, err := positiveEnvInt("PUBLIC_HISTORY_INTERVAL_SECONDS", defaultPublicHistoryIntervalSec)
	if err != nil {
		return Config{}, err
	}

	salt := strings.TrimSpace(os.Getenv("PUBLIC_ID_SALT"))
	if salt == "" {
		return Config{}, fmt.Errorf("PUBLIC_ID_SALT is required")
	}

	historyPath := strings.TrimSpace(os.Getenv("PUBLIC_HISTORY_PATH"))
	if historyPath == "" {
		historyPath = defaultPublicHistoryFileName
	}
	historyPath = filepath.Clean(historyPath)

	return Config{
		PublicIDSalt:           salt,
		PublicHistoryPath:      historyPath,
		PublicHistoryHours:     hours,
		PublicHistoryInterval:  time.Duration(intervalSeconds) * time.Second,
		PublicHistoryRetention: time.Duration(hours) * time.Hour,
	}, nil
}

func positiveEnvInt(name string, fallback int) (int, error) {
	raw := strings.TrimSpace(os.Getenv(name))
	if raw == "" {
		return fallback, nil
	}

	value, err := strconv.Atoi(raw)
	if err != nil || value <= 0 {
		return 0, fmt.Errorf("%s must be a positive integer", name)
	}
	return value, nil
}
