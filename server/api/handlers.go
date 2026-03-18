package api

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"math"
	"net/http"
	"net/url"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	cachepkg "github.com/xmu-csnoob/openclaw-ghost-shift/server/cache"
	"github.com/xmu-csnoob/openclaw-ghost-shift/server/models"
	"github.com/xmu-csnoob/openclaw-ghost-shift/server/observability"
)

type DataSource interface {
	GetStatus() models.GatewayConnectionStatus
	GetSessions() []models.Session
	GetHealth() *models.HealthStatus
	GetPresence() []models.PresenceEntry
	GetChannels() []models.ChannelStatus
	GetNodes() []models.NodeInfo
	GetCronJobs() []models.CronJob
}

type Handler struct {
	gc           DataSource
	publicIDSalt string
	history      *PublicHistoryRecorder
	cache        *cachepkg.Manager
	live         *liveMetricsTracker
	now          func() time.Time
	metrics      *observability.Registry
	logger       *slog.Logger
	cacheTTL     time.Duration
}

type Dependencies struct {
	Cache   *cachepkg.Manager
	Metrics *observability.Registry
	Logger  *slog.Logger
}

type PublicSession struct {
	PublicID       string  `json:"publicId"`
	SessionKey     string  `json:"sessionKey,omitempty"`
	AgentID        string  `json:"agentId"`
	Status         string  `json:"status"`
	Model          string  `json:"model,omitempty"`
	Zone           string  `json:"zone"`
	Role           string  `json:"role"`
	Origin         string  `json:"origin"`
	ActivityScore  float64 `json:"activityScore,omitempty"`
	ActivityWindow string  `json:"activityWindow,omitempty"`
	Footprint      string  `json:"footprint,omitempty"`
	MessageCount   int     `json:"-"`
	InputTokens    int     `json:"-"`
	OutputTokens   int     `json:"-"`
	TotalTokens    int     `json:"-"`
}

type PublicStatus struct {
	Connected     bool   `json:"connected"`
	Status        string `json:"status"`
	Displayed     int    `json:"displayed"`
	Running       int    `json:"running"`
	LastUpdatedAt string `json:"lastUpdatedAt"`
	Filtered      int    `json:"filtered,omitempty"`
	Total         int    `json:"total,omitempty"`
}

type FilterInfo struct {
	Status         string `json:"status,omitempty"`
	MinActivity    string `json:"minActivity,omitempty"`
	IncludeZombie  bool   `json:"includeZombie,omitempty"`
}

type PublicSnapshot struct {
	Status   PublicStatus    `json:"status"`
	Sessions []PublicSession `json:"sessions"`
	Filter   *FilterInfo     `json:"filter,omitempty"`
}

func NewHandler(gc DataSource, cfg Config, deps Dependencies) (*Handler, error) {
	nowFn := func() time.Time { return time.Now().UTC() }

	history, err := NewPublicHistoryRecorder(cfg)
	if err != nil {
		return nil, err
	}
	history.now = nowFn
	if deps.Logger == nil {
		deps.Logger = slog.Default()
	}
	if deps.Cache == nil {
		deps.Cache = cachepkg.NewManager("", cfg.CacheMemoryMaxEntries, deps.Logger)
	}

	return &Handler{
		gc:           gc,
		publicIDSalt: cfg.PublicIDSalt,
		history:      history,
		cache:        deps.Cache,
		live:         newLiveMetricsTracker(nowFn),
		now:          nowFn,
		metrics:      deps.Metrics,
		logger:       deps.Logger,
		cacheTTL:     cfg.CacheTTL,
	}, nil
}

func (h *Handler) StartBackground(ctx context.Context) {
	if h.history == nil {
		return
	}
	go h.history.Start(ctx, h.buildPublicSnapshot)
}

func (h *Handler) PublicSessions(w http.ResponseWriter, r *http.Request) {
	const route = "api_sessions"
	if !h.requireMethod(w, r, route, http.MethodGet) {
		return
	}

	payload, cacheStatus, err := cachedCompute(r.Context(), h, route, "public:sessions", h.cacheTTL, func() ([]PublicSession, error) {
		return h.publicSessions(), nil
	})
	if err != nil {
		h.respondError(w, r, route, http.StatusInternalServerError, "sessions_build_failed", "failed to build sessions", err, nil)
		return
	}

	w.Header().Set("X-Cache", cacheStatus)
	writeJSON(w, http.StatusOK, payload)
}

func (h *Handler) PublicStatus(w http.ResponseWriter, r *http.Request) {
	const route = "api_status"
	if !h.requireMethod(w, r, route, http.MethodGet) {
		return
	}

	payload, cacheStatus, err := cachedCompute(r.Context(), h, route, "public:status", h.cacheTTL, func() (PublicStatus, error) {
		return h.publicStatus(), nil
	})
	if err != nil {
		h.respondError(w, r, route, http.StatusInternalServerError, "status_build_failed", "failed to build status", err, nil)
		return
	}

	w.Header().Set("X-Cache", cacheStatus)
	writeJSON(w, http.StatusOK, payload)
}

func (h *Handler) PublicSnapshot(w http.ResponseWriter, r *http.Request) {
	const route = "api_public_snapshot"
	if !h.requireMethod(w, r, route, http.MethodGet) {
		return
	}

	filter := parseFilterParams(r.URL.Query())

	var payload PublicSnapshot
	var cacheStatus string
	var err error

	if filter.Status == "" || filter.Status == "all" {
		payload, cacheStatus, err = cachedCompute(r.Context(), h, route, "public:snapshot", h.cacheTTL, func() (PublicSnapshot, error) {
			return h.buildPublicSnapshot(), nil
		})
	} else {
		cacheKey := fmt.Sprintf("public:snapshot:filter:%s", filter.Status)
		payload, cacheStatus, err = cachedCompute(r.Context(), h, route, cacheKey, h.cacheTTL, func() (PublicSnapshot, error) {
			snapshot := h.buildPublicSnapshot()
			return applyFilter(snapshot, filter), nil
		})
	}

	if err != nil {
		h.respondError(w, r, route, http.StatusInternalServerError, "snapshot_build_failed", "failed to build snapshot", err, nil)
		return
	}

	w.Header().Set("X-Cache", cacheStatus)
	writeJSON(w, http.StatusOK, payload)
}

func (h *Handler) PublicTimeline(w http.ResponseWriter, r *http.Request) {
	const route = "api_public_timeline"
	if !h.requireMethod(w, r, route, http.MethodGet) {
		return
	}

	since, until, err := parseHistoryWindow(r)
	if err != nil {
		h.respondError(w, r, route, http.StatusBadRequest, "invalid_query", err.Error(), err, ErrorDetail{
			"query": r.URL.RawQuery,
		})
		return
	}

	payload, cacheStatus, err := cachedCompute(r.Context(), h, route, h.analyticsCacheKey("timeline", r.URL.Path, r.URL.RawQuery), h.analyticsTTL(since, until), func() (PublicTimelineResponse, error) {
		if h.history == nil {
			return PublicTimelineResponse{}, nil
		}
		return h.history.Timeline(since, until), nil
	})
	if err != nil {
		h.respondError(w, r, route, http.StatusInternalServerError, "timeline_build_failed", "failed to build timeline", err, ErrorDetail{
			"since": since.Format(time.RFC3339),
			"until": until.Format(time.RFC3339),
		})
		return
	}

	w.Header().Set("X-Cache", cacheStatus)
	writeJSON(w, http.StatusOK, payload)
}

func (h *Handler) PublicReplay(w http.ResponseWriter, r *http.Request) {
	const route = "api_public_replay"
	if !h.requireMethod(w, r, route, http.MethodGet) {
		return
	}

	since, until, err := parseHistoryWindow(r)
	if err != nil {
		h.respondError(w, r, route, http.StatusBadRequest, "invalid_query", err.Error(), err, ErrorDetail{
			"query": r.URL.RawQuery,
		})
		return
	}

	payload, cacheStatus, err := cachedCompute(r.Context(), h, route, h.analyticsCacheKey("replay", r.URL.Path, r.URL.RawQuery), h.analyticsTTL(since, until), func() (PublicReplayResponse, error) {
		if h.history == nil {
			return PublicReplayResponse{}, nil
		}
		return h.history.Replay(since, until), nil
	})
	if err != nil {
		h.respondError(w, r, route, http.StatusInternalServerError, "replay_build_failed", "failed to build replay", err, ErrorDetail{
			"since": since.Format(time.RFC3339),
			"until": until.Format(time.RFC3339),
		})
		return
	}

	w.Header().Set("X-Cache", cacheStatus)
	writeJSON(w, http.StatusOK, payload)
}

func (h *Handler) InternalHealth(w http.ResponseWriter, r *http.Request) {
	if !h.requireMethod(w, r, "internal_health", http.MethodGet) {
		return
	}
	writeJSON(w, http.StatusOK, h.gc.GetHealth())
}

func (h *Handler) InternalPresence(w http.ResponseWriter, r *http.Request) {
	if !h.requireMethod(w, r, "internal_presence", http.MethodGet) {
		return
	}
	writeJSON(w, http.StatusOK, h.gc.GetPresence())
}

func (h *Handler) InternalChannels(w http.ResponseWriter, r *http.Request) {
	if !h.requireMethod(w, r, "internal_channels", http.MethodGet) {
		return
	}
	writeJSON(w, http.StatusOK, h.gc.GetChannels())
}

func (h *Handler) InternalNodes(w http.ResponseWriter, r *http.Request) {
	if !h.requireMethod(w, r, "internal_nodes", http.MethodGet) {
		return
	}
	writeJSON(w, http.StatusOK, h.gc.GetNodes())
}

func (h *Handler) InternalCron(w http.ResponseWriter, r *http.Request) {
	if !h.requireMethod(w, r, "internal_cron", http.MethodGet) {
		return
	}
	writeJSON(w, http.StatusOK, h.gc.GetCronJobs())
}

func (h *Handler) buildPublicSnapshot() PublicSnapshot {
	sessions := h.publicSessions()
	return PublicSnapshot{
		Status:   h.publicStatusFromSessions(sessions),
		Sessions: sessions,
	}
}

func (h *Handler) publicStatus() PublicStatus {
	return h.publicStatusFromSessions(h.publicSessions())
}

func (h *Handler) publicSessions() []PublicSession {
	raw := h.gc.GetSessions()
	now := h.now()

	publicSessions := make([]PublicSession, 0, len(raw))
	for _, session := range raw {
		identity := derivePublicIdentity(session.SessionKey, h.publicIDSalt)
		activity := classifyActivity(session, now)

		publicSessions = append(publicSessions, PublicSession{
			PublicID:       identity.PublicID,
			SessionKey:     identity.PublicID,
			AgentID:        identity.AgentID,
			Status:         activity.Status,
			Model:          session.Model,
			Zone:           classifyZone(session),
			Role:           classifyRole(session),
			Origin:         classifyOrigin(session),
			ActivityScore:  activity.Score,
			ActivityWindow: activity.Window,
			Footprint:      activity.Footprint,
			MessageCount:   session.MessageCount,
			InputTokens:    session.InputTokens,
			OutputTokens:   session.OutputTokens,
			TotalTokens:    session.TotalTokens,
		})
	}

	sort.Slice(publicSessions, func(i, j int) bool {
		return publicSessions[i].AgentID < publicSessions[j].AgentID
	})
	return publicSessions
}

func (h *Handler) publicStatusFromSessions(sessions []PublicSession) PublicStatus {
	running := 0
	for _, session := range sessions {
		if session.Status == "running" {
			running++
		}
	}

	gwStatus := h.gc.GetStatus()
	return PublicStatus{
		Connected:     gwStatus.Connected,
		Status:        gwStatus.Status,
		Displayed:     len(sessions),
		Running:       running,
		LastUpdatedAt: h.now().Format(time.RFC3339),
	}
}

func writeJSON(w http.ResponseWriter, statusCode int, payload any) {
	body, err := marshalJSON(payload)
	if err != nil {
		WriteJSONError(w, nil, http.StatusInternalServerError, "encode_error", "failed to encode response", ErrorDetail{
			"status": statusCode,
		})
		return
	}

	writeJSONBytes(w, statusCode, body)
}

func marshalJSON(payload any) ([]byte, error) {
	body, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}
	return append(body, '\n'), nil
}

func writeJSONBytes(w http.ResponseWriter, statusCode int, payload []byte) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(statusCode)
	_, _ = w.Write(payload)
}

func (h *Handler) WarmCache(ctx context.Context) error {
	if h.cache == nil || h.cacheTTL <= 0 {
		return nil
	}

	entries := []struct {
		key   string
		route string
		ttl   time.Duration
		build func() (any, error)
	}{
		{
			key:   "public:status",
			route: "api_status",
			ttl:   h.cacheTTL,
			build: func() (any, error) { return h.publicStatus(), nil },
		},
		{
			key:   "public:sessions",
			route: "api_sessions",
			ttl:   h.cacheTTL,
			build: func() (any, error) { return h.publicSessions(), nil },
		},
		{
			key:   "public:snapshot",
			route: "api_public_snapshot",
			ttl:   h.cacheTTL,
			build: func() (any, error) { return h.buildPublicSnapshot(), nil },
		},
		{
			key:   "public:timeline",
			route: "api_public_timeline",
			ttl:   h.analyticsHotCacheTTL(),
			build: func() (any, error) {
				if h.history == nil {
					return PublicTimelineResponse{}, nil
				}
				return h.history.Timeline(time.Time{}, time.Time{}), nil
			},
		},
		{
			key:   "public:replay",
			route: "api_public_replay",
			ttl:   h.analyticsHotCacheTTL(),
			build: func() (any, error) {
				if h.history == nil {
					return PublicReplayResponse{}, nil
				}
				return h.history.Replay(time.Time{}, time.Time{}), nil
			},
		},
		{
			key:   h.analyticsCacheKey("zones-heatmap", "/api/public/zones/heatmap", ""),
			route: "api_public_zones_heatmap",
			ttl:   h.analyticsHotCacheTTL(),
			build: func() (any, error) { return h.computeZonesHeatmap(time.Time{}, time.Time{}), nil },
		},
		{
			key:   h.analyticsCacheKey("models-distribution", "/api/public/models/distribution", ""),
			route: "api_public_models_distribution",
			ttl:   h.analyticsHotCacheTTL(),
			build: func() (any, error) { return h.computeModelsDistribution(time.Time{}, time.Time{}), nil },
		},
		{
			key:   h.analyticsCacheKey("trends", "/api/public/analytics/trends", ""),
			route: "api_public_analytics_trends",
			ttl:   h.analyticsHotCacheTTL(),
			build: func() (any, error) {
				since, until := h.defaultTrendWindow()
				return h.computeTrend(since, until, defaultTrendWindowHours), nil
			},
		},
		{
			key:   h.analyticsCacheKey("compare", "/api/public/analytics/compare", ""),
			route: "api_public_analytics_compare",
			ttl:   h.analyticsHotCacheTTL(),
			build: func() (any, error) { return h.computeTodayVsYesterday(), nil },
		},
		{
			key:   "metrics-live",
			route: "api_public_metrics_live",
			ttl:   h.liveMetricsCacheTTL(),
			build: func() (any, error) { return h.live.compute(h.publicSessions()), nil },
		},
	}

	var (
		wg       sync.WaitGroup
		firstErr error
		errMu    sync.Mutex
	)

	for _, entry := range entries {
		entry := entry
		wg.Add(1)
		go func() {
			defer wg.Done()

			payload, err := entry.build()
			if err != nil {
				errMu.Lock()
				if firstErr == nil {
					firstErr = err
				}
				errMu.Unlock()
				return
			}
			body, err := marshalJSON(payload)
			if err != nil {
				errMu.Lock()
				if firstErr == nil {
					firstErr = err
				}
				errMu.Unlock()
				return
			}

			storeName, err := h.cache.Set(ctx, entry.key, body, entry.ttl)
			if h.metrics != nil {
				if err != nil {
					h.metrics.ObserveCacheOperation(storeName, entry.route, "warm", "error")
				} else {
					h.metrics.ObserveCacheOperation(storeName, entry.route, "warm", "success")
				}
			}
			if err != nil {
				errMu.Lock()
				if firstErr == nil {
					firstErr = err
				}
				errMu.Unlock()
			}
		}()
	}

	wg.Wait()
	return firstErr
}

func (h *Handler) recordCacheMetric(cacheName, route, operation, result string) {
	if h.metrics == nil {
		return
	}
	h.metrics.ObserveCacheOperation(cacheName, route, operation, result)
}

func parseHistoryWindow(r *http.Request) (time.Time, time.Time, error) {
	query := r.URL.Query()
	since, err := parseOptionalTimestamp(query.Get("since"))
	if err != nil {
		return time.Time{}, time.Time{}, fmt.Errorf("invalid since: %w", err)
	}
	until, err := parseOptionalTimestamp(query.Get("until"))
	if err != nil {
		return time.Time{}, time.Time{}, fmt.Errorf("invalid until: %w", err)
	}
	if !since.IsZero() && !until.IsZero() && until.Before(since) {
		return time.Time{}, time.Time{}, fmt.Errorf("invalid time window: until must be greater than or equal to since")
	}
	return since, until, nil
}

func parsePositiveQueryInt(name, value string, fallback, max int) (int, error) {
	value = strings.TrimSpace(value)
	if value == "" {
		return fallback, nil
	}

	parsed, err := strconv.Atoi(value)
	if err != nil || parsed <= 0 {
		return 0, fmt.Errorf("%s must be a positive integer", name)
	}
	if max > 0 && parsed > max {
		return 0, fmt.Errorf("%s must be less than or equal to %d", name, max)
	}
	return parsed, nil
}

func (h *Handler) analyticsHotCacheTTL() time.Duration {
	if h.cacheTTL <= 0 {
		return 0
	}
	return h.cacheTTL
}

func (h *Handler) analyticsColdCacheTTL() time.Duration {
	hotTTL := h.analyticsHotCacheTTL()
	if hotTTL <= 0 {
		return 0
	}

	coldTTL := hotTTL * 6
	if coldTTL < 15*time.Second {
		coldTTL = 15 * time.Second
	}
	return coldTTL
}

func (h *Handler) liveMetricsCacheTTL() time.Duration {
	if h.cacheTTL <= 0 {
		return 0
	}
	return h.cacheTTL
}

func (h *Handler) analyticsTTL(since, until time.Time) time.Duration {
	if h.cacheTTL <= 0 {
		return 0
	}

	now := h.now()
	if !until.IsZero() && until.Before(now.Add(-10*time.Minute)) {
		return h.analyticsColdCacheTTL()
	}
	if !since.IsZero() && !until.IsZero() && until.Sub(since) >= 6*time.Hour && until.Before(now.Add(-2*time.Minute)) {
		return h.analyticsColdCacheTTL()
	}
	return h.analyticsHotCacheTTL()
}

func parseOptionalTimestamp(value string) (time.Time, error) {
	value = strings.TrimSpace(value)
	if value == "" {
		return time.Time{}, nil
	}
	return time.Parse(time.RFC3339, value)
}

func parseFilterParams(q url.Values) FilterInfo {
	status := strings.ToLower(strings.TrimSpace(q.Get("status")))
	if status == "" {
		return FilterInfo{}
	}
	validStatuses := map[string]bool{
		"all": true, "live": true, "active": true, "warm": true,
		"visible": true, "running": true, "idle": true,
	}
	if !validStatuses[status] {
		return FilterInfo{}
	}
	return FilterInfo{
		Status:        status,
		MinActivity:   strings.TrimSpace(q.Get("minActivity")),
		IncludeZombie: q.Get("includeZombie") == "true",
	}
}

func applyFilter(snapshot PublicSnapshot, filter FilterInfo) PublicSnapshot {
	if filter.Status == "" || filter.Status == "all" {
		return snapshot
	}
	filtered := make([]PublicSession, 0, len(snapshot.Sessions))
	for _, s := range snapshot.Sessions {
		if matchFilter(s, filter) {
			filtered = append(filtered, s)
		}
	}
	total := len(snapshot.Sessions)
	snapshot.Sessions = filtered
	snapshot.Status.Displayed = len(filtered)
	snapshot.Status.Total = total
	snapshot.Status.Filtered = total - len(filtered)
	snapshot.Filter = &filter
	return snapshot
}

func matchFilter(s PublicSession, f FilterInfo) bool {
	liveWindows := map[string]bool{"just-now": true, "2m": true, "live": true}
	switch f.Status {
	case "live":
		return s.Status == "running" || liveWindows[s.ActivityWindow]
	case "active":
		return s.ActivityScore >= 0.7 || s.Status == "running"
	case "warm":
		return s.ActivityScore >= 0.38
	case "visible":
		return s.ActivityScore >= 0.18
	case "running":
		return s.Status == "running"
	case "idle":
		return s.Status == "idle"
	default:
		return true
	}
}

func classifyZone(session models.Session) string {
	return GetZoneManager().ClassifyZone(session.Tags, sessionSignals(session))
}

func classifyRole(session models.Session) string {
	text := sessionSignals(session)
	switch {
	case containsAny(text, "feishu", "discord", "slack", "telegram", "whatsapp", "wechat", "webchat", "inbox", "chat"):
		return "webchat"
	case containsAny(text, "agent:", "claude code", "claude-code", "workspace", "coder", "coding", "cli", "terminal"):
		return "coding-agent"
	case containsAny(text, "cron", "ops", "worker", "automation", "bot", "system", "daemon"):
		return "automation"
	default:
		return "automation"
	}
}

func classifyOrigin(session models.Session) string {
	text := sessionSignals(session)
	switch {
	case containsAny(text, "feishu"):
		return "Feishu"
	case containsAny(text, "discord"):
		return "Discord"
	case containsAny(text, "slack"):
		return "Slack"
	case containsAny(text, "telegram"):
		return "Telegram"
	case containsAny(text, "whatsapp"):
		return "WhatsApp"
	case containsAny(text, "wechat"):
		return "WeChat"
	case containsAny(text, "claude code", "claude-code"):
		return "Claude Code"
	case containsAny(text, "agent:", "workspace", "cli", "terminal"):
		return "Workspace CLI"
	case containsAny(text, "anthropic", "claude"):
		return "Anthropic"
	case containsAny(text, "openai", "gpt"):
		return "OpenAI"
	case containsAny(text, "gemini", "google"):
		return "Google AI"
	default:
		return "Local"
	}
}

func sessionSignals(session models.Session) string {
	return strings.ToLower(strings.Join([]string{
		session.SessionKey,
		session.Channel,
		session.Model,
		session.ModelProvider,
		session.DisplayName,
		session.Kind,
	}, " "))
}

func containsAny(text string, needles ...string) bool {
	for _, needle := range needles {
		if strings.Contains(text, needle) {
			return true
		}
	}
	return false
}

type publicActivity struct {
	Status    string
	Score     float64
	Window    string
	Footprint string
}

func classifyActivity(session models.Session, now time.Time) publicActivity {
	rawStatus := strings.ToLower(strings.TrimSpace(session.Status))
	anchor := latestSessionTime(session)
	age := 365 * 24 * time.Hour
	if !anchor.IsZero() {
		age = now.Sub(anchor)
		if age < 0 {
			age = 0
		}
	}

	score, window := scoreFromAge(age, anchor.IsZero())
	status := "idle"

	switch rawStatus {
	case "running", "waiting", "thinking", "active":
		status = "running"
		score = 1
		window = "live"
	case "error":
		status = "error"
		if score < 0.18 {
			score = 0.18
		}
	case "disconnected":
		status = "disconnected"
	case "connected":
		status = "connected"
	}

	if status == "idle" && age <= 90*time.Second {
		status = "running"
	}

	return publicActivity{
		Status:    status,
		Score:     math.Round(score*100) / 100,
		Window:    window,
		Footprint: classifyFootprint(session),
	}
}

func latestSessionTime(session models.Session) time.Time {
	candidates := []string{
		session.LastActiveAt,
		session.UpdatedAt,
		session.CreatedAt,
	}

	var latest time.Time
	for _, value := range candidates {
		if strings.TrimSpace(value) == "" {
			continue
		}
		if parsed, err := time.Parse(time.RFC3339, value); err == nil && parsed.After(latest) {
			latest = parsed
		}
	}

	return latest
}

func scoreFromAge(age time.Duration, missingAnchor bool) (float64, string) {
	if missingAnchor {
		return 0.1, "seen"
	}

	switch {
	case age <= 45*time.Second:
		return 0.96, "just-now"
	case age <= 2*time.Minute:
		return 0.86, "2m"
	case age <= 10*time.Minute:
		return 0.7, "10m"
	case age <= 30*time.Minute:
		return 0.54, "30m"
	case age <= 2*time.Hour:
		return 0.38, "2h"
	case age <= 8*time.Hour:
		return 0.26, "today"
	case age <= 24*time.Hour:
		return 0.18, "today"
	default:
		return 0.08, "archive"
	}
}

func classifyFootprint(session models.Session) string {
	totalTokens := session.TotalTokens
	if totalTokens == 0 {
		totalTokens = session.InputTokens + session.OutputTokens
	}

	switch {
	case totalTokens >= 100000 || session.MessageCount >= 80:
		return "deep-stack"
	case totalTokens >= 30000 || session.MessageCount >= 24:
		return "heavy-context"
	case totalTokens >= 8000 || session.MessageCount >= 8:
		return "working-set"
	default:
		return "fresh-thread"
	}
}
