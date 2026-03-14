package observability

import (
	"fmt"
	"io"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"
)

var defaultDurationBuckets = []float64{0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5}

type MetricsSnapshot struct {
	AppVersion       string
	GatewayConnected bool
	CacheEntries     map[string]int
	CustomSamples    []MetricSample
}

type Registry struct {
	mu               sync.Mutex
	startedAt        time.Time
	httpRequests     map[httpRequestKey]uint64
	httpDurations    map[httpDurationKey]*histogram
	cacheOperations  map[cacheOperationKey]uint64
	durationBuckets  []float64
}

type MetricSample struct {
	Name   string
	Help   string
	Type   string
	Labels map[string]string
	Value  float64
}

type httpRequestKey struct {
	Route  string
	Method string
	Status string
}

type httpDurationKey struct {
	Route  string
	Method string
}

type cacheOperationKey struct {
	Cache  string
	Route  string
	Op     string
	Result string
}

type histogram struct {
	buckets []float64
	counts  []uint64
	count   uint64
	sum     float64
}

func NewRegistry() *Registry {
	return &Registry{
		startedAt:       time.Now().UTC(),
		httpRequests:    make(map[httpRequestKey]uint64),
		httpDurations:   make(map[httpDurationKey]*histogram),
		cacheOperations: make(map[cacheOperationKey]uint64),
		durationBuckets: append([]float64(nil), defaultDurationBuckets...),
	}
}

func (r *Registry) ObserveHTTPRequest(route, method string, statusCode int, duration time.Duration) {
	r.mu.Lock()
	defer r.mu.Unlock()

	requestKey := httpRequestKey{
		Route:  sanitizeMetricLabel(route),
		Method: sanitizeMetricLabel(method),
		Status: strconv.Itoa(statusCode),
	}
	r.httpRequests[requestKey]++

	durationKey := httpDurationKey{
		Route:  requestKey.Route,
		Method: requestKey.Method,
	}
	h, ok := r.httpDurations[durationKey]
	if !ok {
		h = newHistogram(r.durationBuckets)
		r.httpDurations[durationKey] = h
	}
	h.Observe(duration.Seconds())
}

func (r *Registry) ObserveCacheOperation(cacheName, route, operation, result string) {
	r.mu.Lock()
	defer r.mu.Unlock()

	key := cacheOperationKey{
		Cache:  sanitizeMetricLabel(cacheName),
		Route:  sanitizeMetricLabel(route),
		Op:     sanitizeMetricLabel(operation),
		Result: sanitizeMetricLabel(result),
	}
	r.cacheOperations[key]++
}

func (r *Registry) Handler(snapshotFn func() MetricsSnapshot) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "text/plain; version=0.0.4; charset=utf-8")
		snapshot := MetricsSnapshot{}
		if snapshotFn != nil {
			snapshot = snapshotFn()
		}
		_, _ = io.WriteString(w, r.Render(snapshot))
	})
}

func (r *Registry) Render(snapshot MetricsSnapshot) string {
	r.mu.Lock()
	requests := cloneRequestMetrics(r.httpRequests)
	durations := cloneDurationMetrics(r.httpDurations)
	cacheOps := cloneCacheMetrics(r.cacheOperations)
	startedAt := r.startedAt
	r.mu.Unlock()

	var builder strings.Builder

	builder.WriteString("# HELP ghost_shift_build_info Static build information.\n")
	builder.WriteString("# TYPE ghost_shift_build_info gauge\n")
	builder.WriteString(fmt.Sprintf("ghost_shift_build_info{version=%q} 1\n", snapshot.AppVersion))

	builder.WriteString("# HELP ghost_shift_uptime_seconds Process uptime in seconds.\n")
	builder.WriteString("# TYPE ghost_shift_uptime_seconds gauge\n")
	builder.WriteString(fmt.Sprintf("ghost_shift_uptime_seconds %.3f\n", time.Since(startedAt).Seconds()))

	builder.WriteString("# HELP ghost_shift_gateway_connected Gateway connectivity status.\n")
	builder.WriteString("# TYPE ghost_shift_gateway_connected gauge\n")
	if snapshot.GatewayConnected {
		builder.WriteString("ghost_shift_gateway_connected 1\n")
	} else {
		builder.WriteString("ghost_shift_gateway_connected 0\n")
	}

	builder.WriteString("# HELP ghost_shift_http_requests_total Total HTTP requests.\n")
	builder.WriteString("# TYPE ghost_shift_http_requests_total counter\n")
	for _, metric := range requests {
		builder.WriteString(fmt.Sprintf(
			"ghost_shift_http_requests_total{route=%q,method=%q,status=%q} %d\n",
			metric.key.Route,
			metric.key.Method,
			metric.key.Status,
			metric.value,
		))
	}

	builder.WriteString("# HELP ghost_shift_http_request_duration_seconds HTTP request latency.\n")
	builder.WriteString("# TYPE ghost_shift_http_request_duration_seconds histogram\n")
	for _, metric := range durations {
		for idx, bucket := range metric.value.buckets {
			builder.WriteString(fmt.Sprintf(
				"ghost_shift_http_request_duration_seconds_bucket{route=%q,method=%q,le=%q} %d\n",
				metric.key.Route,
				metric.key.Method,
				formatPrometheusNumber(bucket),
				metric.value.counts[idx],
			))
		}
		builder.WriteString(fmt.Sprintf(
			"ghost_shift_http_request_duration_seconds_bucket{route=%q,method=%q,le=\"+Inf\"} %d\n",
			metric.key.Route,
			metric.key.Method,
			metric.value.count,
		))
		builder.WriteString(fmt.Sprintf(
			"ghost_shift_http_request_duration_seconds_sum{route=%q,method=%q} %s\n",
			metric.key.Route,
			metric.key.Method,
			formatPrometheusNumber(metric.value.sum),
		))
		builder.WriteString(fmt.Sprintf(
			"ghost_shift_http_request_duration_seconds_count{route=%q,method=%q} %d\n",
			metric.key.Route,
			metric.key.Method,
			metric.value.count,
		))
	}

	builder.WriteString("# HELP ghost_shift_cache_operations_total Cache operations by result.\n")
	builder.WriteString("# TYPE ghost_shift_cache_operations_total counter\n")
	for _, metric := range cacheOps {
		builder.WriteString(fmt.Sprintf(
			"ghost_shift_cache_operations_total{cache=%q,route=%q,operation=%q,result=%q} %d\n",
			metric.key.Cache,
			metric.key.Route,
			metric.key.Op,
			metric.key.Result,
			metric.value,
		))
	}

	builder.WriteString("# HELP ghost_shift_cache_entries Cache entries currently stored.\n")
	builder.WriteString("# TYPE ghost_shift_cache_entries gauge\n")
	cacheNames := make([]string, 0, len(snapshot.CacheEntries))
	for cacheName := range snapshot.CacheEntries {
		cacheNames = append(cacheNames, cacheName)
	}
	sort.Strings(cacheNames)
	for _, cacheName := range cacheNames {
		builder.WriteString(fmt.Sprintf(
			"ghost_shift_cache_entries{cache=%q} %d\n",
			sanitizeMetricLabel(cacheName),
			snapshot.CacheEntries[cacheName],
		))
	}

	appendCustomMetrics(&builder, snapshot.CustomSamples)

	return builder.String()
}

func sanitizeMetricLabel(value string) string {
	value = strings.TrimSpace(value)
	if value == "" {
		return "unknown"
	}
	return value
}

func formatPrometheusNumber(value float64) string {
	return strconv.FormatFloat(value, 'f', -1, 64)
}

func appendCustomMetrics(builder *strings.Builder, samples []MetricSample) {
	if len(samples) == 0 {
		return
	}

	grouped := make(map[string][]MetricSample)
	metadata := make(map[string]MetricSample)
	for _, sample := range samples {
		name := sanitizeMetricLabel(sample.Name)
		if name == "unknown" {
			continue
		}

		normalized := MetricSample{
			Name:   name,
			Help:   strings.TrimSpace(sample.Help),
			Type:   normalizeMetricType(sample.Type),
			Labels: sanitizeMetricLabels(sample.Labels),
			Value:  sample.Value,
		}
		if normalized.Help == "" {
			normalized.Help = "Custom Ghost Shift metric."
		}

		grouped[name] = append(grouped[name], normalized)
		if _, ok := metadata[name]; !ok {
			metadata[name] = normalized
		}
	}

	names := make([]string, 0, len(grouped))
	for name := range grouped {
		names = append(names, name)
	}
	sort.Strings(names)

	for _, name := range names {
		builder.WriteString(fmt.Sprintf("# HELP %s %s\n", name, metadata[name].Help))
		builder.WriteString(fmt.Sprintf("# TYPE %s %s\n", name, metadata[name].Type))

		series := grouped[name]
		sort.Slice(series, func(i, j int) bool {
			return compareMetricSamples(series[i], series[j]) < 0
		})
		for _, sample := range series {
			builder.WriteString(name)
			if len(sample.Labels) > 0 {
				builder.WriteString("{")
				builder.WriteString(formatPrometheusLabels(sample.Labels))
				builder.WriteString("}")
			}
			builder.WriteString(" ")
			builder.WriteString(formatPrometheusNumber(sample.Value))
			builder.WriteString("\n")
		}
	}
}

func normalizeMetricType(value string) string {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "counter":
		return "counter"
	default:
		return "gauge"
	}
}

func sanitizeMetricLabels(labels map[string]string) map[string]string {
	if len(labels) == 0 {
		return nil
	}

	sanitized := make(map[string]string, len(labels))
	for key, value := range labels {
		key = strings.TrimSpace(key)
		if key == "" {
			continue
		}
		sanitized[key] = sanitizeMetricLabel(value)
	}
	if len(sanitized) == 0 {
		return nil
	}
	return sanitized
}

func formatPrometheusLabels(labels map[string]string) string {
	keys := make([]string, 0, len(labels))
	for key := range labels {
		keys = append(keys, key)
	}
	sort.Strings(keys)

	parts := make([]string, 0, len(keys))
	for _, key := range keys {
		parts = append(parts, fmt.Sprintf("%s=%q", key, labels[key]))
	}
	return strings.Join(parts, ",")
}

func compareMetricSamples(left, right MetricSample) int {
	leftLabels := formatPrometheusLabels(left.Labels)
	rightLabels := formatPrometheusLabels(right.Labels)

	switch {
	case leftLabels < rightLabels:
		return -1
	case leftLabels > rightLabels:
		return 1
	default:
		return 0
	}
}

func newHistogram(buckets []float64) *histogram {
	return &histogram{
		buckets: append([]float64(nil), buckets...),
		counts:  make([]uint64, len(buckets)),
	}
}

func (h *histogram) Observe(value float64) {
	h.count++
	h.sum += value
	for idx, bucket := range h.buckets {
		if value <= bucket {
			h.counts[idx]++
		}
	}
}

type requestMetric struct {
	key   httpRequestKey
	value uint64
}

type durationMetric struct {
	key   httpDurationKey
	value *histogram
}

type cacheMetric struct {
	key   cacheOperationKey
	value uint64
}

func cloneRequestMetrics(src map[httpRequestKey]uint64) []requestMetric {
	metrics := make([]requestMetric, 0, len(src))
	for key, value := range src {
		metrics = append(metrics, requestMetric{key: key, value: value})
	}
	sort.Slice(metrics, func(i, j int) bool {
		if metrics[i].key.Route != metrics[j].key.Route {
			return metrics[i].key.Route < metrics[j].key.Route
		}
		if metrics[i].key.Method != metrics[j].key.Method {
			return metrics[i].key.Method < metrics[j].key.Method
		}
		return metrics[i].key.Status < metrics[j].key.Status
	})
	return metrics
}

func cloneDurationMetrics(src map[httpDurationKey]*histogram) []durationMetric {
	metrics := make([]durationMetric, 0, len(src))
	for key, value := range src {
		cloned := &histogram{
			buckets: append([]float64(nil), value.buckets...),
			counts:  append([]uint64(nil), value.counts...),
			count:   value.count,
			sum:     value.sum,
		}
		metrics = append(metrics, durationMetric{key: key, value: cloned})
	}
	sort.Slice(metrics, func(i, j int) bool {
		if metrics[i].key.Route != metrics[j].key.Route {
			return metrics[i].key.Route < metrics[j].key.Route
		}
		return metrics[i].key.Method < metrics[j].key.Method
	})
	return metrics
}

func cloneCacheMetrics(src map[cacheOperationKey]uint64) []cacheMetric {
	metrics := make([]cacheMetric, 0, len(src))
	for key, value := range src {
		metrics = append(metrics, cacheMetric{key: key, value: value})
	}
	sort.Slice(metrics, func(i, j int) bool {
		if metrics[i].key.Cache != metrics[j].key.Cache {
			return metrics[i].key.Cache < metrics[j].key.Cache
		}
		if metrics[i].key.Route != metrics[j].key.Route {
			return metrics[i].key.Route < metrics[j].key.Route
		}
		if metrics[i].key.Op != metrics[j].key.Op {
			return metrics[i].key.Op < metrics[j].key.Op
		}
		return metrics[i].key.Result < metrics[j].key.Result
	})
	return metrics
}
