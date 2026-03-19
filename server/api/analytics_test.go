package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"path/filepath"
	"reflect"
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

	statsReq := httptest.NewRequest(http.MethodGet, "/api/public/agent/"+codePublicID, nil)
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

	legacyReq := httptest.NewRequest(http.MethodGet, "/api/public/agent/"+codePublicID+"/stats", nil)
	legacyRes := httptest.NewRecorder()
	handler.PublicAgentStats(legacyRes, legacyReq)

	if legacyRes.Code != http.StatusOK {
		t.Fatalf("legacy PublicAgentStats status = %d, want 200", legacyRes.Code)
	}

	var legacyStats PublicAgentStatsResponse
	if err := json.Unmarshal(legacyRes.Body.Bytes(), &legacyStats); err != nil {
		t.Fatalf("json.Unmarshal(legacy agent stats) error = %v", err)
	}
	if !reflect.DeepEqual(stats, legacyStats) {
		t.Fatalf("legacy stats mismatch: got %#v want %#v", legacyStats, stats)
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

func TestPublicAnalyticsTrendEndpoint(t *testing.T) {
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

	*nowRef = t2

	req := httptest.NewRequest(http.MethodGet, "/api/public/analytics/trends?hours=2", nil)
	res := httptest.NewRecorder()
	handler.PublicAnalyticsTrends(res, req)

	if res.Code != http.StatusOK {
		t.Fatalf("PublicAnalyticsTrends status = %d, want 200", res.Code)
	}

	var trend PublicTrendResponse
	if err := json.Unmarshal(res.Body.Bytes(), &trend); err != nil {
		t.Fatalf("json.Unmarshal(trend) error = %v", err)
	}
	if trend.Hours != 2 {
		t.Fatalf("trend.Hours = %d, want 2", trend.Hours)
	}
	if len(trend.Points) != 3 {
		t.Fatalf("len(trend.Points) = %d, want 3", len(trend.Points))
	}
	if trend.Points[1].DeltaMessages != 2 || trend.Points[1].DeltaToolCalls != 2 || trend.Points[1].DeltaTokens != 4000 {
		t.Fatalf("trend.Points[1] = %#v", trend.Points[1])
	}
	if trend.Points[2].DeltaMessages != 3 || trend.Points[2].DeltaToolCalls != 3 || trend.Points[2].DeltaTokens != 6000 {
		t.Fatalf("trend.Points[2] = %#v", trend.Points[2])
	}
	if trend.Summary.SampleCount != 3 {
		t.Fatalf("trend.Summary.SampleCount = %d, want 3", trend.Summary.SampleCount)
	}
	if trend.Summary.OnlineAgentsDelta != 1 || trend.Summary.RunningAgentsDelta != 1 {
		t.Fatalf("trend.Summary agent deltas = %#v", trend.Summary)
	}
	if trend.Summary.MessageCountDelta != 5 || trend.Summary.ToolCallCount != 5 || trend.Summary.TotalTokensDelta != 10000 {
		t.Fatalf("trend.Summary = %#v", trend.Summary)
	}
	if trend.Summary.AvgResponseTime != 30000 {
		t.Fatalf("trend.Summary.AvgResponseTime = %v, want 30000", trend.Summary.AvgResponseTime)
	}
}

func TestPublicAnalyticsCompareEndpoint(t *testing.T) {
	t.Parallel()

	handler, source, nowRef := newAnalyticsTestHandler(t)

	y0 := time.Date(2026, time.March, 13, 9, 0, 0, 0, time.UTC)
	y1 := y0.Add(30 * time.Second)
	t0 := time.Date(2026, time.March, 14, 9, 0, 0, 0, time.UTC)
	t1 := t0.Add(30 * time.Second)

	recordSnapshot(t, handler, source, nowRef, y0, []models.Session{
		testCodingSession(2, 1000, y0),
	})
	recordSnapshot(t, handler, source, nowRef, y1, []models.Session{
		testCodingSession(4, 5000, y1),
		testChatSession(1, 1200, y1),
	})
	recordSnapshot(t, handler, source, nowRef, t0, []models.Session{
		testCodingSession(5, 9000, t0),
		testChatSession(3, 3200, t0),
	})
	recordSnapshot(t, handler, source, nowRef, t1, []models.Session{
		testCodingSession(8, 17000, t1),
		testChatSession(6, 6200, t1),
	})

	*nowRef = time.Date(2026, time.March, 14, 12, 0, 0, 0, time.UTC)

	req := httptest.NewRequest(http.MethodGet, "/api/public/analytics/compare", nil)
	res := httptest.NewRecorder()
	handler.PublicAnalyticsCompare(res, req)

	if res.Code != http.StatusOK {
		t.Fatalf("PublicAnalyticsCompare status = %d, want 200", res.Code)
	}

	var compare PublicComparisonResponse
	if err := json.Unmarshal(res.Body.Bytes(), &compare); err != nil {
		t.Fatalf("json.Unmarshal(compare) error = %v", err)
	}
	if compare.Timezone != "UTC" {
		t.Fatalf("compare.Timezone = %q, want UTC", compare.Timezone)
	}
	if compare.Today.MessageCountDelta != 6 || compare.Today.ToolCallCount != 6 || compare.Today.TotalTokensDelta != 11000 {
		t.Fatalf("compare.Today = %#v", compare.Today)
	}
	if compare.Yesterday.MessageCountDelta != 2 || compare.Yesterday.ToolCallCount != 2 || compare.Yesterday.TotalTokensDelta != 4000 {
		t.Fatalf("compare.Yesterday = %#v", compare.Yesterday)
	}
	if compare.Today.AvgOnlineAgents != 2 || compare.Yesterday.AvgOnlineAgents != 1.5 {
		t.Fatalf("compare avg online agents = %#v / %#v", compare.Today, compare.Yesterday)
	}
	if compare.Delta.MessageCountDelta != 4 || compare.Delta.ToolCallCount != 4 || compare.Delta.TotalTokensDelta != 7000 {
		t.Fatalf("compare.Delta = %#v", compare.Delta)
	}
	if compare.Delta.AvgOnlineAgents != 0.5 || compare.Delta.AvgRunningAgents != 0.5 {
		t.Fatalf("compare.Delta agent averages = %#v", compare.Delta)
	}
}

func TestHistoricalAnalyticsUsesColdCacheAndJSONErrors(t *testing.T) {
	t.Parallel()

	handler, source, nowRef := newAnalyticsTestHandler(t)

	base := time.Date(2026, time.March, 14, 12, 0, 0, 0, time.UTC)
	old0 := base.Add(-3 * time.Hour)
	old1 := old0.Add(30 * time.Second)

	recordSnapshot(t, handler, source, nowRef, old0, []models.Session{
		testCodingSession(2, 1000, old0),
	})
	recordSnapshot(t, handler, source, nowRef, old1, []models.Session{
		testCodingSession(4, 5000, old1),
	})

	*nowRef = base
	req := httptest.NewRequest(
		http.MethodGet,
		"/api/public/analytics/trends?since="+url.QueryEscape(old0.Format(time.RFC3339))+"&until="+url.QueryEscape(old1.Format(time.RFC3339)),
		nil,
	)

	firstRes := httptest.NewRecorder()
	handler.PublicAnalyticsTrends(firstRes, req)
	if firstRes.Code != http.StatusOK {
		t.Fatalf("first PublicAnalyticsTrends status = %d, want 200", firstRes.Code)
	}
	if got := firstRes.Header().Get("X-Cache"); got != "MEMORY-MISS" {
		t.Fatalf("first X-Cache = %q, want %q", got, "MEMORY-MISS")
	}

	*nowRef = base.Add(3 * time.Second)
	secondRes := httptest.NewRecorder()
	handler.PublicAnalyticsTrends(secondRes, req)
	if secondRes.Code != http.StatusOK {
		t.Fatalf("second PublicAnalyticsTrends status = %d, want 200", secondRes.Code)
	}
	if got := secondRes.Header().Get("X-Cache"); got != "MEMORY-HIT" {
		t.Fatalf("second X-Cache = %q, want %q", got, "MEMORY-HIT")
	}

	badReq := httptest.NewRequest(http.MethodGet, "/api/public/analytics/trends?hours=0", nil)
	badRes := httptest.NewRecorder()
	handler.PublicAnalyticsTrends(badRes, badReq)

	if badRes.Code != http.StatusBadRequest {
		t.Fatalf("bad PublicAnalyticsTrends status = %d, want 400", badRes.Code)
	}

	var apiErr ErrorResponse
	if err := json.Unmarshal(badRes.Body.Bytes(), &apiErr); err != nil {
		t.Fatalf("json.Unmarshal(apiErr) error = %v", err)
	}
	if apiErr.Error.Code != "invalid_query" {
		t.Fatalf("apiErr.Error.Code = %q, want %q", apiErr.Error.Code, "invalid_query")
	}
	if apiErr.Error.Details["query"] != "hours=0" {
		t.Fatalf("apiErr.Error.Details = %#v", apiErr.Error.Details)
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

func TestPublicAnalyticsRejectInvalidInputAndMethods(t *testing.T) {
	t.Parallel()

	handler, _, _ := newAnalyticsTestHandler(t)

	endpoints := []struct {
		name string
		path string
		call func(http.ResponseWriter, *http.Request)
	}{
		{
			name: "agent stats",
			path: "/api/public/agent/pub_test/stats",
			call: handler.PublicAgentStats,
		},
		{
			name: "zones heatmap",
			path: "/api/public/zones/heatmap",
			call: handler.PublicZonesHeatmap,
		},
		{
			name: "models distribution",
			path: "/api/public/models/distribution",
			call: handler.PublicModelsDistribution,
		},
		{
			name: "live metrics",
			path: "/api/public/metrics/live",
			call: handler.PublicMetricsLive,
		},
	}

	for _, tc := range endpoints {
		tc := tc
		t.Run(tc.name+" rejects non-GET", func(t *testing.T) {
			t.Parallel()

			req := httptest.NewRequest(http.MethodPost, tc.path, nil)
			res := httptest.NewRecorder()
			tc.call(res, req)

			if res.Code != http.StatusMethodNotAllowed {
				t.Fatalf("%s POST status = %d, want 405", tc.name, res.Code)
			}
		})
	}

	invalidPaths := []string{
		"/api/public/agent//stats",
		"/api/public/agent/pub_test/nested/stats",
		"/api/public/agent/pub_test",
	}
	for _, path := range invalidPaths {
		path := path
		t.Run("invalid agent path "+path, func(t *testing.T) {
			t.Parallel()

			req := httptest.NewRequest(http.MethodGet, path, nil)
			res := httptest.NewRecorder()
			handler.PublicAgentStats(res, req)

			if res.Code != http.StatusNotFound {
				t.Fatalf("PublicAgentStats(%q) status = %d, want 404", path, res.Code)
			}
		})
	}

	invalidQueries := []struct {
		name string
		path string
		call func(http.ResponseWriter, *http.Request)
	}{
		{
			name: "agent stats invalid since",
			path: "/api/public/agent/pub_test/stats?since=not-a-timestamp",
			call: handler.PublicAgentStats,
		},
		{
			name: "zones heatmap invalid until",
			path: "/api/public/zones/heatmap?until=not-a-timestamp",
			call: handler.PublicZonesHeatmap,
		},
		{
			name: "models distribution invalid since",
			path: "/api/public/models/distribution?since=still-bad",
			call: handler.PublicModelsDistribution,
		},
	}
	for _, tc := range invalidQueries {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			req := httptest.NewRequest(http.MethodGet, tc.path, nil)
			res := httptest.NewRecorder()
			tc.call(res, req)

			if res.Code != http.StatusBadRequest {
				t.Fatalf("%s status = %d, want 400", tc.name, res.Code)
			}
		})
	}

	req := httptest.NewRequest(http.MethodGet, "/api/public/agent/pub_unknown/stats", nil)
	res := httptest.NewRecorder()
	handler.PublicAgentStats(res, req)
	if res.Code != http.StatusNotFound {
		t.Fatalf("unknown PublicAgentStats status = %d, want 404", res.Code)
	}
}

func TestPublicAnalyticsFallbackSnapshotAndSingleSampleBoundary(t *testing.T) {
	t.Parallel()

	handler, source, nowRef := newAnalyticsTestHandler(t)
	t0 := time.Date(2026, time.March, 14, 16, 45, 0, 0, time.UTC)
	*nowRef = t0

	emptyHeatmapReq := httptest.NewRequest(http.MethodGet, "/api/public/zones/heatmap", nil)
	emptyHeatmapRes := httptest.NewRecorder()
	handler.PublicZonesHeatmap(emptyHeatmapRes, emptyHeatmapReq)
	if emptyHeatmapRes.Code != http.StatusOK {
		t.Fatalf("empty PublicZonesHeatmap status = %d, want 200", emptyHeatmapRes.Code)
	}

	var emptyHeatmap PublicZonesHeatmapResponse
	if err := json.Unmarshal(emptyHeatmapRes.Body.Bytes(), &emptyHeatmap); err != nil {
		t.Fatalf("json.Unmarshal(empty heatmap) error = %v", err)
	}
	if len(emptyHeatmap.Zones) != 0 {
		t.Fatalf("len(emptyHeatmap.Zones) = %d, want 0", len(emptyHeatmap.Zones))
	}
	if emptyHeatmap.CapturedAt != t0.Format(time.RFC3339) {
		t.Fatalf("emptyHeatmap.CapturedAt = %q, want %q", emptyHeatmap.CapturedAt, t0.Format(time.RFC3339))
	}

	emptyModelsReq := httptest.NewRequest(http.MethodGet, "/api/public/models/distribution", nil)
	emptyModelsRes := httptest.NewRecorder()
	handler.PublicModelsDistribution(emptyModelsRes, emptyModelsReq)
	if emptyModelsRes.Code != http.StatusOK {
		t.Fatalf("empty PublicModelsDistribution status = %d, want 200", emptyModelsRes.Code)
	}

	var emptyModels PublicModelsDistributionResponse
	if err := json.Unmarshal(emptyModelsRes.Body.Bytes(), &emptyModels); err != nil {
		t.Fatalf("json.Unmarshal(empty models) error = %v", err)
	}
	if len(emptyModels.Models) != 0 {
		t.Fatalf("len(emptyModels.Models) = %d, want 0", len(emptyModels.Models))
	}

	emptyMetricsReq := httptest.NewRequest(http.MethodGet, "/api/public/metrics/live", nil)
	emptyMetricsRes := httptest.NewRecorder()
	handler.PublicMetricsLive(emptyMetricsRes, emptyMetricsReq)
	if emptyMetricsRes.Code != http.StatusOK {
		t.Fatalf("empty PublicMetricsLive status = %d, want 200", emptyMetricsRes.Code)
	}

	var emptyMetrics PublicLiveMetricsResponse
	if err := json.Unmarshal(emptyMetricsRes.Body.Bytes(), &emptyMetrics); err != nil {
		t.Fatalf("json.Unmarshal(empty live metrics) error = %v", err)
	}
	if emptyMetrics.OnlineAgents != 0 || emptyMetrics.TPS != 0 || emptyMetrics.AverageLoad != 0 {
		t.Fatalf("unexpected empty live metrics: %#v", emptyMetrics)
	}

	source.sessions = []models.Session{
		{
			SessionKey:   "ops:cron:nightly",
			Channel:      "system",
			Status:       "idle",
			DisplayName:  "Nightly automation",
			MessageCount: 1,
			UpdatedAt:    t0.Format(time.RFC3339),
			LastActiveAt: t0.Format(time.RFC3339),
		},
	}
	publicID := derivePublicIdentity(source.sessions[0].SessionKey, "test-salt").PublicID

	statsReq := httptest.NewRequest(http.MethodGet, "/api/public/agent/"+publicID+"/stats", nil)
	statsRes := httptest.NewRecorder()
	handler.PublicAgentStats(statsRes, statsReq)
	if statsRes.Code != http.StatusOK {
		t.Fatalf("fallback PublicAgentStats status = %d, want 200", statsRes.Code)
	}

	var stats PublicAgentStatsResponse
	if err := json.Unmarshal(statsRes.Body.Bytes(), &stats); err != nil {
		t.Fatalf("json.Unmarshal(fallback stats) error = %v", err)
	}
	if stats.SampleCount != 1 {
		t.Fatalf("stats.SampleCount = %d, want 1", stats.SampleCount)
	}
	if stats.WorkTimeSeconds != 0 || stats.ToolCallCount != 0 || stats.AvgResponseTime != 0 {
		t.Fatalf("unexpected single-sample stats: %#v", stats)
	}
	if stats.MessageCount != 1 {
		t.Fatalf("stats.MessageCount = %d, want 1", stats.MessageCount)
	}
	if len(stats.ActivePeriods) != 1 || stats.ActivePeriods[0].Count != 1 || stats.ActivePeriods[0].Share != 1 {
		t.Fatalf("unexpected ActivePeriods = %#v", stats.ActivePeriods)
	}

	heatmapRes := httptest.NewRecorder()
	// Advance time to expire cache from previous empty query (TTL is 2s)
	*nowRef = t0.Add(3 * time.Second)
	handler.PublicZonesHeatmap(heatmapRes, emptyHeatmapReq)
	if heatmapRes.Code != http.StatusOK {
		t.Fatalf("fallback PublicZonesHeatmap status = %d, want 200", heatmapRes.Code)
	}

	var heatmap PublicZonesHeatmapResponse
	if err := json.Unmarshal(heatmapRes.Body.Bytes(), &heatmap); err != nil {
		t.Fatalf("json.Unmarshal(fallback heatmap) error = %v", err)
	}
	if len(heatmap.Zones) != 1 {
		t.Fatalf("len(heatmap.Zones) = %d, want 1", len(heatmap.Zones))
	}
	if heatmap.Zones[0].Zone != "ops-lab" || heatmap.Zones[0].AgentCount != 1 {
		t.Fatalf("unexpected heatmap zone entry = %#v", heatmap.Zones[0])
	}
	if heatmap.Zones[0].ActivityScore != 0.96 {
		t.Fatalf("heatmap ActivityScore = %v, want 0.96", heatmap.Zones[0].ActivityScore)
	}
	if len(heatmap.Zones[0].StatusDistribution) != 1 || heatmap.Zones[0].StatusDistribution[0].Status != "running" {
		t.Fatalf("unexpected heatmap status distribution = %#v", heatmap.Zones[0].StatusDistribution)
	}

	modelsRes := httptest.NewRecorder()
	handler.PublicModelsDistribution(modelsRes, emptyModelsReq)
	if modelsRes.Code != http.StatusOK {
		t.Fatalf("fallback PublicModelsDistribution status = %d, want 200", modelsRes.Code)
	}

	var distribution PublicModelsDistributionResponse
	if err := json.Unmarshal(modelsRes.Body.Bytes(), &distribution); err != nil {
		t.Fatalf("json.Unmarshal(fallback distribution) error = %v", err)
	}
	if len(distribution.Models) != 1 {
		t.Fatalf("len(distribution.Models) = %d, want 1", len(distribution.Models))
	}
	if distribution.Models[0].Model != "Hidden" {
		t.Fatalf("distribution.Models[0].Model = %q, want %q", distribution.Models[0].Model, "Hidden")
	}
	if distribution.Models[0].Share != 1 || distribution.Models[0].SampleCount != 1 || distribution.Models[0].AgentCount != 1 {
		t.Fatalf("unexpected fallback distribution entry = %#v", distribution.Models[0])
	}
	if distribution.Models[0].AvgResponseTime != 0 || distribution.Models[0].ThroughputTokensPerMinute != 0 {
		t.Fatalf("unexpected single-sample model metrics = %#v", distribution.Models[0])
	}

	metricsRes := httptest.NewRecorder()
	handler.PublicMetricsLive(metricsRes, emptyMetricsReq)
	if metricsRes.Code != http.StatusOK {
		t.Fatalf("fallback PublicMetricsLive status = %d, want 200", metricsRes.Code)
	}

	var metrics PublicLiveMetricsResponse
	if err := json.Unmarshal(metricsRes.Body.Bytes(), &metrics); err != nil {
		t.Fatalf("json.Unmarshal(fallback live metrics) error = %v", err)
	}
	if metrics.OnlineAgents != 1 || metrics.AverageLoad != 0.96 || metrics.TPS != 0 {
		t.Fatalf("unexpected fallback live metrics = %#v", metrics)
	}
}

func TestAnalyticsRoutesServeThroughMuxAndInvalidateCache(t *testing.T) {
	t.Parallel()

	handler, source, nowRef := newAnalyticsTestHandler(t)

	t0 := time.Date(2026, time.March, 14, 18, 0, 0, 0, time.UTC)
	t1 := t0.Add(30 * time.Second)
	t2 := t1.Add(30 * time.Second)

	recordSnapshot(t, handler, source, nowRef, t0, []models.Session{
		testCodingSession(2, 1000, t0),
	})
	recordSnapshot(t, handler, source, nowRef, t1, []models.Session{
		testCodingSession(4, 5000, t1),
		testChatSession(1, 1200, t1),
	})

	server := httptest.NewServer(newAnalyticsTestMux(handler))
	defer server.Close()

	firstHeatmapRes, err := http.Get(server.URL + "/api/public/zones/heatmap")
	if err != nil {
		t.Fatalf("http.Get(first heatmap) error = %v", err)
	}
	defer firstHeatmapRes.Body.Close()
	if firstHeatmapRes.StatusCode != http.StatusOK {
		t.Fatalf("first heatmap status = %d, want 200", firstHeatmapRes.StatusCode)
	}
	if firstHeatmapRes.Header.Get("X-Cache") != "MEMORY-MISS" {
		t.Fatalf("first heatmap X-Cache = %q, want %q", firstHeatmapRes.Header.Get("X-Cache"), "MEMORY-MISS")
	}

	secondHeatmapRes, err := http.Get(server.URL + "/api/public/zones/heatmap")
	if err != nil {
		t.Fatalf("http.Get(second heatmap) error = %v", err)
	}
	defer secondHeatmapRes.Body.Close()
	if secondHeatmapRes.Header.Get("X-Cache") != "MEMORY-HIT" {
		t.Fatalf("second heatmap X-Cache = %q, want %q", secondHeatmapRes.Header.Get("X-Cache"), "MEMORY-HIT")
	}

	recordSnapshot(t, handler, source, nowRef, t2, []models.Session{
		testCodingSession(5, 9000, t2),
		testChatSession(3, 3200, t2),
	})

	thirdHeatmapRes, err := http.Get(server.URL + "/api/public/zones/heatmap")
	if err != nil {
		t.Fatalf("http.Get(third heatmap) error = %v", err)
	}
	defer thirdHeatmapRes.Body.Close()
	if thirdHeatmapRes.Header.Get("X-Cache") != "MEMORY-MISS" {
		t.Fatalf("third heatmap X-Cache = %q, want %q", thirdHeatmapRes.Header.Get("X-Cache"), "MEMORY-MISS")
	}

	codePublicID := derivePublicIdentity("agent:claude-code:main", "test-salt").PublicID
	statsRes, err := http.Get(server.URL + "/api/public/agent/" + codePublicID + "/stats")
	if err != nil {
		t.Fatalf("http.Get(agent stats) error = %v", err)
	}
	defer statsRes.Body.Close()
	if statsRes.StatusCode != http.StatusOK {
		t.Fatalf("agent stats status = %d, want 200", statsRes.StatusCode)
	}

	var stats PublicAgentStatsResponse
	if err := json.NewDecoder(statsRes.Body).Decode(&stats); err != nil {
		t.Fatalf("json.Decode(agent stats) error = %v", err)
	}
	if stats.SampleCount != 3 || stats.ToolCallCount != 3 || stats.MessageCount != 5 {
		t.Fatalf("unexpected mux agent stats = %#v", stats)
	}

	invalidModelsRes, err := http.Get(server.URL + "/api/public/models/distribution?since=bad")
	if err != nil {
		t.Fatalf("http.Get(invalid models request) error = %v", err)
	}
	defer invalidModelsRes.Body.Close()
	if invalidModelsRes.StatusCode != http.StatusBadRequest {
		t.Fatalf("invalid models status = %d, want 400", invalidModelsRes.StatusCode)
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
		PublicHistoryHours:     72,
		PublicHistoryInterval:  30 * time.Second,
		PublicHistoryRetention: 72 * time.Hour,
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

func newAnalyticsTestMux(handler *Handler) *http.ServeMux {
	mux := http.NewServeMux()
	mux.Handle("/api/public/agent/", http.HandlerFunc(handler.PublicAgentStats))
	mux.Handle("/api/public/zones/heatmap", http.HandlerFunc(handler.PublicZonesHeatmap))
	mux.Handle("/api/public/models/distribution", http.HandlerFunc(handler.PublicModelsDistribution))
	mux.Handle("/api/public/metrics/live", http.HandlerFunc(handler.PublicMetricsLive))
	return mux
}
