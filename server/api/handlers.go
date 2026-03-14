package api

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"net/http"
	"sort"
	"strings"
	"time"

	"github.com/xmu-csnoob/openclaw-ghost-shift/server/models"
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

func NewHandler(gc DataSource, cfg Config) (*Handler, error) {
	history, err := NewPublicHistoryRecorder(cfg)
	if err != nil {
		return nil, err
	}

	return &Handler{
		gc:           gc,
		publicIDSalt: cfg.PublicIDSalt,
		history:      history,
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

	writeJSON(w, http.StatusOK, h.publicSessions())
}

func (h *Handler) PublicStatus(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	writeJSON(w, http.StatusOK, h.publicStatus())
}

func (h *Handler) PublicSnapshot(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	writeJSON(w, http.StatusOK, h.buildPublicSnapshot())
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

	writeJSON(w, http.StatusOK, h.history.Timeline(since, until))
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

	writeJSON(w, http.StatusOK, h.history.Replay(since, until))
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
	now := time.Now().UTC()

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
		LastUpdatedAt: time.Now().UTC().Format(time.RFC3339),
	}
}

func writeJSON(w http.ResponseWriter, statusCode int, payload any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(statusCode)
	_ = json.NewEncoder(w).Encode(payload)
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
