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

const (
	defaultAnalyticsCacheTTL   = 2 * time.Second
	defaultLiveMetricsCacheTTL = 2 * time.Second
)

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
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	publicID, ok := parseAgentStatsPath(r.URL.Path)
	if !ok {
		http.NotFound(w, r)
		return
	}

	since, until, err := parseHistoryWindow(r)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	payload, cacheStatus, err := cachedCompute(r.Context(), h, "api_public_agent_stats", h.analyticsCacheKey("agent-stats", r.URL.Path, r.URL.RawQuery), defaultAnalyticsCacheTTL, func() (*PublicAgentStatsResponse, error) {
		stats, found := h.computeAgentStats(publicID, since, until)
		if !found {
			return nil, errPublicStatsNotFound
		}
		return &stats, nil
	})
	if errors.Is(err, errPublicStatsNotFound) {
		http.NotFound(w, r)
		return
	}
	if err != nil {
		http.Error(w, "failed to build agent stats", http.StatusInternalServerError)
		return
	}

	w.Header().Set("X-Cache", cacheStatus)
	writeJSON(w, http.StatusOK, payload)
}

func (h *Handler) PublicZonesHeatmap(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	since, until, err := parseHistoryWindow(r)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	payload, cacheStatus, err := cachedCompute(r.Context(), h, "api_public_zones_heatmap", h.analyticsCacheKey("zones-heatmap", r.URL.Path, r.URL.RawQuery), defaultAnalyticsCacheTTL, func() (PublicZonesHeatmapResponse, error) {
		return h.computeZonesHeatmap(since, until), nil
	})
	if err != nil {
		http.Error(w, "failed to build zone heatmap", http.StatusInternalServerError)
		return
	}

	w.Header().Set("X-Cache", cacheStatus)
	writeJSON(w, http.StatusOK, payload)
}

func (h *Handler) PublicModelsDistribution(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	since, until, err := parseHistoryWindow(r)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	payload, cacheStatus, err := cachedCompute(r.Context(), h, "api_public_models_distribution", h.analyticsCacheKey("models-distribution", r.URL.Path, r.URL.RawQuery), defaultAnalyticsCacheTTL, func() (PublicModelsDistributionResponse, error) {
		return h.computeModelsDistribution(since, until), nil
	})
	if err != nil {
		http.Error(w, "failed to build model distribution", http.StatusInternalServerError)
		return
	}

	w.Header().Set("X-Cache", cacheStatus)
	writeJSON(w, http.StatusOK, payload)
}

func (h *Handler) PublicMetricsLive(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	payload, cacheStatus, err := cachedCompute(r.Context(), h, "api_public_metrics_live", "metrics-live", defaultLiveMetricsCacheTTL, func() (PublicLiveMetricsResponse, error) {
		return h.live.compute(h.publicSessions()), nil
	})
	if err != nil {
		http.Error(w, "failed to build live metrics", http.StatusInternalServerError)
		return
	}

	w.Header().Set("X-Cache", cacheStatus)
	writeJSON(w, http.StatusOK, payload)
}

func parseAgentStatsPath(path string) (string, bool) {
	const prefix = "/api/public/agent/"
	const suffix = "/stats"
	if !strings.HasPrefix(path, prefix) || !strings.HasSuffix(path, suffix) {
		return "", false
	}

	publicID := strings.Trim(strings.TrimSuffix(strings.TrimPrefix(path, prefix), suffix), "/")
	if publicID == "" || strings.Contains(publicID, "/") {
		return "", false
	}
	return publicID, true
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
	frames := h.analyticsFrames(since, until)
	if len(frames) == 0 {
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

	for _, frame := range frames {
		capturedAt, err := time.Parse(time.RFC3339, frame.CapturedAt)
		if err != nil {
			continue
		}

		session, ok := findRecordedSession(frame.Sessions, publicID)
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
			label := activePeriodLabel(capturedAt)
			periodCounts[label]++
			activeSampleCount++
		}

		if lastSession != nil {
			interval := capturedAt.Sub(lastCapturedAt)
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
		lastCapturedAt = capturedAt
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
	frames := h.analyticsFrames(since, until)
	if len(frames) == 0 {
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

	for index, frame := range frames {
		currAt, err := time.Parse(time.RFC3339, frame.CapturedAt)
		if err != nil {
			continue
		}

		var (
			prevFrame *PublicHistoryFrame
			prevAt    time.Time
			prevIndex map[string]recordedPublicSession
		)
		if index > 0 {
			prevFrame = &frames[index-1]
			prevAt, _ = time.Parse(time.RFC3339, prevFrame.CapturedAt)
			prevIndex = recordedSessionIndex(prevFrame.Sessions)
		}

		for _, session := range frame.Sessions {
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

			if prevFrame == nil || prevAt.IsZero() {
				continue
			}

			prevSession, ok := prevIndex[session.PublicID]
			if !ok {
				continue
			}

			interval := currAt.Sub(prevAt)
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

func findRecordedSession(sessions []recordedPublicSession, publicID string) (recordedPublicSession, bool) {
	for _, session := range sessions {
		if session.PublicID == publicID {
			return session, true
		}
	}
	return recordedPublicSession{}, false
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
