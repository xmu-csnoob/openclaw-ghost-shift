package cache

import (
	"bufio"
	"bytes"
	"context"
	"crypto/tls"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net"
	"net/url"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"
)

const defaultRedisTimeout = 2 * time.Second

type LookupResult struct {
	Value []byte
	Hit   bool
	Store string
}

type Stats struct {
	Entries map[string]int
}

type HealthStatus struct {
	Name    string `json:"name"`
	OK      bool   `json:"ok"`
	Details string `json:"details,omitempty"`
}

type HealthReport struct {
	Status   string         `json:"status"`
	Backends []HealthStatus `json:"backends"`
}

type backend interface {
	Name() string
	Get(context.Context, string) ([]byte, bool, error)
	Set(context.Context, string, []byte, time.Duration) error
	Ping(context.Context) error
	EntryCount(context.Context) int
}

type Manager struct {
	logger   *slog.Logger
	primary  backend
	fallback backend
}

func NewManager(redisURL string, memoryMaxEntries int, logger *slog.Logger) *Manager {
	if logger == nil {
		logger = slog.Default()
	}

	fallback := newMemoryStore(memoryMaxEntries)
	manager := &Manager{
		logger:   logger,
		fallback: fallback,
	}

	redisURL = strings.TrimSpace(redisURL)
	if redisURL == "" {
		return manager
	}

	store, err := newRedisStore(redisURL)
	if err != nil {
		logger.Warn("redis_cache_disabled", "reason", err.Error())
		return manager
	}

	ctx, cancel := context.WithTimeout(context.Background(), defaultRedisTimeout)
	defer cancel()
	if err := store.Ping(ctx); err != nil {
		logger.Warn("redis_cache_unavailable", "reason", err.Error())
		return manager
	}

	manager.primary = store
	logger.Info("redis_cache_enabled", "addr", store.addr, "db", store.db)
	return manager
}

func (m *Manager) Get(ctx context.Context, key string) (LookupResult, error) {
	if m.primary != nil {
		value, hit, err := m.primary.Get(ctx, key)
		if err == nil && hit {
			return LookupResult{Value: value, Hit: true, Store: m.primary.Name()}, nil
		}
		if err == nil && !hit {
			value, fallbackHit, fallbackErr := m.fallback.Get(ctx, key)
			if fallbackErr != nil {
				return LookupResult{Store: m.fallback.Name()}, fallbackErr
			}
			if fallbackHit {
				return LookupResult{Value: value, Hit: true, Store: m.fallback.Name()}, nil
			}
			return LookupResult{Store: m.primary.Name()}, nil
		}

		m.logger.Warn("cache_primary_lookup_failed", "cache", m.primary.Name(), "key", key, "error", err.Error())
		value, hit, fallbackErr := m.fallback.Get(ctx, key)
		if fallbackErr != nil {
			return LookupResult{Store: m.fallback.Name()}, errors.Join(err, fallbackErr)
		}
		return LookupResult{Value: value, Hit: hit, Store: m.fallback.Name()}, nil
	}

	value, hit, err := m.fallback.Get(ctx, key)
	return LookupResult{Value: value, Hit: hit, Store: m.fallback.Name()}, err
}

func (m *Manager) Set(ctx context.Context, key string, value []byte, ttl time.Duration) (string, error) {
	var storeName string
	var setErr error

	if m.primary != nil {
		storeName = m.primary.Name()
		if err := m.primary.Set(ctx, key, value, ttl); err != nil {
			m.logger.Warn("cache_primary_store_failed", "cache", m.primary.Name(), "key", key, "error", err.Error())
			setErr = err
		}
	}

	if err := m.fallback.Set(ctx, key, value, ttl); err != nil {
		if setErr != nil {
			return m.fallback.Name(), errors.Join(setErr, err)
		}
		return m.fallback.Name(), err
	}

	if storeName == "" || setErr != nil {
		storeName = m.fallback.Name()
	}
	return storeName, setErr
}

func (m *Manager) Stats(ctx context.Context) Stats {
	entries := map[string]int{
		m.fallback.Name(): m.fallback.EntryCount(ctx),
	}
	if m.primary != nil {
		entries[m.primary.Name()] = m.primary.EntryCount(ctx)
	}
	return Stats{Entries: entries}
}

func (m *Manager) Health(ctx context.Context) HealthReport {
	backends := make([]HealthStatus, 0, 2)

	if m.primary != nil {
		if err := m.primary.Ping(ctx); err != nil {
			backends = append(backends, HealthStatus{
				Name:    m.primary.Name(),
				OK:      false,
				Details: err.Error(),
			})
		} else {
			backends = append(backends, HealthStatus{Name: m.primary.Name(), OK: true})
		}
	}

	if err := m.fallback.Ping(ctx); err != nil {
		backends = append(backends, HealthStatus{
			Name:    m.fallback.Name(),
			OK:      false,
			Details: err.Error(),
		})
	} else {
		backends = append(backends, HealthStatus{Name: m.fallback.Name(), OK: true})
	}

	status := "ok"
	for _, backend := range backends {
		if backend.OK {
			return HealthReport{Status: status, Backends: backends}
		}
	}
	if len(backends) > 0 {
		status = "degraded"
	}
	return HealthReport{Status: status, Backends: backends}
}

func (m *Manager) SetTimeSourceForTests(now func() time.Time) {
	if store, ok := m.fallback.(*memoryStore); ok && now != nil {
		store.now = now
	}
}

type memoryEntry struct {
	value      []byte
	expiresAt  time.Time
	lastAccess time.Time
}

type memoryStore struct {
	mu         sync.RWMutex
	maxEntries int
	entries    map[string]memoryEntry
	now        func() time.Time
}

func newMemoryStore(maxEntries int) *memoryStore {
	if maxEntries <= 0 {
		maxEntries = 512
	}

	return &memoryStore{
		maxEntries: maxEntries,
		entries:    make(map[string]memoryEntry, maxEntries),
		now:        func() time.Time { return time.Now().UTC() },
	}
}

func (m *memoryStore) Name() string {
	return "memory"
}

func (m *memoryStore) Get(_ context.Context, key string) ([]byte, bool, error) {
	now := m.now()

	m.mu.Lock()
	defer m.mu.Unlock()

	entry, ok := m.entries[key]
	if !ok {
		return nil, false, nil
	}
	if now.After(entry.expiresAt) {
		delete(m.entries, key)
		return nil, false, nil
	}

	entry.lastAccess = now
	m.entries[key] = entry
	return append([]byte(nil), entry.value...), true, nil
}

func (m *memoryStore) Set(_ context.Context, key string, value []byte, ttl time.Duration) error {
	now := m.now()

	m.mu.Lock()
	defer m.mu.Unlock()

	m.pruneExpiredLocked(now)
	m.entries[key] = memoryEntry{
		value:      append([]byte(nil), value...),
		expiresAt:  now.Add(ttl),
		lastAccess: now,
	}
	m.evictLocked()
	return nil
}

func (m *memoryStore) Ping(context.Context) error {
	return nil
}

func (m *memoryStore) EntryCount(context.Context) int {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.pruneExpiredLocked(m.now())
	return len(m.entries)
}

func (m *memoryStore) pruneExpiredLocked(now time.Time) {
	for key, entry := range m.entries {
		if now.After(entry.expiresAt) {
			delete(m.entries, key)
		}
	}
}

func (m *memoryStore) evictLocked() {
	if len(m.entries) <= m.maxEntries {
		return
	}

	keys := make([]string, 0, len(m.entries))
	for key := range m.entries {
		keys = append(keys, key)
	}
	sort.Slice(keys, func(i, j int) bool {
		return m.entries[keys[i]].lastAccess.Before(m.entries[keys[j]].lastAccess)
	})

	for len(m.entries) > m.maxEntries && len(keys) > 0 {
		delete(m.entries, keys[0])
		keys = keys[1:]
	}
}

type redisStore struct {
	addr      string
	db        int
	password  string
	useTLS    bool
	tlsConfig *tls.Config
}

func newRedisStore(rawURL string) (*redisStore, error) {
	parsed, err := url.Parse(strings.TrimSpace(rawURL))
	if err != nil {
		return nil, fmt.Errorf("parse REDIS_URL: %w", err)
	}
	if parsed.Scheme != "redis" && parsed.Scheme != "rediss" {
		return nil, fmt.Errorf("unsupported REDIS_URL scheme %q", parsed.Scheme)
	}

	host := parsed.Hostname()
	if host == "" {
		return nil, fmt.Errorf("REDIS_URL is missing host")
	}

	port := parsed.Port()
	if port == "" {
		port = "6379"
	}

	db := 0
	if rawDB := strings.TrimPrefix(parsed.Path, "/"); rawDB != "" {
		value, err := strconv.Atoi(rawDB)
		if err != nil || value < 0 {
			return nil, fmt.Errorf("REDIS_URL database must be a non-negative integer")
		}
		db = value
	}

	password, _ := parsed.User.Password()
	store := &redisStore{
		addr:     net.JoinHostPort(host, port),
		db:       db,
		password: password,
		useTLS:   parsed.Scheme == "rediss",
	}
	if store.useTLS {
		store.tlsConfig = &tls.Config{MinVersion: tls.VersionTLS12}
	}
	return store, nil
}

func (r *redisStore) Name() string {
	return "redis"
}

func (r *redisStore) Get(ctx context.Context, key string) ([]byte, bool, error) {
	conn, reader, err := r.connect(ctx)
	if err != nil {
		return nil, false, err
	}
	defer conn.Close()

	if err := writeRESPCommand(conn, []byte("GET"), []byte(key)); err != nil {
		return nil, false, err
	}
	response, err := readRESPValue(reader)
	if err != nil {
		return nil, false, err
	}
	if response == nil {
		return nil, false, nil
	}
	value, ok := response.([]byte)
	if !ok {
		return nil, false, fmt.Errorf("unexpected GET response type %T", response)
	}
	return value, true, nil
}

func (r *redisStore) Set(ctx context.Context, key string, value []byte, ttl time.Duration) error {
	conn, reader, err := r.connect(ctx)
	if err != nil {
		return err
	}
	defer conn.Close()

	seconds := int(ttl / time.Second)
	if seconds <= 0 {
		seconds = 1
	}

	if err := writeRESPCommand(conn, []byte("SET"), []byte(key), value, []byte("EX"), []byte(strconv.Itoa(seconds))); err != nil {
		return err
	}
	response, err := readRESPValue(reader)
	if err != nil {
		return err
	}

	ack, ok := response.(string)
	if !ok || strings.ToUpper(ack) != "OK" {
		return fmt.Errorf("unexpected SET response %v", response)
	}
	return nil
}

func (r *redisStore) Ping(ctx context.Context) error {
	conn, reader, err := r.connect(ctx)
	if err != nil {
		return err
	}
	defer conn.Close()

	if err := writeRESPCommand(conn, []byte("PING")); err != nil {
		return err
	}
	response, err := readRESPValue(reader)
	if err != nil {
		return err
	}

	ack, ok := response.(string)
	if !ok || strings.ToUpper(ack) != "PONG" {
		return fmt.Errorf("unexpected PING response %v", response)
	}
	return nil
}

func (r *redisStore) EntryCount(ctx context.Context) int {
	conn, reader, err := r.connect(ctx)
	if err != nil {
		return 0
	}
	defer conn.Close()

	if err := writeRESPCommand(conn, []byte("DBSIZE")); err != nil {
		return 0
	}
	response, err := readRESPValue(reader)
	if err != nil {
		return 0
	}
	value, ok := response.(int64)
	if !ok || value < 0 {
		return 0
	}
	return int(value)
}

func (r *redisStore) connect(ctx context.Context) (net.Conn, *bufio.Reader, error) {
	conn, err := r.dial(ctx)
	if err != nil {
		return nil, nil, err
	}

	reader := bufio.NewReader(conn)
	if err := r.bootstrap(conn, reader); err != nil {
		conn.Close()
		return nil, nil, err
	}
	return conn, reader, nil
}

func (r *redisStore) dial(ctx context.Context) (net.Conn, error) {
	dialer := &net.Dialer{Timeout: defaultRedisTimeout}
	if r.useTLS {
		tlsDialer := &tls.Dialer{
			NetDialer: dialer,
			Config:    r.tlsConfig,
		}
		return tlsDialer.DialContext(ctx, "tcp", r.addr)
	}
	return dialer.DialContext(ctx, "tcp", r.addr)
}

func (r *redisStore) bootstrap(conn net.Conn, reader *bufio.Reader) error {
	if r.password != "" {
		if err := writeRESPCommand(conn, []byte("AUTH"), []byte(r.password)); err != nil {
			return err
		}
		if _, err := readRESPValue(reader); err != nil {
			return err
		}
	}

	if r.db > 0 {
		if err := writeRESPCommand(conn, []byte("SELECT"), []byte(strconv.Itoa(r.db))); err != nil {
			return err
		}
		if _, err := readRESPValue(reader); err != nil {
			return err
		}
	}
	return nil
}

func writeRESPCommand(w io.Writer, args ...[]byte) error {
	var buffer bytes.Buffer
	buffer.WriteString(fmt.Sprintf("*%d\r\n", len(args)))
	for _, arg := range args {
		buffer.WriteString(fmt.Sprintf("$%d\r\n", len(arg)))
		buffer.Write(arg)
		buffer.WriteString("\r\n")
	}
	_, err := w.Write(buffer.Bytes())
	return err
}

func readRESPValue(reader *bufio.Reader) (any, error) {
	prefix, err := reader.ReadByte()
	if err != nil {
		return nil, err
	}

	switch prefix {
	case '+':
		line, err := readRESPLine(reader)
		if err != nil {
			return nil, err
		}
		return line, nil
	case '-':
		line, err := readRESPLine(reader)
		if err != nil {
			return nil, err
		}
		return nil, fmt.Errorf("redis error: %s", line)
	case ':':
		line, err := readRESPLine(reader)
		if err != nil {
			return nil, err
		}
		value, err := strconv.ParseInt(line, 10, 64)
		if err != nil {
			return nil, err
		}
		return value, nil
	case '$':
		line, err := readRESPLine(reader)
		if err != nil {
			return nil, err
		}
		size, err := strconv.Atoi(line)
		if err != nil {
			return nil, err
		}
		if size < 0 {
			return nil, nil
		}

		value := make([]byte, size+2)
		if _, err := io.ReadFull(reader, value); err != nil {
			return nil, err
		}
		return value[:size], nil
	default:
		return nil, fmt.Errorf("unsupported RESP prefix %q", prefix)
	}
}

func readRESPLine(reader *bufio.Reader) (string, error) {
	line, err := reader.ReadString('\n')
	if err != nil {
		return "", err
	}
	return strings.TrimSuffix(strings.TrimSuffix(line, "\n"), "\r"), nil
}
