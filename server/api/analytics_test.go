package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"
	"time"

	"github.com/xmu-csnoob/openclaw-ghost-shift/server/models"
)

type fakeDataSource struct {
	status   models.GatewayConnectionStatus
	sessions []models.Session
}

func (f *fakeDataSource) GetStatus() models.GatewayConnectionStatus { return f.status }
func (f *fakeDataSource) GetSessions() []models.Session             { return f.sessions }
func (f *fakeDataSource) GetHealth() *models.HealthStatus           { return nil }
func (f *fakeDataSource) GetPresence() []models.PresenceEntry       { return nil }
func (f *fakeDataSource) GetChannels() []models.ChannelStatus       { return nil }
func (f *fakeDataSource) GetNodes() []models.NodeInfo               { return nil }
func (f *fakeDataSource) GetCronJobs() []models.CronJob             { return nil }

func TestPublicAnalyticsEndpoints(t *testing.T) {
	t.Parallel()

	handler, source, nowRef := newAnalyticsTestHandler(t)

	t0 := time.Date(2026, time.March, 14, 10, 0, 0, 0, time.UTC)
	t1 := t0.Add(30 * time.Second)
	t2 := t1.Add(30 * time.Second)

	recordSnapshot(t, handler, source, nowRef, t0, []models.Session{
		testCodingSession(2, 1000, t0),
	})
	recordSnapshot(t, handler, source, nowRef, t1, []models.Session{
		testCodingSession(4, 5000, t1),
		testChatSession(1, 1200, t1),
	})
	recordSnapshot(t, handler, source, nowRef, t2, []models.Session{
		testCodingSession(5, 9000, t2),
		testChatSession(3, 3200, t2),
	})

	codePublicID := derivePublicIdentity("agent:claude-code:main", "test-salt").PublicID

	statsReq := httptest.NewRequest(http.MethodGet, "/api/public/agent/"+codePublicID+"/stats", nil)
	statsRes := httptest.NewRecorder()
	handler.PublicAgentStats(statsRes, statsReq)

	if statsRes.Code != http.StatusOK {
		t.Fatalf("PublicAgentStats status = %d, want 200", statsRes.Code)
	}

	var stats PublicAgentStatsResponse
	if err := json.Unmarshal(statsRes.Body.Bytes(), &stats); err != nil {
		t.Fatalf("json.Unmarshal(agent stats) error = %v", err)
	}
	if stats.WorkTimeSeconds != 60 {
		t.Fatalf("WorkTimeSeconds = %d, want 60", stats.WorkTimeSeconds)
	}
	if stats.ToolCallCount != 3 {
		t.Fatalf("ToolCallCount = %d, want 3", stats.ToolCallCount)
	}
	if stats.AvgResponseTime != 30000 {
		t.Fatalf("AvgResponseTime = %v, want 30000", stats.AvgResponseTime)
	}
	if stats.MessageCount != 5 {
		t.Fatalf("MessageCount = %d, want 5", stats.MessageCount)
	}
	if len(stats.ActivePeriods) != 1 || stats.ActivePeriods[0].Label != "08:00-11:59 UTC" {
		t.Fatalf("ActivePeriods = %#v", stats.ActivePeriods)
	}

	heatmapReq := httptest.NewRequest(http.MethodGet, "/api/public/zones/heatmap", nil)
	heatmapRes := httptest.NewRecorder()
	handler.PublicZonesHeatmap(heatmapRes, heatmapReq)

	if heatmapRes.Code != http.StatusOK {
		t.Fatalf("PublicZonesHeatmap status = %d, want 200", heatmapRes.Code)
	}

	var heatmap PublicZonesHeatmapResponse
	if err := json.Unmarshal(heatmapRes.Body.Bytes(), &heatmap); err != nil {
		t.Fatalf("json.Unmarshal(heatmap) error = %v", err)
	}
	if len(heatmap.Zones) != 2 {
		t.Fatalf("len(heatmap.Zones) = %d, want 2", len(heatmap.Zones))
	}
	zones := mapZones(heatmap.Zones)
	if zones["code-studio"].AgentCount != 1 || zones["chat-lounge"].AgentCount != 1 {
		t.Fatalf("unexpected heatmap agent counts: %#v", zones)
	}
	if zones["code-studio"].ActivityScore != 1 || zones["chat-lounge"].ActivityScore != 1 {
		t.Fatalf("unexpected heatmap activity scores: %#v", zones)
	}
	if len(zones["code-studio"].StatusDistribution) != 1 || zones["code-studio"].StatusDistribution[0].Status != "running" {
		t.Fatalf("unexpected code-studio status distribution: %#v", zones["code-studio"].StatusDistribution)
	}

	modelsReq := httptest.NewRequest(http.MethodGet, "/api/public/models/distribution", nil)
	modelsRes := httptest.NewRecorder()
	handler.PublicModelsDistribution(modelsRes, modelsReq)

	if modelsRes.Code != http.StatusOK {
		t.Fatalf("PublicModelsDistribution status = %d, want 200", modelsRes.Code)
	}

	var distribution PublicModelsDistributionResponse
	if err := json.Unmarshal(modelsRes.Body.Bytes(), &distribution); err != nil {
		t.Fatalf("json.Unmarshal(distribution) error = %v", err)
	}
	if len(distribution.Models) != 2 {
		t.Fatalf("len(distribution.Models) = %d, want 2", len(distribution.Models))
	}
	if distribution.Models[0].Model != "claude-sonnet-4" {
		t.Fatalf("top model = %q, want %q", distribution.Models[0].Model, "claude-sonnet-4")
	}
	if distribution.Models[0].Share != 0.6 {
		t.Fatalf("top model share = %v, want 0.6", distribution.Models[0].Share)
	}
	if distribution.Models[0].AvgResponseTime != 30000 {
		t.Fatalf("top model avgResponseTime = %v, want 30000", distribution.Models[0].AvgResponseTime)
	}
	if distribution.Models[0].ThroughputTokensPerMinute != 8000 {
		t.Fatalf("top model throughput = %v, want 8000", distribution.Models[0].ThroughputTokensPerMinute)
	}
}

func TestPublicTimelineIncludesAggregatesAndInvalidatesCache(t *testing.T) {
	t.Parallel()

	handler, source, nowRef := newAnalyticsTestHandler(t)

	t0 := time.Date(2026, time.March, 14, 12, 0, 0, 0, time.UTC)
	t1 := t0.Add(30 * time.Second)
	t2 := t1.Add(30 * time.Second)

	recordSnapshot(t, handler, source, nowRef, t0, []models.Session{
		testCodingSession(2, 1000, t0),
	})
	recordSnapshot(t, handler, source, nowRef, t1, []models.Session{
		testCodingSession(4, 5000, t1),
		testChatSession(1, 1200, t1),
	})

	*nowRef = t1
	firstReq := httptest.NewRequest(http.MethodGet, "/api/public/timeline", nil)
	firstRes := httptest.NewRecorder()
	handler.PublicTimeline(firstRes, firstReq)

	if firstRes.Code != http.StatusOK {
		t.Fatalf("first PublicTimeline status = %d, want 200", firstRes.Code)
	}

	var firstTimeline PublicTimelineResponse
	if err := json.Unmarshal(firstRes.Body.Bytes(), &firstTimeline); err != nil {
		t.Fatalf("json.Unmarshal(firstTimeline) error = %v", err)
	}
	if len(firstTimeline.Points) != 2 {
		t.Fatalf("len(firstTimeline.Points) = %d, want 2", len(firstTimeline.Points))
	}
	if firstTimeline.Points[1].ToolCallCount != 2 {
		t.Fatalf("firstTimeline.Points[1].ToolCallCount = %d, want 2", firstTimeline.Points[1].ToolCallCount)
	}
	if firstTimeline.Points[1].AvgResponseTime != 30000 {
		t.Fatalf("firstTimeline.Points[1].AvgResponseTime = %v, want 30000", firstTimeline.Points[1].AvgResponseTime)
	}
	if firstTimeline.Points[1].MessageCount != 5 {
		t.Fatalf("firstTimeline.Points[1].MessageCount = %d, want 5", firstTimeline.Points[1].MessageCount)
	}
	if len(firstTimeline.Points[1].ZoneMix) != 2 || len(firstTimeline.Points[1].ModelMix) != 2 {
		t.Fatalf("unexpected timeline mix entries: %#v / %#v", firstTimeline.Points[1].ZoneMix, firstTimeline.Points[1].ModelMix)
	}

	recordSnapshot(t, handler, source, nowRef, t2, []models.Session{
		testCodingSession(5, 9000, t2),
		testChatSession(3, 3200, t2),
	})

	secondRes := httptest.NewRecorder()
	handler.PublicTimeline(secondRes, firstReq)

	if secondRes.Code != http.StatusOK {
		t.Fatalf("second PublicTimeline status = %d, want 200", secondRes.Code)
	}

	var secondTimeline PublicTimelineResponse
	if err := json.Unmarshal(secondRes.Body.Bytes(), &secondTimeline); err != nil {
		t.Fatalf("json.Unmarshal(secondTimeline) error = %v", err)
	}
	if len(secondTimeline.Points) != 3 {
		t.Fatalf("len(secondTimeline.Points) = %d, want 3", len(secondTimeline.Points))
	}
	if secondTimeline.Points[2].ToolCallCount != 3 {
		t.Fatalf("secondTimeline.Points[2].ToolCallCount = %d, want 3", secondTimeline.Points[2].ToolCallCount)
	}
	if secondTimeline.Points[2].MessageCount != 8 {
		t.Fatalf("secondTimeline.Points[2].MessageCount = %d, want 8", secondTimeline.Points[2].MessageCount)
	}
}

func TestPublicMetricsLiveCachesBetweenRefreshes(t *testing.T) {
	t.Parallel()

	handler, source, nowRef := newAnalyticsTestHandler(t)

	t0 := time.Date(2026, time.March, 14, 14, 0, 0, 0, time.UTC)
	*nowRef = t0
	source.sessions = []models.Session{
		testCodingSession(4, 1000, t0),
		testChatSession(2, 2000, t0),
	}

	req := httptest.NewRequest(http.MethodGet, "/api/public/metrics/live", nil)

	firstRes := httptest.NewRecorder()
	handler.PublicMetricsLive(firstRes, req)

	if firstRes.Code != http.StatusOK {
		t.Fatalf("first PublicMetricsLive status = %d, want 200", firstRes.Code)
	}

	var first PublicLiveMetricsResponse
	if err := json.Unmarshal(firstRes.Body.Bytes(), &first); err != nil {
		t.Fatalf("json.Unmarshal(first live metrics) error = %v", err)
	}
	if first.TPS != 0 {
		t.Fatalf("first TPS = %v, want 0", first.TPS)
	}
	if first.OnlineAgents != 2 {
		t.Fatalf("first OnlineAgents = %d, want 2", first.OnlineAgents)
	}

	*nowRef = t0.Add(1 * time.Second)
	source.sessions = []models.Session{
		testCodingSession(5, 1600, *nowRef),
		testChatSession(3, 2600, *nowRef),
	}

	cachedRes := httptest.NewRecorder()
	handler.PublicMetricsLive(cachedRes, req)

	var cached PublicLiveMetricsResponse
	if err := json.Unmarshal(cachedRes.Body.Bytes(), &cached); err != nil {
		t.Fatalf("json.Unmarshal(cached live metrics) error = %v", err)
	}
	if cached.TPS != first.TPS || cached.UpdatedAt != first.UpdatedAt {
		t.Fatalf("expected cached response, got %#v after %#v", first, cached)
	}

	*nowRef = t0.Add(3 * time.Second)
	source.sessions = []models.Session{
		testCodingSession(5, 1600, *nowRef),
		testChatSession(3, 2600, *nowRef),
	}

	thirdRes := httptest.NewRecorder()
	handler.PublicMetricsLive(thirdRes, req)

	var third PublicLiveMetricsResponse
	if err := json.Unmarshal(thirdRes.Body.Bytes(), &third); err != nil {
		t.Fatalf("json.Unmarshal(third live metrics) error = %v", err)
	}
	if third.TPS != 400 {
		t.Fatalf("third TPS = %v, want 400", third.TPS)
	}
	if third.UpdatedAt == first.UpdatedAt {
		t.Fatalf("expected live metrics cache to refresh, updatedAt stayed %q", third.UpdatedAt)
	}
}

func newAnalyticsTestHandler(t *testing.T) (*Handler, *fakeDataSource, *time.Time) {
	t.Helper()

	now := time.Date(2026, time.March, 14, 10, 0, 0, 0, time.UTC)
	source := &fakeDataSource{
		status: models.GatewayConnectionStatus{
			Connected: true,
			Status:    "connected",
		},
	}

	handler, err := NewHandler(source, Config{
		PublicIDSalt:           "test-salt",
		PublicHistoryPath:      filepath.Join(t.TempDir(), "public-history.jsonl"),
		PublicHistoryHours:     24,
		PublicHistoryInterval:  30 * time.Second,
		PublicHistoryRetention: 24 * time.Hour,
		CacheTTL:               2 * time.Second,
	}, Dependencies{})
	if err != nil {
		t.Fatalf("NewHandler() error = %v", err)
	}

	nowFn := func() time.Time { return now }
	handler.now = nowFn
	handler.history.now = nowFn
	handler.cache.SetTimeSourceForTests(nowFn)
	handler.live.now = nowFn

	return handler, source, &now
}

func recordSnapshot(t *testing.T, handler *Handler, source *fakeDataSource, nowRef *time.Time, capturedAt time.Time, sessions []models.Session) {
	t.Helper()

	*nowRef = capturedAt
	source.sessions = sessions

	if err := handler.history.recordSnapshotAt(handler.buildPublicSnapshot(), capturedAt); err != nil {
		t.Fatalf("recordSnapshotAt(%s) error = %v", capturedAt.Format(time.RFC3339), err)
	}
}

func testCodingSession(messageCount, totalTokens int, updatedAt time.Time) models.Session {
	return models.Session{
		SessionKey:    "agent:claude-code:main",
		Channel:       "workspace",
		Status:        "running",
		Model:         "claude-sonnet-4",
		ModelProvider: "anthropic",
		DisplayName:   "Terminal",
		Kind:          "session",
		MessageCount:  messageCount,
		UpdatedAt:     updatedAt.Format(time.RFC3339),
		LastActiveAt:  updatedAt.Format(time.RFC3339),
		InputTokens:   totalTokens / 2,
		OutputTokens:  totalTokens / 2,
		TotalTokens:   totalTokens,
	}
}

func testChatSession(messageCount, totalTokens int, updatedAt time.Time) models.Session {
	return models.Session{
		SessionKey:    "feishu:ou_xxx",
		Channel:       "feishu",
		Status:        "running",
		Model:         "gpt-4.1",
		ModelProvider: "openai",
		DisplayName:   "Feishu bridge",
		Kind:          "session",
		MessageCount:  messageCount,
		UpdatedAt:     updatedAt.Format(time.RFC3339),
		LastActiveAt:  updatedAt.Format(time.RFC3339),
		InputTokens:   totalTokens / 2,
		OutputTokens:  totalTokens / 2,
		TotalTokens:   totalTokens,
	}
}

func mapZones(entries []PublicZoneHeatmapEntry) map[string]PublicZoneHeatmapEntry {
	zones := make(map[string]PublicZoneHeatmapEntry, len(entries))
	for _, entry := range entries {
		zones[entry.Zone] = entry
	}
	return zones
}
