package api

import (
	"encoding/json"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"
)

// ZoneRule defines a single zone classification rule
type ZoneRule struct {
	Name        string   `json:"name"`
	Label       string   `json:"label"`
	Keywords    []string `json:"keywords"`
	Priority    int      `json:"priority"`
	Color       string   `json:"color"`
	Description string   `json:"description"`
}

// ZoneConfig holds the configuration for zone classification
type ZoneConfig struct {
	Version   string     `json:"version"`
	UpdatedAt string     `json:"updatedAt"`
	UpdatedBy string     `json:"updatedBy"`
	Rules     []ZoneRule `json:"rules"`
}

// DefaultZoneConfig returns the default zone configuration
func DefaultZoneConfig() ZoneConfig {
	return ZoneConfig{
		Version:   "1.0.0",
		UpdatedAt: time.Now().UTC().Format(time.RFC3339),
		UpdatedBy: "system",
		Rules: []ZoneRule{
			{
				Name:     "code-studio",
				Label:    "Code Studio",
				Priority: 10,
				Color:    "#3b82f6",
				Keywords: []string{
					"agent:", "claude code", "claude-code", "workspace",
					"coder", "coding", "cli", "terminal",
				},
				Description: "Coding agents and CLI tools",
			},
			{
				Name:     "chat-lounge",
				Label:    "Chat Lounge",
				Priority: 20,
				Color:    "#10b981",
				Keywords: []string{
					"feishu", "discord", "slack", "telegram",
					"whatsapp", "wechat", "webchat", "inbox", "chat",
				},
				Description: "Chat and messaging platforms",
			},
			{
				Name:     "ops-lab",
				Label:    "Ops Lab",
				Priority: 30,
				Color:    "#f59e0b",
				Keywords: []string{
					"cron", "ops", "worker", "automation",
					"bot", "system", "daemon",
				},
				Description: "Operations and automation systems",
			},
		},
	}
}

// ZoneManager manages zone configuration with thread-safe access
type ZoneManager struct {
	mu     sync.RWMutex
	config ZoneConfig
	path   string
}

// NewZoneManager creates a new ZoneManager
func NewZoneManager(dataDir string) *ZoneManager {
	path := ""
	if dataDir != "" {
		path = filepath.Join(dataDir, "zone_config.json")
	}
	return &ZoneManager{
		config: DefaultZoneConfig(),
		path:   path,
	}
}

// Load loads zone configuration from file, falls back to default
func (m *ZoneManager) Load() error {
	if m.path == "" {
		return nil
	}

	data, err := os.ReadFile(m.path)
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return err
	}

	m.mu.Lock()
	defer m.mu.Unlock()

	return json.Unmarshal(data, &m.config)
}

// Save saves the current configuration to file
func (m *ZoneManager) Save() error {
	if m.path == "" {
		return nil
	}

	dir := filepath.Dir(m.path)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return err
	}

	m.mu.RLock()
	defer m.mu.RUnlock()

	data, err := json.MarshalIndent(m.config, "", "  ")
	if err != nil {
		return err
	}

	return os.WriteFile(m.path, data, 0644)
}

// Get returns the current zone configuration
func (m *ZoneManager) Get() ZoneConfig {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.config
}

// UpdateRules updates the rules and persists to file
func (m *ZoneManager) UpdateRules(rules []ZoneRule, updatedBy string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.config.Rules = rules
	m.config.UpdatedAt = time.Now().UTC().Format(time.RFC3339)
	m.config.UpdatedBy = updatedBy

	if m.path != "" {
		data, err := json.MarshalIndent(m.config, "", "  ")
		if err != nil {
			return err
		}
		return os.WriteFile(m.path, data, 0644)
	}
	return nil
}

// Reset resets configuration to default
func (m *ZoneManager) Reset() error {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.config = DefaultZoneConfig()

	if m.path != "" {
		data, err := json.MarshalIndent(m.config, "", "  ")
		if err != nil {
			return err
		}
		return os.WriteFile(m.path, data, 0644)
	}
	return nil
}

// ClassifyZone determines the zone for a session based on tags and rules
func (m *ZoneManager) ClassifyZone(tags map[string]string, signals string) string {
	// Priority 1: Check session.Tags["zone"]
	if tags != nil {
		if zone, ok := tags["zone"]; ok && zone != "" {
			return zone
		}
	}

	// Priority 2: Keyword matching by rule priority
	m.mu.RLock()
	rules := make([]ZoneRule, len(m.config.Rules))
	copy(rules, m.config.Rules)
	m.mu.RUnlock()

	// Sort by priority (lower number = higher priority)
	sort.Slice(rules, func(i, j int) bool {
		return rules[i].Priority < rules[j].Priority
	})

	text := strings.ToLower(signals)
	for _, rule := range rules {
		for _, keyword := range rule.Keywords {
			if strings.Contains(text, strings.ToLower(keyword)) {
				return rule.Name
			}
		}
	}

	// Priority 3: Fallback
	return "ops-lab"
}

// Global zone manager instance
var globalZoneManager *ZoneManager
var zoneManagerOnce sync.Once

// InitZoneManager initializes the global zone manager
func InitZoneManager(dataDir string) (*ZoneManager, error) {
	var initErr error
	zoneManagerOnce.Do(func() {
		globalZoneManager = NewZoneManager(dataDir)
		initErr = globalZoneManager.Load()
	})
	return globalZoneManager, initErr
}

// GetZoneManager returns the global zone manager
func GetZoneManager() *ZoneManager {
	if globalZoneManager == nil {
		globalZoneManager = NewZoneManager("")
	}
	return globalZoneManager
}
