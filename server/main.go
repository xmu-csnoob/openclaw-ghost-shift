package main

import (
	"context"
	"crypto/subtle"
	"errors"
	"fmt"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/xmu-csnoob/openclaw-ghost-shift/server/api"
	"github.com/xmu-csnoob/openclaw-ghost-shift/server/cache"
	"github.com/xmu-csnoob/openclaw-ghost-shift/server/gateway"
	"github.com/xmu-csnoob/openclaw-ghost-shift/server/observability"
)

func main() {
	cfg, err := api.LoadConfigFromEnv()
	if err != nil {
		observability.NewLogger(strings.TrimSpace(os.Getenv("LOG_LEVEL"))).Error("failed_to_load_config", "error", err.Error())
		os.Exit(1)
	}
	logger := observability.NewLogger(cfg.LogLevel)
	metricsRegistry := observability.NewRegistry()
	cacheManager := cache.NewManager(cfg.RedisURL, cfg.CacheMemoryMaxEntries, logger)

	port := strings.TrimSpace(os.Getenv("PORT"))
	if port == "" {
		port = "3002"
	}

	bindAddr := strings.TrimSpace(os.Getenv("BIND_ADDR"))
	if bindAddr == "" {
		bindAddr = "127.0.0.1"
	}

	source, startBackground, fixtureMode, err := newDataSource()
	if err != nil {
		logger.Error("failed_to_create_data_source", "error", err.Error())
		os.Exit(1)
	}
	if startBackground != nil {
		go startBackground()
	}

	h, err := api.NewHandler(source, cfg, api.Dependencies{
		Cache:   cacheManager,
		Metrics: metricsRegistry,
		Logger:  logger,
	})
	if err != nil {
		logger.Error("failed_to_create_handler", "error", err.Error())
		os.Exit(1)
	}
	h.StartBackground(context.Background())
	if cfg.CacheWarmOnStartup {
		go func() {
			if err := h.WarmCache(context.Background()); err != nil {
				logger.Warn("cache_warm_failed", "error", err.Error())
				return
			}
			logger.Info("cache_warmed")
		}()
	}

	mux := http.NewServeMux()
	obs := observability.NewMiddleware(logger, metricsRegistry, cfg.SlowRequestThreshold)

	version := strings.TrimSpace(os.Getenv("GHOST_SHIFT_VERSION"))
	if version == "" {
		version = "0.1.0"
	}

	staticDir, staticReady := resolveStaticDir()
	health := newHealthHandler(source, cacheManager, staticReady, fixtureMode, version)

	handle := func(path, route string, next http.Handler) {
		mux.Handle(path, obs.Wrap(route, next))
	}

	handle("/metrics", "metrics", metricsRegistry.Handler(func() observability.MetricsSnapshot {
		return observability.MetricsSnapshot{
			AppVersion:       version,
			GatewayConnected: source.GetStatus().Connected,
			CacheEntries:     cacheManager.Stats(context.Background()).Entries,
		}
	}))
	handle("/healthz", "healthz", http.HandlerFunc(health.Liveness))
	handle("/readyz", "readyz", http.HandlerFunc(health.Readiness))
	handle("/openapi.yaml", "openapi", http.HandlerFunc(h.OpenAPI))

	handle("/api/sessions", "api_sessions", http.HandlerFunc(h.PublicSessions))
	handle("/api/status", "api_status", http.HandlerFunc(h.PublicStatus))
	handle("/api/public/snapshot", "api_public_snapshot", http.HandlerFunc(h.PublicSnapshot))
	handle("/api/public/timeline", "api_public_timeline", http.HandlerFunc(h.PublicTimeline))
	handle("/api/public/replay", "api_public_replay", http.HandlerFunc(h.PublicReplay))
	handle("/api/public/agent/", "api_public_agent_stats", http.HandlerFunc(h.PublicAgentStats))
	handle("/api/public/zones/heatmap", "api_public_zones_heatmap", http.HandlerFunc(h.PublicZonesHeatmap))
	handle("/api/public/models/distribution", "api_public_models_distribution", http.HandlerFunc(h.PublicModelsDistribution))
	handle("/api/public/metrics/live", "api_public_metrics_live", http.HandlerFunc(h.PublicMetricsLive))

	if enableInternalAPI() {
		internalToken, err := loadInternalAPIToken()
		if err != nil {
			logger.Error("failed_to_load_internal_api_token", "error", err.Error())
			os.Exit(1)
		}

		internalMux := http.NewServeMux()
		internalMux.Handle("/health", obs.Wrap("internal_health", http.HandlerFunc(h.InternalHealth)))
		internalMux.Handle("/presence", obs.Wrap("internal_presence", http.HandlerFunc(h.InternalPresence)))
		internalMux.Handle("/channels", obs.Wrap("internal_channels", http.HandlerFunc(h.InternalChannels)))
		internalMux.Handle("/nodes", obs.Wrap("internal_nodes", http.HandlerFunc(h.InternalNodes)))
		internalMux.Handle("/cron", obs.Wrap("internal_cron", http.HandlerFunc(h.InternalCron)))

		mux.Handle("/internal-api/", http.StripPrefix("/internal-api", requireInternalToken(internalToken, internalMux)))
		logger.Info("internal_api_enabled")
	}

	if staticReady {
		logger.Info("serving_static_frontend", "path", staticDir)
		mux.Handle("/", spaHandler(staticDir))
	} else {
		logger.Warn("static_frontend_not_found")
	}

	addr := net.JoinHostPort(bindAddr, port)
	logger.Info("ghost_shift_server_starting", "addr", addr)
	if err := http.ListenAndServe(addr, securityHeaders(mux)); err != nil {
		logger.Error("server_stopped", "error", err.Error())
		os.Exit(1)
	}
}

func enableInternalAPI() bool {
	value := strings.TrimSpace(strings.ToLower(os.Getenv("ENABLE_INTERNAL_API")))
	return value == "1" || value == "true" || value == "yes"
}

func loadInternalAPIToken() (string, error) {
	token := strings.TrimSpace(os.Getenv("INTERNAL_API_TOKEN"))
	if token == "" {
		return "", errors.New("ENABLE_INTERNAL_API requires INTERNAL_API_TOKEN")
	}
	return token, nil
}

func resolveStaticDir() (string, bool) {
	if explicit := strings.TrimSpace(os.Getenv("STATIC_DIR")); explicit != "" {
		if dirExists(explicit) {
			return explicit, true
		}
		return "", false
	}

	if cwd, err := os.Getwd(); err == nil {
		candidates := []string{
			filepath.Join(cwd, "dist"),
			filepath.Join(cwd, "..", "dist"),
		}
		for _, candidate := range candidates {
			if dirExists(candidate) {
				return candidate, true
			}
		}
	}

	execPath, err := os.Executable()
	if err != nil {
		return "", false
	}
	for _, candidate := range []string{
		filepath.Join(filepath.Dir(execPath), "..", "dist"),
		filepath.Join(filepath.Dir(execPath), "dist"),
	} {
		if dirExists(candidate) {
			return candidate, true
		}
	}
	return "", false
}

func dirExists(path string) bool {
	info, err := os.Stat(path)
	return err == nil && info.IsDir()
}

func spaHandler(staticDir string) http.Handler {
	fileServer := http.FileServer(http.Dir(staticDir))
	indexFile := filepath.Join(staticDir, "index.html")

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasPrefix(r.URL.Path, "/api/") || strings.HasPrefix(r.URL.Path, "/internal-api/") {
			http.NotFound(w, r)
			return
		}

		cleanPath := filepath.Clean(strings.TrimPrefix(r.URL.Path, "/"))
		if cleanPath == "." || cleanPath == "" {
			http.ServeFile(w, r, indexFile)
			return
		}

		target := filepath.Join(staticDir, cleanPath)
		if info, err := os.Stat(target); err == nil && !info.IsDir() {
			fileServer.ServeHTTP(w, r)
			return
		}

		http.ServeFile(w, r, indexFile)
	})
}

func securityHeaders(next http.Handler) http.Handler {
	frameAncestors := frameAncestorsDirective()
	contentSecurityPolicy := fmt.Sprintf(
		"default-src 'self'; base-uri 'none'; object-src 'none'; frame-ancestors %s; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self'",
		frameAncestors,
	)

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		if frameAncestors == "'none'" {
			w.Header().Set("X-Frame-Options", "DENY")
		}
		w.Header().Set("Cross-Origin-Opener-Policy", "same-origin")
		w.Header().Set("Cross-Origin-Resource-Policy", "same-origin")
		w.Header().Set("Referrer-Policy", "no-referrer")
		w.Header().Set("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
		w.Header().Set("Content-Security-Policy", contentSecurityPolicy)
		next.ServeHTTP(w, r)
	})
}

func newDataSource() (api.DataSource, func(), bool, error) {
	fixturePath := strings.TrimSpace(os.Getenv("GHOST_SHIFT_FIXTURE_PATH"))
	if fixturePath != "" {
		fixtureClient, err := gateway.NewFixtureClientFromFile(fixturePath)
		if err != nil {
			return nil, nil, false, err
		}
		return fixtureClient, nil, true, nil
	}

	client := gateway.NewClient()
	return client, client.Connect, false, nil
}

func frameAncestorsDirective() string {
	raw := strings.TrimSpace(os.Getenv("GHOST_SHIFT_EMBED_ALLOWED_ORIGINS"))
	if raw == "" {
		return "'none'"
	}

	parts := make([]string, 0, 4)
	for _, value := range strings.Split(raw, ",") {
		candidate := strings.TrimSpace(value)
		if candidate == "" {
			continue
		}
		if strings.EqualFold(candidate, "self") || candidate == "'self'" {
			parts = append(parts, "'self'")
			continue
		}
		parts = append(parts, candidate)
	}
	if len(parts) == 0 {
		return "'none'"
	}
	return strings.Join(parts, " ")
}

func requireInternalToken(token string, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		candidate := strings.TrimSpace(strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer "))
		if candidate == "" {
			candidate = strings.TrimSpace(r.Header.Get("X-Internal-API-Token"))
		}
		if subtle.ConstantTimeCompare([]byte(candidate), []byte(token)) != 1 {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		next.ServeHTTP(w, r)
	})
}
