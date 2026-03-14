package observability

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"log/slog"
	"net"
	"net/http"
	"strings"
	"time"
)

type contextKey string

const requestIDContextKey contextKey = "request-id"

type Middleware struct {
	logger        *slog.Logger
	metrics       *Registry
	slowThreshold time.Duration
}

func NewMiddleware(logger *slog.Logger, metrics *Registry, slowThreshold time.Duration) *Middleware {
	if logger == nil {
		logger = slog.Default()
	}

	return &Middleware{
		logger:        logger,
		metrics:       metrics,
		slowThreshold: slowThreshold,
	}
}

func (m *Middleware) Wrap(route string, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		startedAt := time.Now()
		requestID := incomingOrGeneratedRequestID(r.Header.Get("X-Request-ID"))

		recorder := &statusRecorder{
			ResponseWriter: w,
			statusCode:     http.StatusOK,
		}
		recorder.Header().Set("X-Request-ID", requestID)

		ctx := context.WithValue(r.Context(), requestIDContextKey, requestID)
		next.ServeHTTP(recorder, r.WithContext(ctx))

		duration := time.Since(startedAt)
		if m.metrics != nil {
			m.metrics.ObserveHTTPRequest(route, r.Method, recorder.statusCode, duration)
		}

		attrs := []any{
			"request_id", requestID,
			"route", route,
			"method", r.Method,
			"path", r.URL.Path,
			"query", r.URL.RawQuery,
			"status", recorder.statusCode,
			"duration_ms", duration.Milliseconds(),
			"bytes", recorder.bytesWritten,
			"remote_addr", remoteIP(r.RemoteAddr),
			"user_agent", strings.TrimSpace(r.UserAgent()),
		}
		if cacheStatus := strings.TrimSpace(recorder.Header().Get("X-Cache")); cacheStatus != "" {
			attrs = append(attrs, "cache", cacheStatus)
		}

		level := slog.LevelInfo
		message := "http_request"
		if m.slowThreshold > 0 && duration >= m.slowThreshold {
			level = slog.LevelWarn
			message = "slow_request"
		}
		m.logger.Log(ctx, level, message, attrs...)
	})
}

func RequestIDFromContext(ctx context.Context) string {
	requestID, _ := ctx.Value(requestIDContextKey).(string)
	return requestID
}

type statusRecorder struct {
	http.ResponseWriter
	statusCode   int
	bytesWritten int
}

func (r *statusRecorder) WriteHeader(statusCode int) {
	r.statusCode = statusCode
	r.ResponseWriter.WriteHeader(statusCode)
}

func (r *statusRecorder) Write(payload []byte) (int, error) {
	written, err := r.ResponseWriter.Write(payload)
	r.bytesWritten += written
	return written, err
}

func incomingOrGeneratedRequestID(headerValue string) string {
	headerValue = strings.TrimSpace(headerValue)
	if headerValue != "" {
		return headerValue
	}

	buffer := make([]byte, 12)
	if _, err := rand.Read(buffer); err == nil {
		return hex.EncodeToString(buffer)
	}
	return hex.EncodeToString([]byte(time.Now().UTC().Format("150405.000000000")))
}

func remoteIP(remoteAddr string) string {
	host, _, err := net.SplitHostPort(remoteAddr)
	if err != nil {
		return remoteAddr
	}
	return host
}
