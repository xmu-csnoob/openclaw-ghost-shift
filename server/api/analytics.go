package api

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"net/http"
	"sort"
	"strings"
	"sync"
	"time"
)

const defaultTrendWindowHours = 6

var errPublicStatsNotFound = errors.New("public stats not found")

type liveMetricsTracker struct {
	mu             sync.Mutex
	now            func() time.Time
	previousAt     time.Time
	previousTokens map[string]int
}

type PublicActivePeriod struct {
	Label string  `json:"label"`
	Count int     `json:"count"`
	Share float64 `json:"share"`
}

type PublicAgentStatsResponse struct {
	PublicID        string               `json:"publicId"`
	AgentID         string               `json:"agentId"`
	WorkTimeSeconds int64                `json:"workTimeSeconds"`
	ToolCallCount   int                  `json:"toolCallCount"`
	AvgResponseTime float64              `json:"avgResponseTime"`
	ActivePeriods   []PublicActivePeriod `json:"activePeriods"`
	MessageCount    int                  `json:"messageCount"`
	SampleCount     int                  `json:"sampleCount"`
}

type PublicStatusShare struct {
	Status string  `json:"status"`
	Count  int     `json:"count"`
	Share  float64 `json:"share"`
}

type PublicZoneMixEntry struct {
	Zone  string  `json:"zone"`
	Count int     `json:"count"`
	Share float64 `json:"share"`
}

type PublicModelMixEntry struct {
	Model string  `json:"model"`
	Count int     `json:"count"`
	Share float64 `json:"share"`
}

type PublicZoneHeatmapEntry struct {
	Zone               string              `json:"zone"`
	ActivityScore      float64             `json:"activityScore"`
	AgentCount         int                 `json:"agentCount"`
	StatusDistribution []PublicStatusShare `json:"statusDistribution"`
}

type PublicZonesHeatmapResponse struct {
	CapturedAt string                   `json:"capturedAt"`
	Zones      []PublicZoneHeatmapEntry `json:"zones"`
}

type PublicModelDistributionEntry struct {
	Model                     string  `json:"model"`
	Share                     float64 `json:"share"`
	SampleCount               int     `json:"sampleCount"`
	AgentCount                int     `json:"agentCount"`
	AvgResponseTime           float64 `json:"avgResponseTime"`
	ThroughputTokensPerMinute float64 `json:"throughputTokensPerMinute"`
	AvgLoad                   float64 `json:"avgLoad"`
}

type PublicModelsDistributionResponse struct {
	Models []PublicModelDistributionEntry `json:"models"`
}

type PublicLiveMetricsResponse struct {
	TPS          float64 `json:"tps"`
	OnlineAgents int     `json:"onlineAgents"`
	AverageLoad  float64 `json:"averageLoad"`
	UpdatedAt    string  `json:"updatedAt"`
}

type PublicTrendPoint struct {
	CapturedAt      string  `json:"capturedAt"`
	OnlineAgents    int     `json:"onlineAgents"`
	RunningAgents   int     `json:"runningAgents"`
	MessageCount    int     `json:"messageCount"`
	TotalTokens     int     `json:"totalTokens"`
	DeltaMessages   int     `json:"deltaMessages"`
	DeltaToolCalls  int     `json:"deltaToolCalls"`
	DeltaTokens     int     `json:"deltaTokens"`
	AvgResponseTime float64 `json:"avgResponseTime"`
}

type PublicTrendSummary struct {
	SampleCount        int     `json:"sampleCount"`
	OnlineAgentsDelta  int     `json:"onlineAgentsDelta"`
	RunningAgentsDelta int     `json:"runningAgentsDelta"`
	MessageCountDelta  int     `json:"messageCountDelta"`
	ToolCallCount      int     `json:"toolCallCount"`
	TotalTokensDelta   int     `json:"totalTokensDelta"`
	AvgResponseTime    float64 `json:"avgResponseTime"`
}

type PublicTrendResponse struct {
	Hours   int                `json:"hours"`
	Since   string             `json:"since"`
	Until   string             `json:"until"`
	Points  []PublicTrendPoint `json:"points"`
	Summary PublicTrendSummary `json:"summary"`
}

type PublicComparisonWindow struct {
	Label             string  `json:"label"`
	Date              string  `json:"date"`
	From              string  `json:"from"`
	To                string  `json:"to"`
	SampleCount       int     `json:"sampleCount"`
	AvgOnlineAgents   float64 `json:"avgOnlineAgents"`
	AvgRunningAgents  float64 `json:"avgRunningAgents"`
	MessageCountDelta int     `json:"messageCountDelta"`
	ToolCallCount     int     `json:"toolCallCount"`
	TotalTokensDelta  int     `json:"totalTokensDelta"`
	AvgResponseTime   float64 `json:"avgResponseTime"`
}

type PublicComparisonDelta struct {
	AvgOnlineAgents   float64 `json:"avgOnlineAgents"`
	AvgRunningAgents  float64 `json:"avgRunningAgents"`
	MessageCountDelta int     `json:"messageCountDelta"`
	ToolCallCount     int     `json:"toolCallCount"`
	TotalTokensDelta  int     `json:"totalTokensDelta"`
	AvgResponseTime   float64 `json:"avgResponseTime"`
}

type PublicComparisonResponse struct {
	Timezone   string                 `json:"timezone"`
	ComparedAt string                 `json:"comparedAt"`
	Today      PublicComparisonWindow `json:"today"`
	Yesterday  PublicComparisonWindow `json:"yesterday"`
	Delta      PublicComparisonDelta  `json:"delta"`
}

type analyticsSample struct {
	capturedAt      time.Time
	frame           PublicHistoryFrame
	sessionsByID    map[string]recordedPublicSession
	onlineAgents    int
	runningAgents   int
	messageCount    int
	totalTokens     int
	deltaMessages   int
	deltaTokens     int
	toolCallCount   int
	avgResponseTime float64
	responseSumMs   float64
	responseCount   int
}

func newLiveMetricsTracker(now func() time.Time) *liveMetricsTracker {
	return &liveMetricsTracker{
		now:            now,
		previousTokens: make(map[string]int),
	}
}

func cachedCompute[T any](ctx context.Context, h *Handler, route, key string, ttl time.Duration, compute func() (T, error)) (T, string, error) {
	var zero T

	if h.cache == nil || ttl <= 0 {
		value, err := compute()
		return value, "BYPASS", err
	}

	result, err := h.cache.Get(ctx, key)
	switch {
	case err != nil:
		h.recordCacheMetric(result.Store, route, "lookup", "error")
		h.logger.WarnContext(ctx, "cache_lookup_failed", "route", route, "key", key, "error", err.Error())
	case result.Hit:
		h.recordCacheMetric(result.Store, route, "lookup", "hit")
		var value T
		if unmarshalErr := json.Unmarshal(result.Value, &value); unmarshalErr == nil {
			return value, strings.ToUpper(result.Store) + "-HIT", nil
		} else {
			h.logger.WarnContext(ctx, "cache_unmarshal_failed", "route", route, "key", key, "error", unmarshalErr.Error())
		}
		h.recordCacheMetric(result.Store, route, "lookup", "decode_error")
	default:
		h.recordCacheMetric(result.Store, route, "lookup", "miss")
	}

	value, err := compute()
	if err != nil {
		return zero, "MISS", err
	}

	payload, err := marshalJSON(value)
	if err != nil {
		return zero, "MISS", err
	}

	storeName, err := h.cache.Set(ctx, key, payload, ttl)
	if err != nil {
		h.recordCacheMetric(storeName, route, "store", "error")
		h.logger.WarnContext(ctx, "cache_store_failed", "route", route, "key", key, "error", err.Error())
		return value, "MISS", nil
	}

	h.recordCacheMetric(storeName, route, "store", "success")
	if storeName == "" {
		return value, "MISS", nil
	}
	return value, strings.ToUpper(storeName) + "-MISS", nil
}

func (h *Handler) PublicAgentStats(w http.ResponseWriter, r *http.Request) {
	const route = "api_public_agent_stats"
	if !h.requireMethod(w, r, route, http.MethodGet) {
		return
	}

	publicID, ok := parseAgentStatsPath(r.URL.Path)
	if !ok {
		h.respondError(w, r, route, http.StatusNotFound, "invalid_path", "public agent path not found", nil, ErrorDetail{
			"path": r.URL.Path,
		})
		return
	}

	since, until, err := parseHistoryWindow(r)
	if err != nil {
		h.respondError(w, r, route, http.StatusBadRequest, "invalid_query", err.Error(), err, ErrorDetail{
			"publicId": publicID,
			"query":    r.URL.RawQuery,
		})
		return
	}

	payload, cacheStatus, err := cachedCompute(r.Context(), h, route, h.analyticsCacheKey("agent-stats", "/api/public/agent/"+publicID, r.URL.RawQuery), h.analyticsTTL(since, until), func() (*PublicAgentStatsResponse, error) {
		stats, found := h.computeAgentStats(publicID, since, until)
		if !found {
			return nil, errPublicStatsNotFound
		}
		return &stats, nil
	})
	if errors.Is(err, errPublicStatsNotFound) {
		h.respondError(w, r, route, http.StatusNotFound, "agent_not_found", "public agent not found", err, ErrorDetail{
			"publicId": publicID,
		})
		return
	}
	if err != nil {
		h.respondError(w, r, route, http.StatusInternalServerError, "agent_stats_build_failed", "failed to build agent stats", err, ErrorDetail{
			"publicId": publicID,
		})
		return
	}

	w.Header().Set("X-Cache", cacheStatus)
	writeJSON(w, http.StatusOK, payload)
}

func (h *Handler) PublicZonesHeatmap(w http.ResponseWriter, r *http.Request) {
	const route = "api_public_zones_heatmap"
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

	payload, cacheStatus, err := cachedCompute(r.Context(), h, route, h.analyticsCacheKey("zones-heatmap", r.URL.Path, r.URL.RawQuery), h.analyticsTTL(since, until), func() (PublicZonesHeatmapResponse, error) {
		return h.computeZonesHeatmap(since, until), nil
	})
	if err != nil {
		h.respondError(w, r, route, http.StatusInternalServerError, "zones_heatmap_build_failed", "failed to build zone heatmap", err, nil)
		return
	}

	w.Header().Set("X-Cache", cacheStatus)
	writeJSON(w, http.StatusOK, payload)
}

func (h *Handler) PublicModelsDistribution(w http.ResponseWriter, r *http.Request) {
	const route = "api_public_models_distribution"
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

	payload, cacheStatus, err := cachedCompute(r.Context(), h, route, h.analyticsCacheKey("models-distribution", r.URL.Path, r.URL.RawQuery), h.analyticsTTL(since, until), func() (PublicModelsDistributionResponse, error) {
		return h.computeModelsDistribution(since, until), nil
	})
	if err != nil {
		h.respondError(w, r, route, http.StatusInternalServerError, "models_distribution_build_failed", "failed to build model distribution", err, nil)
		return
	}

	w.Header().Set("X-Cache", cacheStatus)
	writeJSON(w, http.StatusOK, payload)
}

func (h *Handler) PublicMetricsLive(w http.ResponseWriter, r *http.Request) {
	const route = "api_public_metrics_live"
	if !h.requireMethod(w, r, route, http.MethodGet) {
		return
	}

	payload, cacheStatus, err := cachedCompute(r.Context(), h, route, "metrics-live", h.liveMetricsCacheTTL(), func() (PublicLiveMetricsResponse, error) {
		return h.live.compute(h.publicSessions()), nil
	})
	if err != nil {
		h.respondError(w, r, route, http.StatusInternalServerError, "live_metrics_build_failed", "failed to build live metrics", err, nil)
		return
	}

	w.Header().Set("X-Cache", cacheStatus)
	writeJSON(w, http.StatusOK, payload)
}

func (h *Handler) PublicAnalyticsTrends(w http.ResponseWriter, r *http.Request) {
	const route = "api_public_analytics_trends"
	if !h.requireMethod(w, r, route, http.MethodGet) {
		return
	}

	since, until, hours, err := h.parseTrendWindow(r)
	if err != nil {
		h.respondError(w, r, route, http.StatusBadRequest, "invalid_query", err.Error(), err, ErrorDetail{
			"query": r.URL.RawQuery,
		})
		return
	}

	payload, cacheStatus, err := cachedCompute(r.Context(), h, route, h.analyticsCacheKey("trends", r.URL.Path, r.URL.RawQuery), h.analyticsTTL(since, until), func() (PublicTrendResponse, error) {
		return h.computeTrend(since, until, hours), nil
	})
	if err != nil {
		h.respondError(w, r, route, http.StatusInternalServerError, "trend_build_failed", "failed to build analytics trend", err, nil)
		return
	}

	w.Header().Set("X-Cache", cacheStatus)
	writeJSON(w, http.StatusOK, payload)
}

func (h *Handler) PublicAnalyticsCompare(w http.ResponseWriter, r *http.Request) {
	const route = "api_public_analytics_compare"
	if !h.requireMethod(w, r, route, http.MethodGet) {
		return
	}

	payload, cacheStatus, err := cachedCompute(r.Context(), h, route, h.analyticsCacheKey("compare", r.URL.Path, r.URL.RawQuery), h.analyticsHotCacheTTL(), func() (PublicComparisonResponse, error) {
		return h.computeTodayVsYesterday(), nil
	})
	if err != nil {
		h.respondError(w, r, route, http.StatusInternalServerError, "comparison_build_failed", "failed to build today vs yesterday comparison", err, nil)
		return
	}

	w.Header().Set("X-Cache", cacheStatus)
	writeJSON(w, http.StatusOK, payload)
}

func parseAgentStatsPath(path string) (string, bool) {
	const prefix = "/api/public/agent/"
	if !strings.HasPrefix(path, prefix) {
		return "", false
	}

	parts := strings.Split(strings.Trim(strings.TrimPrefix(path, prefix), "/"), "/")
	switch {
	case len(parts) == 1 && parts[0] != "" && parts[0] != "stats":
		return parts[0], true
	case len(parts) == 2 && parts[0] != "" && parts[1] == "stats":
		return parts[0], true
	default:
		return "", false
	}
}

func (h *Handler) analyticsCacheKey(kind, path, rawQuery string) string {
	return fmt.Sprintf("%s:%s?%s:%s", kind, path, rawQuery, h.history.cacheVersion())
}

func (h *Handler) analyticsFrames(since, until time.Time) []PublicHistoryFrame {
	frames := h.history.filteredFrames(since, until)
	if len(frames) > 0 {
		return frames
	}

	snapshot := h.buildPublicSnapshot()
	if len(snapshot.Sessions) == 0 {
		return []PublicHistoryFrame{}
	}
	return []PublicHistoryFrame{buildHistoryFrame(snapshot, h.now())}
}

func (h *Handler) computeAgentStats(publicID string, since, until time.Time) (PublicAgentStatsResponse, bool) {
	samples := h.analyticsSamples(since, until)
	if len(samples) == 0 {
		return PublicAgentStatsResponse{}, false
	}

	var (
		agentID           string
		lastSession       *recordedPublicSession
		lastCapturedAt    time.Time
		workTime          time.Duration
		toolCallCount     int
		responseSumMs     float64
		responseCount     int
		messageCount      int
		sampleCount       int
		activeSampleCount int
	)

	periodCounts := make(map[string]int)

	for _, sample := range samples {
		session, ok := sample.sessionsByID[publicID]
		if !ok {
			continue
		}

		sampleCount++
		if agentID == "" {
			agentID = session.AgentID
		}
		if session.MessageCount > messageCount {
			messageCount = session.MessageCount
		}

		isActive := recordedSessionIsActive(session)
		if isActive {
			label := activePeriodLabel(sample.capturedAt)
			periodCounts[label]++
			activeSampleCount++
		}

		if lastSession != nil {
			interval := sample.capturedAt.Sub(lastCapturedAt)
			if interval > 0 && (recordedSessionIsActive(*lastSession) || isActive) {
				workTime += interval
			}

			if interval > 0 {
				messageDelta, tokenDelta := sessionDeltas(*lastSession, session)
				if messageDelta > 0 || tokenDelta > 0 {
					toolCallCount += estimatedToolCalls(messageDelta, tokenDelta)
					responseSumMs += float64(interval.Milliseconds())
					responseCount++
				}
			}
		}

		sessionCopy := session
		lastSession = &sessionCopy
		lastCapturedAt = sample.capturedAt
	}

	if sampleCount == 0 {
		return PublicAgentStatsResponse{}, false
	}

	return PublicAgentStatsResponse{
		PublicID:        publicID,
		AgentID:         agentID,
		WorkTimeSeconds: int64(workTime / time.Second),
		ToolCallCount:   toolCallCount,
		AvgResponseTime: averageOrZero(responseSumMs, responseCount),
		ActivePeriods:   buildActivePeriods(periodCounts, activeSampleCount, sampleCount),
		MessageCount:    messageCount,
		SampleCount:     sampleCount,
	}, true
}

func (h *Handler) computeZonesHeatmap(since, until time.Time) PublicZonesHeatmapResponse {
	frames := h.analyticsFrames(since, until)
	if len(frames) == 0 {
		return PublicZonesHeatmapResponse{
			CapturedAt: h.now().Format(time.RFC3339),
			Zones:      []PublicZoneHeatmapEntry{},
		}
	}

	type zoneAggregate struct {
		activitySum   float64
		activityCount int
		agentCount    int
		statusCounts  map[string]int
	}

	aggregates := make(map[string]*zoneAggregate)
	lastFrame := frames[len(frames)-1]
	for _, frame := range frames {
		for _, session := range frame.Sessions {
			agg := aggregates[session.Zone]
			if agg == nil {
				agg = &zoneAggregate{statusCounts: make(map[string]int)}
				aggregates[session.Zone] = agg
			}
			agg.activitySum += session.ActivityScore
			agg.activityCount++
		}
	}

	for _, session := range lastFrame.Sessions {
		agg := aggregates[session.Zone]
		if agg == nil {
			agg = &zoneAggregate{statusCounts: make(map[string]int)}
			aggregates[session.Zone] = agg
		}
		agg.agentCount++
		agg.statusCounts[session.Status]++
	}

	zones := make([]PublicZoneHeatmapEntry, 0, len(aggregates))
	for zone, agg := range aggregates {
		zones = append(zones, PublicZoneHeatmapEntry{
			Zone:               zone,
			ActivityScore:      averageOrZero(agg.activitySum, agg.activityCount),
			AgentCount:         agg.agentCount,
			StatusDistribution: buildStatusShares(agg.statusCounts, agg.agentCount),
		})
	}

	sort.Slice(zones, func(i, j int) bool {
		if zones[i].ActivityScore == zones[j].ActivityScore {
			return zones[i].Zone < zones[j].Zone
		}
		return zones[i].ActivityScore > zones[j].ActivityScore
	})

	return PublicZonesHeatmapResponse{
		CapturedAt: lastFrame.CapturedAt,
		Zones:      zones,
	}
}

func (h *Handler) computeModelsDistribution(since, until time.Time) PublicModelsDistributionResponse {
	samples := h.analyticsSamples(since, until)
	if len(samples) == 0 {
		return PublicModelsDistributionResponse{Models: []PublicModelDistributionEntry{}}
	}

	type modelAggregate struct {
		sampleCount   int
		activitySum   float64
		responseSumMs float64
		responseCount int
		tokenDelta    int
		observedSecs  float64
		agents        map[string]struct{}
	}

	aggregates := make(map[string]*modelAggregate)
	totalSamples := 0

	for index, sample := range samples {
		var prev *analyticsSample
		if index > 0 {
			prev = &samples[index-1]
		}

		for _, session := range sample.frame.Sessions {
			model := normalizeModelLabel(session.Model)
			agg := aggregates[model]
			if agg == nil {
				agg = &modelAggregate{agents: make(map[string]struct{})}
				aggregates[model] = agg
			}
			agg.sampleCount++
			agg.activitySum += session.ActivityScore
			agg.agents[session.PublicID] = struct{}{}
			totalSamples++

			if prev == nil {
				continue
			}

			prevSession, ok := prev.sessionsByID[session.PublicID]
			if !ok {
				continue
			}

			interval := sample.capturedAt.Sub(prev.capturedAt)
			if interval <= 0 {
				continue
			}

			messageDelta, tokenDelta := sessionDeltas(prevSession, session)
			agg.observedSecs += interval.Seconds()
			agg.tokenDelta += tokenDelta
			if messageDelta > 0 || tokenDelta > 0 {
				agg.responseSumMs += float64(interval.Milliseconds())
				agg.responseCount++
			}
		}
	}

	models := make([]PublicModelDistributionEntry, 0, len(aggregates))
	for model, agg := range aggregates {
		throughput := 0.0
		if agg.observedSecs > 0 {
			throughput = round2(float64(agg.tokenDelta) * 60 / agg.observedSecs)
		}

		models = append(models, PublicModelDistributionEntry{
			Model:                     model,
			Share:                     ratioOrZero(agg.sampleCount, totalSamples),
			SampleCount:               agg.sampleCount,
			AgentCount:                len(agg.agents),
			AvgResponseTime:           averageOrZero(agg.responseSumMs, agg.responseCount),
			ThroughputTokensPerMinute: throughput,
			AvgLoad:                   averageOrZero(agg.activitySum, agg.sampleCount),
		})
	}

	sort.Slice(models, func(i, j int) bool {
		if models[i].Share == models[j].Share {
			return models[i].Model < models[j].Model
		}
		return models[i].Share > models[j].Share
	})

	return PublicModelsDistributionResponse{Models: models}
}

func (h *Handler) analyticsSamples(since, until time.Time) []analyticsSample {
	return buildAnalyticsSamples(h.analyticsFrames(since, until))
}

func buildAnalyticsSamples(frames []PublicHistoryFrame) []analyticsSample {
	samples := make([]analyticsSample, 0, len(frames))

	var (
		prevSample analyticsSample
		hasPrev    bool
	)

	for _, frame := range frames {
		capturedAt, err := time.Parse(time.RFC3339, frame.CapturedAt)
		if err != nil {
			continue
		}

		sample := analyticsSample{
			capturedAt:    capturedAt,
			frame:         frame,
			sessionsByID:  recordedSessionIndex(frame.Sessions),
			onlineAgents:  frame.Status.Displayed,
			runningAgents: frame.Status.Running,
			messageCount:  totalMessageCount(frame.Sessions),
			totalTokens:   totalTokenCount(frame.Sessions),
		}

		if hasPrev {
			interval := sample.capturedAt.Sub(prevSample.capturedAt)
			if interval > 0 {
				for publicID, session := range sample.sessionsByID {
					prevSession, ok := prevSample.sessionsByID[publicID]
					if !ok {
						continue
					}

					messageDelta, tokenDelta := sessionDeltas(prevSession, session)
					sample.deltaMessages += messageDelta
					sample.deltaTokens += tokenDelta
					if messageDelta == 0 && tokenDelta == 0 {
						continue
					}

					sample.responseSumMs += float64(interval.Milliseconds())
					sample.responseCount++
					sample.toolCallCount += estimatedToolCalls(messageDelta, tokenDelta)
				}
				sample.avgResponseTime = averageOrZero(sample.responseSumMs, sample.responseCount)
			}
		}

		samples = append(samples, sample)
		prevSample = sample
		hasPrev = true
	}

	return samples
}

func (h *Handler) parseTrendWindow(r *http.Request) (time.Time, time.Time, int, error) {
	since, until, err := parseHistoryWindow(r)
	if err != nil {
		return time.Time{}, time.Time{}, 0, err
	}

	maxHours := 0
	if h.history != nil {
		maxHours = h.history.retentionHours
	}
	hours, err := parsePositiveQueryInt("hours", r.URL.Query().Get("hours"), defaultTrendWindowHours, maxHours)
	if err != nil {
		return time.Time{}, time.Time{}, 0, err
	}

	if until.IsZero() {
		until = h.now()
	}
	if since.IsZero() {
		since = until.Add(-time.Duration(hours) * time.Hour)
	}
	if until.Before(since) {
		return time.Time{}, time.Time{}, 0, fmt.Errorf("invalid time window: until must be greater than or equal to since")
	}

	return since, until, hours, nil
}

func (h *Handler) defaultTrendWindow() (time.Time, time.Time) {
	until := h.now()
	return until.Add(-time.Duration(defaultTrendWindowHours) * time.Hour), until
}

func (h *Handler) computeTrend(since, until time.Time, hours int) PublicTrendResponse {
	samples := h.analyticsSamples(since, until)
	points := make([]PublicTrendPoint, 0, len(samples))
	summary := PublicTrendSummary{
		SampleCount: len(samples),
	}

	var (
		first       *analyticsSample
		last        *analyticsSample
		responseSum float64
		responseCnt int
	)

	for index := range samples {
		sample := &samples[index]
		if first == nil {
			first = sample
		}
		last = sample

		points = append(points, PublicTrendPoint{
			CapturedAt:      sample.capturedAt.Format(time.RFC3339),
			OnlineAgents:    sample.onlineAgents,
			RunningAgents:   sample.runningAgents,
			MessageCount:    sample.messageCount,
			TotalTokens:     sample.totalTokens,
			DeltaMessages:   sample.deltaMessages,
			DeltaToolCalls:  sample.toolCallCount,
			DeltaTokens:     sample.deltaTokens,
			AvgResponseTime: sample.avgResponseTime,
		})

		summary.MessageCountDelta += sample.deltaMessages
		summary.ToolCallCount += sample.toolCallCount
		summary.TotalTokensDelta += sample.deltaTokens
		responseSum += sample.responseSumMs
		responseCnt += sample.responseCount
	}

	if first != nil && last != nil {
		summary.OnlineAgentsDelta = last.onlineAgents - first.onlineAgents
		summary.RunningAgentsDelta = last.runningAgents - first.runningAgents
	}
	summary.AvgResponseTime = averageOrZero(responseSum, responseCnt)

	return PublicTrendResponse{
		Hours:   hours,
		Since:   since.UTC().Format(time.RFC3339),
		Until:   until.UTC().Format(time.RFC3339),
		Points:  points,
		Summary: summary,
	}
}

func (h *Handler) computeTodayVsYesterday() PublicComparisonResponse {
	now := h.now().UTC()
	todayStart := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC)
	yesterdayStart := todayStart.Add(-24 * time.Hour)
	yesterdayEnd := todayStart.Add(-time.Nanosecond)

	var (
		today     PublicComparisonWindow
		yesterday PublicComparisonWindow
		wg        sync.WaitGroup
	)

	wg.Add(2)
	go func() {
		defer wg.Done()
		today = h.computeComparisonWindow("today", todayStart, now)
	}()
	go func() {
		defer wg.Done()
		yesterday = h.computeComparisonWindow("yesterday", yesterdayStart, yesterdayEnd)
	}()
	wg.Wait()

	return PublicComparisonResponse{
		Timezone:   "UTC",
		ComparedAt: now.Format(time.RFC3339),
		Today:      today,
		Yesterday:  yesterday,
		Delta: PublicComparisonDelta{
			AvgOnlineAgents:   round2(today.AvgOnlineAgents - yesterday.AvgOnlineAgents),
			AvgRunningAgents:  round2(today.AvgRunningAgents - yesterday.AvgRunningAgents),
			MessageCountDelta: today.MessageCountDelta - yesterday.MessageCountDelta,
			ToolCallCount:     today.ToolCallCount - yesterday.ToolCallCount,
			TotalTokensDelta:  today.TotalTokensDelta - yesterday.TotalTokensDelta,
			AvgResponseTime:   round2(today.AvgResponseTime - yesterday.AvgResponseTime),
		},
	}
}

func (h *Handler) computeComparisonWindow(label string, since, until time.Time) PublicComparisonWindow {
	samples := h.analyticsSamples(since, until)
	window := PublicComparisonWindow{
		Label:       label,
		Date:        since.UTC().Format("2006-01-02"),
		From:        since.UTC().Format(time.RFC3339),
		To:          until.UTC().Format(time.RFC3339),
		SampleCount: len(samples),
	}

	var (
		onlineSum   float64
		runningSum  float64
		responseSum float64
		responseCnt int
	)

	for _, sample := range samples {
		onlineSum += float64(sample.onlineAgents)
		runningSum += float64(sample.runningAgents)
		window.MessageCountDelta += sample.deltaMessages
		window.ToolCallCount += sample.toolCallCount
		window.TotalTokensDelta += sample.deltaTokens
		responseSum += sample.responseSumMs
		responseCnt += sample.responseCount
	}

	window.AvgOnlineAgents = averageOrZero(onlineSum, len(samples))
	window.AvgRunningAgents = averageOrZero(runningSum, len(samples))
	window.AvgResponseTime = averageOrZero(responseSum, responseCnt)
	return window
}

func (t *liveMetricsTracker) compute(sessions []PublicSession) PublicLiveMetricsResponse {
	now := t.now()
	currentTokens := make(map[string]int, len(sessions))
	loadSum := 0.0
	for _, session := range sessions {
		currentTokens[session.PublicID] = session.TotalTokens
		loadSum += liveLoadScore(session)
	}

	t.mu.Lock()
	defer t.mu.Unlock()

	tps := 0.0
	if !t.previousAt.IsZero() {
		interval := now.Sub(t.previousAt).Seconds()
		if interval > 0 {
			tokenDelta := 0
			for publicID, totalTokens := range currentTokens {
				if totalTokens > t.previousTokens[publicID] {
					tokenDelta += totalTokens - t.previousTokens[publicID]
				}
			}
			tps = round2(float64(tokenDelta) / interval)
		}
	}

	t.previousAt = now
	t.previousTokens = currentTokens

	return PublicLiveMetricsResponse{
		TPS:          tps,
		OnlineAgents: len(sessions),
		AverageLoad:  averageOrZero(loadSum, len(sessions)),
		UpdatedAt:    now.Format(time.RFC3339),
	}
}

func recordedSessionIndex(sessions []recordedPublicSession) map[string]recordedPublicSession {
	index := make(map[string]recordedPublicSession, len(sessions))
	for _, session := range sessions {
		index[session.PublicID] = session
	}
	return index
}

func recordedSessionIsActive(session recordedPublicSession) bool {
	if session.Status == "running" {
		return true
	}
	if session.ActivityWindow == "live" || session.ActivityWindow == "just-now" {
		return true
	}
	return session.ActivityScore >= 0.72
}

func activePeriodLabel(capturedAt time.Time) string {
	startHour := (capturedAt.UTC().Hour() / 4) * 4
	endHour := startHour + 3
	return fmt.Sprintf("%02d:00-%02d:59 UTC", startHour, endHour)
}

func buildActivePeriods(periodCounts map[string]int, activeSampleCount, sampleCount int) []PublicActivePeriod {
	base := activeSampleCount
	if base == 0 {
		base = sampleCount
	}

	periods := make([]PublicActivePeriod, 0, len(periodCounts))
	for label, count := range periodCounts {
		periods = append(periods, PublicActivePeriod{
			Label: label,
			Count: count,
			Share: ratioOrZero(count, base),
		})
	}

	sort.Slice(periods, func(i, j int) bool {
		if periods[i].Count == periods[j].Count {
			return periods[i].Label < periods[j].Label
		}
		return periods[i].Count > periods[j].Count
	})
	return periods
}

func buildStatusShares(counts map[string]int, total int) []PublicStatusShare {
	if total == 0 {
		return []PublicStatusShare{}
	}

	shares := make([]PublicStatusShare, 0, len(counts))
	for status, count := range counts {
		shares = append(shares, PublicStatusShare{
			Status: status,
			Count:  count,
			Share:  ratioOrZero(count, total),
		})
	}

	sort.Slice(shares, func(i, j int) bool {
		if shares[i].Count == shares[j].Count {
			return shares[i].Status < shares[j].Status
		}
		return shares[i].Count > shares[j].Count
	})
	return shares
}

func buildZoneMix(sessions []recordedPublicSession) []PublicZoneMixEntry {
	if len(sessions) == 0 {
		return []PublicZoneMixEntry{}
	}

	counts := make(map[string]int)
	for _, session := range sessions {
		counts[session.Zone]++
	}

	entries := make([]PublicZoneMixEntry, 0, len(counts))
	for zone, count := range counts {
		entries = append(entries, PublicZoneMixEntry{
			Zone:  zone,
			Count: count,
			Share: ratioOrZero(count, len(sessions)),
		})
	}

	sort.Slice(entries, func(i, j int) bool {
		if entries[i].Count == entries[j].Count {
			return entries[i].Zone < entries[j].Zone
		}
		return entries[i].Count > entries[j].Count
	})
	return entries
}

func buildModelMix(sessions []recordedPublicSession) []PublicModelMixEntry {
	if len(sessions) == 0 {
		return []PublicModelMixEntry{}
	}

	counts := make(map[string]int)
	for _, session := range sessions {
		counts[normalizeModelLabel(session.Model)]++
	}

	entries := make([]PublicModelMixEntry, 0, len(counts))
	for model, count := range counts {
		entries = append(entries, PublicModelMixEntry{
			Model: model,
			Count: count,
			Share: ratioOrZero(count, len(sessions)),
		})
	}

	sort.Slice(entries, func(i, j int) bool {
		if entries[i].Count == entries[j].Count {
			return entries[i].Model < entries[j].Model
		}
		return entries[i].Count > entries[j].Count
	})
	return entries
}

func intervalResponseAndToolMetrics(previous *PublicHistoryFrame, current PublicHistoryFrame) (float64, int) {
	if previous == nil {
		return 0, 0
	}

	prevAt, err := time.Parse(time.RFC3339, previous.CapturedAt)
	if err != nil {
		return 0, 0
	}
	currAt, err := time.Parse(time.RFC3339, current.CapturedAt)
	if err != nil {
		return 0, 0
	}

	interval := currAt.Sub(prevAt)
	if interval <= 0 {
		return 0, 0
	}

	prevIndex := recordedSessionIndex(previous.Sessions)
	responseSumMs := 0.0
	responseCount := 0
	toolCallCount := 0

	for _, session := range current.Sessions {
		prevSession, ok := prevIndex[session.PublicID]
		if !ok {
			continue
		}
		messageDelta, tokenDelta := sessionDeltas(prevSession, session)
		if messageDelta == 0 && tokenDelta == 0 {
			continue
		}

		responseSumMs += float64(interval.Milliseconds())
		responseCount++
		toolCallCount += estimatedToolCalls(messageDelta, tokenDelta)
	}

	return averageOrZero(responseSumMs, responseCount), toolCallCount
}

func sessionDeltas(previous, current recordedPublicSession) (int, int) {
	messageDelta := current.MessageCount - previous.MessageCount
	if messageDelta < 0 {
		messageDelta = 0
	}

	tokenDelta := current.TotalTokens - previous.TotalTokens
	if tokenDelta < 0 {
		tokenDelta = 0
	}

	return messageDelta, tokenDelta
}

func estimatedToolCalls(messageDelta, tokenDelta int) int {
	if messageDelta == 0 && tokenDelta == 0 {
		return 0
	}

	estimate := messageDelta
	if estimate == 0 {
		estimate = 1
	}

	tokenBased := int(math.Ceil(float64(tokenDelta) / 4000))
	if tokenBased > estimate {
		estimate = tokenBased
	}
	if estimate > 8 {
		estimate = 8
	}
	return estimate
}

func totalMessageCount(sessions []recordedPublicSession) int {
	total := 0
	for _, session := range sessions {
		total += session.MessageCount
	}
	return total
}

func totalTokenCount(sessions []recordedPublicSession) int {
	total := 0
	for _, session := range sessions {
		total += session.TotalTokens
	}
	return total
}

func normalizeModelLabel(model string) string {
	model = strings.TrimSpace(model)
	if model == "" {
		return "Hidden"
	}
	return model
}

func liveLoadScore(session PublicSession) float64 {
	score := session.ActivityScore
	if score == 0 {
		switch session.Status {
		case "running":
			score = 0.85
		case "error":
			score = 0.6
		default:
			score = 0.2
		}
	}

	switch session.Footprint {
	case "deep-stack":
		score += 0.12
	case "heavy-context":
		score += 0.08
	case "working-set":
		score += 0.04
	}

	if score > 1 {
		score = 1
	}
	return round2(score)
}

func averageOrZero(sum float64, count int) float64 {
	if count <= 0 {
		return 0
	}
	return round2(sum / float64(count))
}

func ratioOrZero(value, total int) float64 {
	if total <= 0 {
		return 0
	}
	return round2(float64(value) / float64(total))
}

func round2(value float64) float64 {
	return math.Round(value*100) / 100
}
