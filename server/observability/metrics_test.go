package observability

import (
	"strings"
	"testing"
)

func TestRenderIncludesCustomMetrics(t *testing.T) {
	t.Parallel()

	registry := NewRegistry()
	output := registry.Render(MetricsSnapshot{
		AppVersion:       "0.2.0",
		GatewayConnected: true,
		CacheEntries: map[string]int{
			"memory": 2,
		},
		CustomSamples: []MetricSample{
			{
				Name: "ghost_shift_public_agents_by_status",
				Help: "Current number of public-facing agent sessions by activity status.",
				Type: "gauge",
				Labels: map[string]string{
					"status": "running",
				},
				Value: 4,
			},
			{
				Name: "ghost_shift_public_tokens",
				Help: "Current total number of tokens visible in the public snapshot workload.",
				Type: "gauge",
				Labels: map[string]string{
					"type": "total",
				},
				Value: 18000,
			},
		},
	})

	expectedSnippets := []string{
		"# HELP ghost_shift_public_agents_by_status Current number of public-facing agent sessions by activity status.",
		"# TYPE ghost_shift_public_agents_by_status gauge",
		"ghost_shift_public_agents_by_status{status=\"running\"} 4",
		"# HELP ghost_shift_public_tokens Current total number of tokens visible in the public snapshot workload.",
		"ghost_shift_public_tokens{type=\"total\"} 18000",
	}

	for _, snippet := range expectedSnippets {
		if !strings.Contains(output, snippet) {
			t.Fatalf("Render() output missing %q\n%s", snippet, output)
		}
	}
}
