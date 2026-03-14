package api

import (
	"sort"
	"strings"
	"testing"
	"time"

	"github.com/xmu-csnoob/openclaw-ghost-shift/server/models"
	"github.com/xmu-csnoob/openclaw-ghost-shift/server/observability"
)

func TestMetricsSnapshotIncludesBusinessMetrics(t *testing.T) {
	t.Parallel()

	handler, source, nowRef := newAnalyticsTestHandler(t)

	now := time.Date(2026, time.March, 14, 15, 0, 0, 0, time.UTC)
	*nowRef = now
	source.sessions = []models.Session{
		testCodingSession(12, 12000, now),
		testChatSession(3, 2400, now),
		{
			SessionKey:    "ops:cron:nightly",
			Channel:       "system",
			Status:        "idle",
			Model:         "deepseek-r1",
			ModelProvider: "deepseek",
			DisplayName:   "Nightly automation",
			Kind:          "session",
			MessageCount:  1,
			UpdatedAt:     now.Add(-15 * time.Minute).Format(time.RFC3339),
			LastActiveAt:  now.Add(-15 * time.Minute).Format(time.RFC3339),
			InputTokens:   800,
			OutputTokens:  400,
			TotalTokens:   1200,
		},
	}

	snapshot := handler.MetricsSnapshot("0.2.0", true, map[string]int{"memory": 3})
	if snapshot.AppVersion != "0.2.0" {
		t.Fatalf("snapshot.AppVersion = %q, want %q", snapshot.AppVersion, "0.2.0")
	}
	if !snapshot.GatewayConnected {
		t.Fatalf("snapshot.GatewayConnected = false, want true")
	}
	if got := snapshot.CacheEntries["memory"]; got != 3 {
		t.Fatalf("snapshot.CacheEntries[memory] = %d, want 3", got)
	}

	samples := metricSampleMap(snapshot.CustomSamples)

	if got := samples["ghost_shift_public_agents|"]; got != 3 {
		t.Fatalf("ghost_shift_public_agents = %v, want 3", got)
	}
	if got := samples["ghost_shift_public_agents_by_status|status=running"]; got != 2 {
		t.Fatalf("running agents = %v, want 2", got)
	}
	if got := samples["ghost_shift_public_agents_by_status|status=idle"]; got != 1 {
		t.Fatalf("idle agents = %v, want 1", got)
	}
	if got := samples["ghost_shift_public_agents_by_zone|status=running,zone=code-studio"]; got != 1 {
		t.Fatalf("code-studio running agents = %v, want 1", got)
	}
	if got := samples["ghost_shift_public_agents_by_zone|status=running,zone=chat-lounge"]; got != 1 {
		t.Fatalf("chat-lounge running agents = %v, want 1", got)
	}
	if got := samples["ghost_shift_public_agents_by_zone|status=idle,zone=ops-lab"]; got != 1 {
		t.Fatalf("ops-lab idle agents = %v, want 1", got)
	}
	if got := samples["ghost_shift_public_agents_by_model|model=claude-sonnet-4,provider=Anthropic"]; got != 1 {
		t.Fatalf("claude-sonnet-4 agents = %v, want 1", got)
	}
	if got := samples["ghost_shift_public_agents_by_model|model=deepseek-r1,provider=DeepSeek"]; got != 1 {
		t.Fatalf("deepseek-r1 agents = %v, want 1", got)
	}
	if got := samples["ghost_shift_public_tokens|type=total"]; got != 15600 {
		t.Fatalf("total tokens = %v, want 15600", got)
	}
	if got := samples["ghost_shift_public_messages|"]; got != 16 {
		t.Fatalf("messages = %v, want 16", got)
	}
}

func metricSampleMap(samples []observability.MetricSample) map[string]float64 {
	flattened := make(map[string]float64, len(samples))
	for _, sample := range samples {
		flattened[sample.Name+"|"+formatMetricLabels(sample.Labels)] = sample.Value
	}
	return flattened
}

func formatMetricLabels(labels map[string]string) string {
	if len(labels) == 0 {
		return ""
	}

	keys := make([]string, 0, len(labels))
	for key := range labels {
		keys = append(keys, key)
	}
	sort.Strings(keys)

	parts := make([]string, 0, len(keys))
	for _, key := range keys {
		parts = append(parts, key+"="+labels[key])
	}
	return strings.Join(parts, ",")
}
