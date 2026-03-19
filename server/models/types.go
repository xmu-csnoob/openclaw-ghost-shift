package models

// Session represents an agent session
type Session struct {
	SessionKey    string            `json:"sessionKey"`
	SessionID     string            `json:"sessionId,omitempty"`
	AgentID       string            `json:"agentId"`
	Channel       string            `json:"channel,omitempty"`
	Status        string            `json:"status"` // idle, running, waiting
	Model         string            `json:"model,omitempty"`
	ModelProvider string            `json:"modelProvider,omitempty"`
	DisplayName   string            `json:"displayName,omitempty"`
	Kind          string            `json:"kind,omitempty"`
	MessageCount  int               `json:"messageCount,omitempty"`
	CreatedAt     string            `json:"createdAt,omitempty"`
	UpdatedAt     string            `json:"updatedAt,omitempty"`
	LastActiveAt  string            `json:"lastActiveAt,omitempty"`
	Thinking      string            `json:"thinking,omitempty"`
	InputTokens   int               `json:"inputTokens,omitempty"`
	OutputTokens  int               `json:"outputTokens,omitempty"`
	TotalTokens   int               `json:"totalTokens,omitempty"`
	Tags          map[string]string `json:"tags,omitempty"`
}

// HealthStatus represents gateway health
type HealthStatus struct {
	Status    string `json:"status"`
	Version   string `json:"version,omitempty"`
	UptimeMs  int64  `json:"uptimeMs,omitempty"`
	Timestamp string `json:"timestamp"`
}

// PresenceEntry represents an online device
type PresenceEntry struct {
	DeviceID string   `json:"deviceId"`
	Roles    []string `json:"roles,omitempty"`
	Scopes   []string `json:"scopes,omitempty"`
	Online   bool     `json:"online"`
}

// ChannelStatus represents a channel status
type ChannelStatus struct {
	Channel       string `json:"channel"`
	Status        string `json:"status"` // connected, disconnected, connecting
	MessageCount  int    `json:"messageCount,omitempty"`
	LastMessageAt string `json:"lastMessageAt,omitempty"`
}

// NodeInfo represents a node
type NodeInfo struct {
	NodeID   string   `json:"nodeId"`
	Caps     []string `json:"caps,omitempty"` // camera, screen, location, voice, etc.
	Online   bool     `json:"online"`
	LastSeen string   `json:"lastSeen,omitempty"`
}

// CronJob represents a cron job
type CronJob struct {
	ID       string `json:"id"`
	Name     string `json:"name,omitempty"`
	Schedule string `json:"schedule"`
	Enabled  bool   `json:"enabled"`
	NextRun  string `json:"nextRun,omitempty"`
	LastRun  string `json:"lastRun,omitempty"`
}

// GatewayConnectionStatus represents connection to gateway
type GatewayConnectionStatus struct {
	Connected bool   `json:"connected"`
	Status    string `json:"status"` // connected, connecting, disconnected, error
	Error     string `json:"error,omitempty"`
}

// APIStatus represents overall API status
type APIStatus struct {
	Gateway       GatewayConnectionStatus `json:"gateway"`
	SessionsCount int                     `json:"sessionsCount"`
	Timestamp     string                  `json:"timestamp"`
}
