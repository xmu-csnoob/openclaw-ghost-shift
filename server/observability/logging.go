package observability

import (
	"log"
	"log/slog"
	"os"
	"strings"
)

func NewLogger(level string) *slog.Logger {
	handler := slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: parseLevel(level),
	})
	logger := slog.New(handler)

	stdLogger := slog.NewLogLogger(handler, slog.LevelInfo)
	log.SetFlags(0)
	log.SetOutput(stdLogger.Writer())
	slog.SetDefault(logger)

	return logger
}

func parseLevel(value string) slog.Level {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "debug":
		return slog.LevelDebug
	case "warn", "warning":
		return slog.LevelWarn
	case "error":
		return slog.LevelError
	default:
		return slog.LevelInfo
	}
}
