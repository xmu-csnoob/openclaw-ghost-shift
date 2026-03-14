package api

import (
	"log/slog"
	"net/http"
	"sort"

	"github.com/xmu-csnoob/openclaw-ghost-shift/server/observability"
)

type ErrorDetail map[string]any

type ErrorBody struct {
	Code    string      `json:"code"`
	Message string      `json:"message"`
	Details ErrorDetail `json:"details,omitempty"`
}

type ErrorResponse struct {
	Error     ErrorBody `json:"error"`
	RequestID string    `json:"requestId,omitempty"`
}

func WriteJSONError(w http.ResponseWriter, r *http.Request, statusCode int, code, message string, details ErrorDetail) {
	payload := ErrorResponse{
		Error: ErrorBody{
			Code:    code,
			Message: message,
		},
	}

	if len(details) > 0 {
		payload.Error.Details = details
	}
	if r != nil {
		payload.RequestID = observability.RequestIDFromContext(r.Context())
	}

	body, err := marshalJSON(payload)
	if err != nil {
		writeJSONBytes(w, http.StatusInternalServerError, []byte("{\"error\":{\"code\":\"internal_error\",\"message\":\"failed to encode error response\"}}\n"))
		return
	}

	writeJSONBytes(w, statusCode, body)
}

func (h *Handler) respondError(w http.ResponseWriter, r *http.Request, route string, statusCode int, code, message string, err error, details ErrorDetail) {
	logAttrs := []any{
		"route", route,
		"method", r.Method,
		"path", r.URL.Path,
		"query", r.URL.RawQuery,
		"status", statusCode,
		"code", code,
	}
	if requestID := observability.RequestIDFromContext(r.Context()); requestID != "" {
		logAttrs = append(logAttrs, "request_id", requestID)
	}
	if err != nil {
		logAttrs = append(logAttrs, "error", err.Error())
	}
	for _, attr := range detailAttrs(details) {
		logAttrs = append(logAttrs, attr...)
	}

	level := slog.LevelWarn
	if statusCode >= http.StatusInternalServerError {
		level = slog.LevelError
	}
	if h != nil && h.logger != nil {
		h.logger.Log(r.Context(), level, "api_error", logAttrs...)
	}

	WriteJSONError(w, r, statusCode, code, message, details)
}

func (h *Handler) requireMethod(w http.ResponseWriter, r *http.Request, route, method string) bool {
	if r.Method == method {
		return true
	}

	h.respondError(w, r, route, http.StatusMethodNotAllowed, "method_not_allowed", "method not allowed", nil, ErrorDetail{
		"allowed":  method,
		"received": r.Method,
	})
	return false
}

func detailAttrs(details ErrorDetail) [][]any {
	if len(details) == 0 {
		return nil
	}

	keys := make([]string, 0, len(details))
	for key := range details {
		keys = append(keys, key)
	}
	sort.Strings(keys)

	attrs := make([][]any, 0, len(keys))
	for _, key := range keys {
		attrs = append(attrs, []any{key, details[key]})
	}
	return attrs
}
