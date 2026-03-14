package api

import (
	"sort"
	"strings"

	"github.com/xmu-csnoob/openclaw-ghost-shift/server/observability"
)

var (
	publicMetricStatuses   = []string{"running", "idle", "connected", "disconnected", "error"}
	publicMetricZones      = []string{"code-studio", "chat-lounge", "ops-lab"}
	publicMetricRoles      = []string{"coding-agent", "webchat", "automation"}
	publicMetricFootprints = []string{"fresh-thread", "working-set", "heavy-context", "deep-stack"}
)

func (h *Handler) MetricsSnapshot(appVersion string, gatewayConnected bool, cacheEntries map[string]int) observability.MetricsSnapshot {
	return observability.MetricsSnapshot{
		AppVersion:       appVersion,
		GatewayConnected: gatewayConnected,
		CacheEntries:     cacheEntries,
		CustomSamples:    h.customMetricSamples(),
	}
}

func (h *Handler) customMetricSamples() []observability.MetricSample {
	sessions := h.publicSessions()

	samples := make([]observability.MetricSample, 0, 32)
	samples = append(samples, observability.MetricSample{
		Name:  "ghost_shift_public_agents",
		Help:  "Current number of public-facing agent sessions.",
		Type:  "gauge",
		Value: float64(len(sessions)),
	})

	statusCounts := make(map[string]int, len(publicMetricStatuses))
	zoneStatusCounts := make(map[string]map[string]int, len(publicMetricZones))
	roleCounts := make(map[string]int, len(publicMetricRoles))
	originCounts := make(map[string]int)
	modelCounts := make(map[string]int)
	modelProviders := make(map[string]string)
	footprintCounts := make(map[string]int, len(publicMetricFootprints))
	zoneActivityTotals := make(map[string]float64, len(publicMetricZones))
	zoneAgentCounts := make(map[string]int, len(publicMetricZones))

	var messageCount int
	var inputTokens int
	var outputTokens int
	var totalTokens int

	for _, session := range sessions {
		statusCounts[session.Status]++
		roleCounts[session.Role]++
		originCounts[session.Origin]++
		footprintCounts[session.Footprint]++
		messageCount += session.MessageCount
		inputTokens += session.InputTokens
		outputTokens += session.OutputTokens
		totalTokens += session.TotalTokens

		if zoneStatusCounts[session.Zone] == nil {
			zoneStatusCounts[session.Zone] = make(map[string]int)
		}
		zoneStatusCounts[session.Zone][session.Status]++
		zoneActivityTotals[session.Zone] += session.ActivityScore
		zoneAgentCounts[session.Zone]++

		model := session.Model
		if model == "" {
			model = "unknown"
		}
		modelCounts[model]++
		if provider := inferModelProvider(model); provider != "" {
			modelProviders[model] = provider
		}
	}

	for _, status := range publicMetricStatuses {
		samples = append(samples, observability.MetricSample{
			Name:  "ghost_shift_public_agents_by_status",
			Help:  "Current number of public-facing agent sessions by activity status.",
			Type:  "gauge",
			Labels: map[string]string{
				"status": status,
			},
			Value: float64(statusCounts[status]),
		})
	}

	for _, zone := range publicMetricZones {
		for _, status := range publicMetricStatuses {
			samples = append(samples, observability.MetricSample{
				Name:  "ghost_shift_public_agents_by_zone",
				Help:  "Current number of public-facing agent sessions grouped by zone and status.",
				Type:  "gauge",
				Labels: map[string]string{
					"zone":   zone,
					"status": status,
				},
				Value: float64(zoneStatusCounts[zone][status]),
			})
		}

		average := 0.0
		if zoneAgentCounts[zone] > 0 {
			average = zoneActivityTotals[zone] / float64(zoneAgentCounts[zone])
		}
		samples = append(samples, observability.MetricSample{
			Name:  "ghost_shift_public_activity_score_average",
			Help:  "Average public activity score for agents in each zone.",
			Type:  "gauge",
			Labels: map[string]string{
				"zone": zone,
			},
			Value: average,
		})
	}

	for _, role := range publicMetricRoles {
		samples = append(samples, observability.MetricSample{
			Name:  "ghost_shift_public_agents_by_role",
			Help:  "Current number of public-facing agent sessions by role.",
			Type:  "gauge",
			Labels: map[string]string{
				"role": role,
			},
			Value: float64(roleCounts[role]),
		})
	}

	origins := sortedKeys(originCounts)
	for _, origin := range origins {
		samples = append(samples, observability.MetricSample{
			Name:  "ghost_shift_public_agents_by_origin",
			Help:  "Current number of public-facing agent sessions by source origin.",
			Type:  "gauge",
			Labels: map[string]string{
				"origin": origin,
			},
			Value: float64(originCounts[origin]),
		})
	}

	for _, footprint := range publicMetricFootprints {
		samples = append(samples, observability.MetricSample{
			Name:  "ghost_shift_public_agents_by_footprint",
			Help:  "Current number of public-facing agent sessions by workload footprint.",
			Type:  "gauge",
			Labels: map[string]string{
				"footprint": footprint,
			},
			Value: float64(footprintCounts[footprint]),
		})
	}

	models := sortedKeys(modelCounts)
	for _, model := range models {
		samples = append(samples, observability.MetricSample{
			Name:  "ghost_shift_public_agents_by_model",
			Help:  "Current number of public-facing agent sessions by model family.",
			Type:  "gauge",
			Labels: map[string]string{
				"model":    model,
				"provider": modelProviders[model],
			},
			Value: float64(modelCounts[model]),
		})
	}

	samples = append(samples,
		observability.MetricSample{
			Name:  "ghost_shift_public_messages",
			Help:  "Current total number of messages visible in the public snapshot workload.",
			Type:  "gauge",
			Value: float64(messageCount),
		},
		observability.MetricSample{
			Name:  "ghost_shift_public_tokens",
			Help:  "Current total number of tokens visible in the public snapshot workload.",
			Type:  "gauge",
			Labels: map[string]string{
				"type": "input",
			},
			Value: float64(inputTokens),
		},
		observability.MetricSample{
			Name:  "ghost_shift_public_tokens",
			Help:  "Current total number of tokens visible in the public snapshot workload.",
			Type:  "gauge",
			Labels: map[string]string{
				"type": "output",
			},
			Value: float64(outputTokens),
		},
		observability.MetricSample{
			Name:  "ghost_shift_public_tokens",
			Help:  "Current total number of tokens visible in the public snapshot workload.",
			Type:  "gauge",
			Labels: map[string]string{
				"type": "total",
			},
			Value: float64(totalTokens),
		},
	)

	return samples
}

func inferModelProvider(model string) string {
	model = strings.ToLower(strings.TrimSpace(model))
	switch {
	case strings.Contains(model, "claude"):
		return "Anthropic"
	case strings.Contains(model, "gpt"), strings.Contains(model, "o1"), strings.Contains(model, "o3"), strings.Contains(model, "o4"):
		return "OpenAI"
	case strings.Contains(model, "gemini"):
		return "Google AI"
	case strings.Contains(model, "deepseek"):
		return "DeepSeek"
	case strings.Contains(model, "qwen"):
		return "Qwen"
	default:
		return "unknown"
	}
}

func sortedKeys(values map[string]int) []string {
	keys := make([]string, 0, len(values))
	for key := range values {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	return keys
}
