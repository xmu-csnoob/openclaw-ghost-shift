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
	defaultCacheTTLSeconds          = 5
	defaultCacheMemoryMaxEntries    = 512
	defaultSlowRequestThresholdMS   = 250
)

type Config struct {
	PublicIDSalt           string
	PublicHistoryPath      string
	PublicHistoryHours     int
	PublicHistoryInterval  time.Duration
	PublicHistoryRetention time.Duration
	RedisURL               string
	CacheTTL               time.Duration
	CacheMemoryMaxEntries  int
	CacheWarmOnStartup     bool
	LogLevel               string
	SlowRequestThreshold   time.Duration
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

	cacheTTLSeconds, err := positiveEnvInt("CACHE_TTL_SECONDS", defaultCacheTTLSeconds)
	if err != nil {
		return Config{}, err
	}

	cacheMemoryMaxEntries, err := positiveEnvInt("CACHE_MEMORY_MAX_ENTRIES", defaultCacheMemoryMaxEntries)
	if err != nil {
		return Config{}, err
	}

	slowRequestMS, err := positiveEnvInt("REQUEST_SLOW_THRESHOLD_MS", defaultSlowRequestThresholdMS)
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
		RedisURL:               strings.TrimSpace(os.Getenv("REDIS_URL")),
		CacheTTL:               time.Duration(cacheTTLSeconds) * time.Second,
		CacheMemoryMaxEntries:  cacheMemoryMaxEntries,
		CacheWarmOnStartup:     envBool("CACHE_WARM_ON_STARTUP"),
		LogLevel:               envOrDefault("LOG_LEVEL", "info"),
		SlowRequestThreshold:   time.Duration(slowRequestMS) * time.Millisecond,
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

func envBool(name string) bool {
	raw := strings.TrimSpace(strings.ToLower(os.Getenv(name)))
	return raw == "1" || raw == "true" || raw == "yes" || raw == "on"
}

func envOrDefault(name, fallback string) string {
	value := strings.TrimSpace(os.Getenv(name))
	if value == "" {
		return fallback
	}
	return value
}
