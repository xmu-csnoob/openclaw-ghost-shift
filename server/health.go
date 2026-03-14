package main

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"github.com/xmu-csnoob/openclaw-ghost-shift/server/api"
	"github.com/xmu-csnoob/openclaw-ghost-shift/server/cache"
	"github.com/xmu-csnoob/openclaw-ghost-shift/server/observability"
)

type healthHandler struct {
	cache       *cache.Manager
	source      api.DataSource
	staticReady bool
	fixtureMode bool
	version     string
}

type healthResponse struct {
	Status            string                    `json:"status"`
	Ready             bool                      `json:"ready"`
	RequestID         string                    `json:"requestId"`
	Timestamp         string                    `json:"timestamp"`
	Version           string                    `json:"version"`
	Gateway           gatewayHealthSummary      `json:"gateway"`
	Cache             cache.HealthReport        `json:"cache"`
	StaticAssetsReady bool                      `json:"staticAssetsReady"`
}

type gatewayHealthSummary struct {
	Connected bool   `json:"connected"`
	Status    string `json:"status"`
	Error     string `json:"error,omitempty"`
}

func newHealthHandler(source api.DataSource, cacheManager *cache.Manager, staticReady, fixtureMode bool, version string) *healthHandler {
	return &healthHandler{
		cache:       cacheManager,
		source:      source,
		staticReady: staticReady,
		fixtureMode: fixtureMode,
		version:     version,
	}
}

func (h *healthHandler) Liveness(w http.ResponseWriter, r *http.Request) {
	payload := h.buildResponse(r.Context(), false)
	writeJSONResponse(w, http.StatusOK, payload)
}

func (h *healthHandler) Readiness(w http.ResponseWriter, r *http.Request) {
	payload := h.buildResponse(r.Context(), true)
	statusCode := http.StatusOK
	if !payload.Ready {
		statusCode = http.StatusServiceUnavailable
	}
	writeJSONResponse(w, statusCode, payload)
}

func (h *healthHandler) buildResponse(ctx context.Context, readiness bool) healthResponse {
	gatewayStatus := h.source.GetStatus()
	cacheHealth := cache.HealthReport{Status: "ok", Backends: []cache.HealthStatus{}}
	if h.cache != nil {
		cacheHealth = h.cache.Health(ctx)
	}

	gatewayReady := gatewayStatus.Connected || h.fixtureMode
	cacheReady := cacheHealth.Status == "ok"
	ready := !readiness || (gatewayReady && cacheReady)

	status := "ok"
	if !ready {
		status = "degraded"
	}

	return healthResponse{
		Status:    status,
		Ready:     ready,
		RequestID: observability.RequestIDFromContext(ctx),
		Timestamp: time.Now().UTC().Format(time.RFC3339),
		Version:   h.version,
		Gateway: gatewayHealthSummary{
			Connected: gatewayStatus.Connected,
			Status:    gatewayStatus.Status,
			Error:     gatewayStatus.Error,
		},
		Cache:             cacheHealth,
		StaticAssetsReady: h.staticReady,
	}
}

func writeJSONResponse(w http.ResponseWriter, statusCode int, payload any) {
	body, err := json.Marshal(payload)
	if err != nil {
		http.Error(w, "failed to encode response", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(statusCode)
	_, _ = w.Write(append(body, '\n'))
}
