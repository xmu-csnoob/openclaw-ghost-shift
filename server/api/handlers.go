package api

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"math"
	"net/http"
	"sort"
	"strings"
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
}

type PublicSnapshot struct {
	Status   PublicStatus    `json:"status"`
	Sessions []PublicSession `json:"sessions"`
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
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	payload, cacheStatus, err := cachedCompute(r.Context(), h, "api_sessions", "public:sessions", h.cacheTTL, func() ([]PublicSession, error) {
		return h.publicSessions(), nil
	})
	if err != nil {
		http.Error(w, "failed to build sessions", http.StatusInternalServerError)
		return
	}

	w.Header().Set("X-Cache", cacheStatus)
	writeJSON(w, http.StatusOK, payload)
}

func (h *Handler) PublicStatus(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	payload, cacheStatus, err := cachedCompute(r.Context(), h, "api_status", "public:status", h.cacheTTL, func() (PublicStatus, error) {
		return h.publicStatus(), nil
	})
	if err != nil {
		http.Error(w, "failed to build status", http.StatusInternalServerError)
		return
	}

	w.Header().Set("X-Cache", cacheStatus)
	writeJSON(w, http.StatusOK, payload)
}

func (h *Handler) PublicSnapshot(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	payload, cacheStatus, err := cachedCompute(r.Context(), h, "api_public_snapshot", "public:snapshot", h.cacheTTL, func() (PublicSnapshot, error) {
		return h.buildPublicSnapshot(), nil
	})
	if err != nil {
		http.Error(w, "failed to build snapshot", http.StatusInternalServerError)
		return
	}

	w.Header().Set("X-Cache", cacheStatus)
	writeJSON(w, http.StatusOK, payload)
}

func (h *Handler) PublicTimeline(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	since, until, err := parseHistoryWindow(r)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	payload, cacheStatus, err := cachedCompute(r.Context(), h, "api_public_timeline", h.analyticsCacheKey("timeline", r.URL.Path, r.URL.RawQuery), h.cacheTTL, func() (PublicTimelineResponse, error) {
		if h.history == nil {
			return PublicTimelineResponse{}, nil
		}
		return h.history.Timeline(since, until), nil
	})
	if err != nil {
		http.Error(w, "failed to build timeline", http.StatusInternalServerError)
		return
	}

	w.Header().Set("X-Cache", cacheStatus)
	writeJSON(w, http.StatusOK, payload)
}

func (h *Handler) PublicReplay(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	since, until, err := parseHistoryWindow(r)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	payload, cacheStatus, err := cachedCompute(r.Context(), h, "api_public_replay", h.analyticsCacheKey("replay", r.URL.Path, r.URL.RawQuery), h.cacheTTL, func() (PublicReplayResponse, error) {
		if h.history == nil {
			return PublicReplayResponse{}, nil
		}
		return h.history.Replay(since, until), nil
	})
	if err != nil {
		http.Error(w, "failed to build replay", http.StatusInternalServerError)
		return
	}

	w.Header().Set("X-Cache", cacheStatus)
	writeJSON(w, http.StatusOK, payload)
}

func (h *Handler) InternalHealth(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	writeJSON(w, http.StatusOK, h.gc.GetHealth())
}

func (h *Handler) InternalPresence(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	writeJSON(w, http.StatusOK, h.gc.GetPresence())
}

func (h *Handler) InternalChannels(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	writeJSON(w, http.StatusOK, h.gc.GetChannels())
}

func (h *Handler) InternalNodes(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	writeJSON(w, http.StatusOK, h.gc.GetNodes())
}

func (h *Handler) InternalCron(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
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
		http.Error(w, "failed to encode response", http.StatusInternalServerError)
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
		build func() (any, error)
	}{
		{
			key:   "public:status",
			route: "api_status",
			build: func() (any, error) { return h.publicStatus(), nil },
		},
		{
			key:   "public:sessions",
			route: "api_sessions",
			build: func() (any, error) { return h.publicSessions(), nil },
		},
		{
			key:   "public:snapshot",
			route: "api_public_snapshot",
			build: func() (any, error) { return h.buildPublicSnapshot(), nil },
		},
		{
			key:   "public:timeline",
			route: "api_public_timeline",
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
			build: func() (any, error) { return h.computeZonesHeatmap(time.Time{}, time.Time{}), nil },
		},
		{
			key:   h.analyticsCacheKey("models-distribution", "/api/public/models/distribution", ""),
			route: "api_public_models_distribution",
			build: func() (any, error) { return h.computeModelsDistribution(time.Time{}, time.Time{}), nil },
		},
		{
			key:   "metrics-live",
			route: "api_public_metrics_live",
			build: func() (any, error) { return h.live.compute(h.publicSessions()), nil },
		},
	}

	for _, entry := range entries {
		payload, err := entry.build()
		if err != nil {
			return err
		}
		body, err := marshalJSON(payload)
		if err != nil {
			return err
		}

		storeName, err := h.cache.Set(ctx, entry.key, body, h.cacheTTL)
		if h.metrics != nil {
			if err != nil {
				h.metrics.ObserveCacheOperation(storeName, entry.route, "warm", "error")
			} else {
				h.metrics.ObserveCacheOperation(storeName, entry.route, "warm", "success")
			}
		}
		if err != nil {
			return err
		}
	}

	return nil
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
	return since, until, nil
}

func parseOptionalTimestamp(value string) (time.Time, error) {
	value = strings.TrimSpace(value)
	if value == "" {
		return time.Time{}, nil
	}
	return time.Parse(time.RFC3339, value)
}

func classifyZone(session models.Session) string {
	switch classifyRole(session) {
	case "coding-agent":
		return "code-studio"
	case "webchat":
		return "chat-lounge"
	default:
		return "ops-lab"
	}
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
