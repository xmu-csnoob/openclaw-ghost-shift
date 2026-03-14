package gateway

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"openclaw-ghost-shift/server/device"
	"openclaw-ghost-shift/server/models"

	"github.com/gorilla/websocket"
)

const (
	defaultGatewayURL = "ws://127.0.0.1:18789"
	ProtocolVersion   = 3
	RequestTimeout    = 30 * time.Second
)

var (
	clientID           = "gateway-client"
	clientInstanceID   = envOrDefault("GHOST_SHIFT_INSTANCE_ID", "ghost-shift-server")
	clientUserAgent    = envOrDefault("GHOST_SHIFT_USER_AGENT", "ghost-shift-server/0.1.0")
	clientVersion      = envOrDefault("GHOST_SHIFT_VERSION", "0.1.0")
	clientPlatform     = "server"
	clientDeviceFamily = ""
	clientMode         = "backend"
	clientRole         = "operator"
	clientScopes       = []string{"operator.read", "operator.write"}
	clientCaps         = []string{"tool-events"}
)

type Client struct {
	conn       *websocket.Conn
	token      string
	connected  bool
	status     string
	lastError  string
	mu         sync.RWMutex
	gatewayURL string

	// Cached data
	sessions         []models.Session
	sessionsSyncedAt time.Time
	health           *models.HealthStatus
	presence         []models.PresenceEntry
	channels         []models.ChannelStatus
	nodes            []models.NodeInfo
	cronJobs         []models.CronJob

	// Request handling
	requestID int
	pending   map[string]chan json.RawMessage
	syncMu    sync.Mutex

	// Challenge
	challengeNonce string

	// Device identity
	deviceIdentity *device.DeviceIdentity
}

type RequestFrame struct {
	Type   string         `json:"type"`
	ID     string         `json:"id"`
	Method string         `json:"method"`
	Params map[string]any `json:"params,omitempty"`
}

type ResponseFrame struct {
	Type    string          `json:"type"`
	ID      string          `json:"id"`
	OK      bool            `json:"ok"`
	Payload json.RawMessage `json:"payload,omitempty"`
	Error   *ErrorInfo      `json:"error,omitempty"`
}

type ErrorInfo struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

type EventFrame struct {
	Type    string          `json:"type"`
	Event   string          `json:"event,omitempty"`
	Payload json.RawMessage `json:"payload,omitempty"`
}

type gatewaySessionsEnvelope struct {
	Sessions []gatewaySession `json:"sessions"`
}

type gatewaySession struct {
	Key           string `json:"key"`
	SessionID     string `json:"sessionId"`
	Channel       string `json:"channel"`
	LastChannel   string `json:"lastChannel"`
	DisplayName   string `json:"displayName"`
	Kind          string `json:"kind"`
	Model         string `json:"model"`
	ModelProvider string `json:"modelProvider"`
	ThinkingLevel string `json:"thinkingLevel"`
	UpdatedAt     int64  `json:"updatedAt"`
	InputTokens   int    `json:"inputTokens"`
	OutputTokens  int    `json:"outputTokens"`
	TotalTokens   int    `json:"totalTokens"`
}

func NewClient() *Client {
	// Load or create device identity
	deviceIdentity, err := device.LoadOrCreate()
	if err != nil {
		log.Printf("[Gateway] Failed to load device identity: %v", err)
	} else {
		log.Printf("[Gateway] Loaded device identity: %s", deviceIdentity.DeviceID)
	}

	return &Client{
		token:          loadGatewayToken(),
		status:         "disconnected",
		pending:        make(map[string]chan json.RawMessage),
		deviceIdentity: deviceIdentity,
		gatewayURL:     resolveGatewayURL(),
	}
}

func (c *Client) Connect() {
	for {
		c.mu.Lock()
		c.status = "connecting"
		c.mu.Unlock()

		if strings.TrimSpace(c.token) == "" {
			c.token = loadGatewayToken()
		}
		if strings.TrimSpace(c.token) == "" {
			c.mu.Lock()
			c.status = "disconnected"
			c.lastError = "missing gateway token"
			c.connected = false
			c.mu.Unlock()
			time.Sleep(5 * time.Second)
			continue
		}

		header := http.Header{}
		if origin := os.Getenv("GATEWAY_ORIGIN"); origin != "" {
			header.Set("Origin", origin)
		}
		conn, _, err := websocket.DefaultDialer.Dial(c.gatewayURL, header)
		if err != nil {
			log.Printf("[Gateway] Connection failed: %v", err)
			c.mu.Lock()
			c.status = "disconnected"
			c.lastError = err.Error()
			c.connected = false
			c.mu.Unlock()
			time.Sleep(5 * time.Second)
			continue
		}

		c.mu.Lock()
		c.conn = conn
		c.mu.Unlock()

		log.Println("[Gateway] Connected, waiting for challenge...")

		// Read messages
		c.readLoop()

		// Reconnect after disconnect
		time.Sleep(3 * time.Second)
	}
}

func (c *Client) readLoop() {
	defer c.conn.Close()

	for {
		_, message, err := c.conn.ReadMessage()
		if err != nil {
			log.Printf("[Gateway] Read error: %v", err)
			c.mu.Lock()
			c.connected = false
			c.status = "disconnected"
			c.lastError = err.Error()
			c.mu.Unlock()
			return
		}

		var frame EventFrame
		if err := json.Unmarshal(message, &frame); err != nil {
			continue
		}

		switch frame.Type {
		case "event":
			c.handleEvent(frame.Event, frame.Payload)
		case "res":
			c.handleResponse(message)
		}
	}
}

func (c *Client) handleEvent(event string, payload json.RawMessage) {
	switch event {
	case "connect.challenge":
		// Parse challenge to get nonce
		var challenge struct {
			Nonce string `json:"nonce"`
			Ts    int64  `json:"ts"`
		}
		if err := json.Unmarshal(payload, &challenge); err == nil {
			c.mu.Lock()
			c.challengeNonce = challenge.Nonce
			c.mu.Unlock()
			log.Printf("[Gateway] Received challenge, nonce: %s...", abbreviate(challenge.Nonce, 8))
		}
		c.sendConnect()
	case "hello-ok":
		// Connection established
		c.mu.Lock()
		c.connected = true
		c.status = "connected"
		c.lastError = ""
		c.mu.Unlock()
		log.Println("[Gateway] Connection established!")
		// Fetch initial data
		go c.fetchInitialData()
	case "sessions":
		sessions, err := parseSessionsPayload(payload)
		if err == nil {
			c.mu.Lock()
			c.sessions = sessions
			c.sessionsSyncedAt = time.Now()
			c.mu.Unlock()
		}
	case "health":
		var health models.HealthStatus
		if err := json.Unmarshal(payload, &health); err == nil {
			c.mu.Lock()
			c.health = &health
			c.mu.Unlock()
		}
	case "presence":
		var presence []models.PresenceEntry
		if err := json.Unmarshal(payload, &presence); err == nil {
			c.mu.Lock()
			c.presence = presence
			c.mu.Unlock()
		}
	}
}

func (c *Client) handleResponse(message json.RawMessage) {
	var resp ResponseFrame
	if err := json.Unmarshal(message, &resp); err != nil {
		return
	}

	if resp.Error != nil {
		c.mu.Lock()
		c.lastError = resp.Error.Message
		c.mu.Unlock()
	}

	c.mu.RLock()
	ch, ok := c.pending[resp.ID]
	c.mu.RUnlock()

	if ok {
		select {
		case ch <- message:
		default:
		}
	}

	if !resp.OK || len(resp.Payload) == 0 {
		return
	}

	var hello struct {
		Type string `json:"type"`
	}
	if err := json.Unmarshal(resp.Payload, &hello); err == nil && hello.Type == "hello-ok" {
		c.mu.Lock()
		c.connected = true
		c.status = "connected"
		c.lastError = ""
		c.mu.Unlock()
		log.Println("[Gateway] Connection established!")
		go c.fetchInitialData()
	}
}

func (c *Client) sendConnect() {
	c.mu.Lock()
	c.requestID++
	id := c.requestID
	nonce := c.challengeNonce
	c.mu.Unlock()

	if nonce == "" {
		log.Println("[Gateway] No nonce yet, skipping connect")
		return
	}

	if c.deviceIdentity == nil {
		log.Printf("[Gateway] Missing device identity, cannot authenticate")
		c.mu.Lock()
		c.lastError = "missing device identity"
		c.mu.Unlock()
		return
	}

	signedAt := time.Now().UnixMilli()
	signMessage := device.BuildSignMessageV3(
		c.deviceIdentity.DeviceID,
		clientID,
		clientMode,
		clientRole,
		clientScopes,
		signedAt,
		c.token,
		nonce,
		clientPlatform,
		clientDeviceFamily,
	)
	signature, err := c.deviceIdentity.Sign(signMessage)
	if err != nil {
		log.Printf("[Gateway] Failed to sign connect payload: %v", err)
		c.mu.Lock()
		c.lastError = err.Error()
		c.mu.Unlock()
		return
	}
	publicKey, err := c.deviceIdentity.PublicKeyBase64URL()
	if err != nil {
		log.Printf("[Gateway] Failed to encode public key: %v", err)
		c.mu.Lock()
		c.lastError = err.Error()
		c.mu.Unlock()
		return
	}

	deviceInfo := map[string]any{
		"id":        c.deviceIdentity.DeviceID,
		"publicKey": publicKey,
		"signature": signature,
		"signedAt":  signedAt,
		"nonce":     nonce,
	}
	log.Printf("[Gateway] Using signed device identity: %s", c.deviceIdentity.DeviceID)

	req := map[string]any{
		"type":   "req",
		"id":     fmt.Sprintf("%d", id),
		"method": "connect",
		"params": map[string]any{
			"minProtocol": ProtocolVersion,
			"maxProtocol": ProtocolVersion,
			"client": map[string]any{
				"id":         clientID,
				"version":    clientVersion,
				"platform":   clientPlatform,
				"mode":       clientMode,
				"instanceId": clientInstanceID,
			},
			"role":        clientRole,
			"scopes":      clientScopes,
			"caps":        clientCaps,
			"commands":    []string{},
			"permissions": map[string]any{},
			"auth": map[string]any{
				"token": c.token,
			},
			"device":    deviceInfo,
			"locale":    "en-US",
			"userAgent": clientUserAgent,
		},
	}

	c.send(req)
}

func (c *Client) sendRequest(method string, params map[string]any) (json.RawMessage, error) {
	c.mu.Lock()
	c.requestID++
	id := fmt.Sprintf("%d", c.requestID) // Convert to string
	ch := make(chan json.RawMessage, 1)
	c.pending[id] = ch

	if c.conn == nil {
		c.mu.Unlock()
		return nil, ErrNotConnected
	}

	req := map[string]any{
		"type":   "req",
		"id":     id,
		"method": method,
	}
	if params != nil {
		req["params"] = params
	}

	if err := c.conn.WriteJSON(req); err != nil {
		delete(c.pending, id)
		c.mu.Unlock()
		return nil, err
	}
	c.mu.Unlock()

	defer func() {
		c.mu.Lock()
		delete(c.pending, id)
		c.mu.Unlock()
	}()

	select {
	case resp := <-ch:
		return resp, nil
	case <-time.After(RequestTimeout):
		return nil, ErrTimeout
	}
}

func (c *Client) send(data any) error {
	c.mu.RLock()
	defer c.mu.RUnlock()
	if c.conn == nil {
		return ErrNotConnected
	}
	return c.conn.WriteJSON(data)
}

func (c *Client) fetchInitialData() {
	if err := c.refreshSessions(true); err == nil {
		c.mu.Lock()
		c.connected = true
		c.status = "connected"
		c.mu.Unlock()
	}
}

// Public getters - return cached data

func (c *Client) GetStatus() models.GatewayConnectionStatus {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return models.GatewayConnectionStatus{
		Connected: c.connected,
		Status:    c.status,
		Error:     c.lastError,
	}
}

func (c *Client) GetSessions() []models.Session {
	_ = c.refreshSessions(false)
	c.mu.RLock()
	defer c.mu.RUnlock()
	if c.sessions == nil {
		return []models.Session{}
	}
	return c.sessions
}

func (c *Client) refreshSessions(force bool) error {
	c.mu.RLock()
	connected := c.connected
	lastSyncedAt := c.sessionsSyncedAt
	c.mu.RUnlock()

	if !connected {
		return nil
	}
	if !force && !lastSyncedAt.IsZero() && time.Since(lastSyncedAt) < 2*time.Second {
		return nil
	}

	c.syncMu.Lock()
	defer c.syncMu.Unlock()

	c.mu.RLock()
	lastSyncedAt = c.sessionsSyncedAt
	c.mu.RUnlock()
	if !force && !lastSyncedAt.IsZero() && time.Since(lastSyncedAt) < 2*time.Second {
		return nil
	}

	resp, err := c.sendRequest("sessions.list", map[string]any{
		"includeGlobal": true,
	})
	if err != nil {
		log.Printf("[Gateway] sessions.list failed: %v", err)
		return err
	}

	sessions, err := parseSessionsResponse(resp)
	if err != nil {
		log.Printf("[Gateway] sessions.list parse failed: %v", err)
		return err
	}

	c.mu.Lock()
	c.sessions = sessions
	c.sessionsSyncedAt = time.Now()
	c.mu.Unlock()
	return nil
}

func parseSessionsResponse(raw json.RawMessage) ([]models.Session, error) {
	var result struct {
		OK      bool            `json:"ok"`
		Payload json.RawMessage `json:"payload"`
	}
	if err := json.Unmarshal(raw, &result); err != nil {
		return nil, err
	}
	if !result.OK {
		return nil, fmt.Errorf("gateway returned not-ok response")
	}
	return parseSessionsPayload(result.Payload)
}

func parseSessionsPayload(payload json.RawMessage) ([]models.Session, error) {
	var envelope gatewaySessionsEnvelope
	if err := json.Unmarshal(payload, &envelope); err == nil && envelope.Sessions != nil {
		return mapGatewaySessions(envelope.Sessions), nil
	}

	var legacy []models.Session
	if err := json.Unmarshal(payload, &legacy); err == nil {
		return legacy, nil
	}

	return nil, fmt.Errorf("unsupported sessions payload")
}

func mapGatewaySessions(items []gatewaySession) []models.Session {
	sessions := make([]models.Session, 0, len(items))
	for _, item := range items {
		channel := item.Channel
		if channel == "" {
			channel = item.LastChannel
		}

		updatedAt := ""
		if item.UpdatedAt > 0 {
			updatedAt = time.UnixMilli(item.UpdatedAt).UTC().Format(time.RFC3339)
		}

		sessions = append(sessions, models.Session{
			SessionKey:    item.Key,
			SessionID:     item.SessionID,
			AgentID:       agentIDFromSessionKey(item.Key),
			Channel:       channel,
			Status:        "idle",
			Model:         item.Model,
			ModelProvider: item.ModelProvider,
			DisplayName:   item.DisplayName,
			Kind:          item.Kind,
			UpdatedAt:     updatedAt,
			LastActiveAt:  updatedAt,
			Thinking:      item.ThinkingLevel,
			InputTokens:   item.InputTokens,
			OutputTokens:  item.OutputTokens,
			TotalTokens:   item.TotalTokens,
		})
	}
	return sessions
}

func agentIDFromSessionKey(sessionKey string) string {
	parts := strings.Split(sessionKey, ":")
	if len(parts) >= 2 && parts[0] == "agent" {
		return parts[1]
	}
	return ""
}

func loadGatewayToken() string {
	if token := strings.TrimSpace(os.Getenv("GATEWAY_TOKEN")); token != "" {
		return token
	}

	if configPath := strings.TrimSpace(os.Getenv("GATEWAY_CONFIG_PATH")); configPath != "" {
		return loadGatewayTokenFromPath(configPath)
	}

	homeDir, err := os.UserHomeDir()
	if err != nil {
		log.Printf("[Gateway] Failed to resolve home directory for gateway token: %v", err)
		return ""
	}

	configPath := filepath.Join(homeDir, ".openclaw", "openclaw.json")
	return loadGatewayTokenFromPath(configPath)
}

func loadGatewayTokenFromPath(configPath string) string {
	data, err := os.ReadFile(configPath)
	if err != nil {
		log.Printf("[Gateway] Failed to read gateway config %s: %v", configPath, err)
		return ""
	}

	var cfg struct {
		Gateway struct {
			Auth struct {
				Token string `json:"token"`
			} `json:"auth"`
		} `json:"gateway"`
	}
	if err := json.Unmarshal(data, &cfg); err != nil {
		log.Printf("[Gateway] Failed to parse gateway config %s: %v", configPath, err)
		return ""
	}
	return strings.TrimSpace(cfg.Gateway.Auth.Token)
}

func resolveGatewayURL() string {
	if url := strings.TrimSpace(os.Getenv("GATEWAY_URL")); url != "" {
		return url
	}
	return defaultGatewayURL
}

func envOrDefault(key, fallback string) string {
	if value := strings.TrimSpace(os.Getenv(key)); value != "" {
		return value
	}
	return fallback
}

func abbreviate(value string, max int) string {
	if max <= 0 || len(value) <= max {
		return value
	}
	return value[:max]
}

func (c *Client) GetHealth() *models.HealthStatus {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.health
}

func (c *Client) GetPresence() []models.PresenceEntry {
	c.mu.RLock()
	defer c.mu.RUnlock()
	if c.presence == nil {
		return []models.PresenceEntry{}
	}
	return c.presence
}

func (c *Client) GetChannels() []models.ChannelStatus {
	c.mu.RLock()
	defer c.mu.RUnlock()
	if c.channels == nil {
		return []models.ChannelStatus{}
	}
	return c.channels
}

func (c *Client) GetNodes() []models.NodeInfo {
	c.mu.RLock()
	defer c.mu.RUnlock()
	if c.nodes == nil {
		return []models.NodeInfo{}
	}
	return c.nodes
}

func (c *Client) GetCronJobs() []models.CronJob {
	c.mu.RLock()
	defer c.mu.RUnlock()
	if c.cronJobs == nil {
		return []models.CronJob{}
	}
	return c.cronJobs
}

func (e *ErrorInfo) Error() string {
	return e.Message
}

var (
	ErrNotConnected = &ErrorInfo{Code: "NOT_CONNECTED", Message: "Not connected to gateway"}
	ErrTimeout      = &ErrorInfo{Code: "TIMEOUT", Message: "Request timeout"}
)
