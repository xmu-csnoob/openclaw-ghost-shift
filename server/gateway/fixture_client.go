package gateway

import (
	"encoding/json"
	"fmt"
	"os"
	"sync"

	"github.com/xmu-csnoob/openclaw-ghost-shift/server/models"
)

type FixtureClient struct {
	mu            sync.Mutex
	defaultStatus models.GatewayConnectionStatus
	frames        []fixtureFrame
	currentIndex  int
	lastReadIndex int
}

type fixtureFile struct {
	Status models.GatewayConnectionStatus `json:"status"`
	Frames []fixtureFrame                 `json:"frames"`
}

type fixtureFrame struct {
	Status   *models.GatewayConnectionStatus `json:"status,omitempty"`
	Sessions []models.Session                `json:"sessions"`
}

func NewFixtureClientFromFile(path string) (*FixtureClient, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}

	var fixture fixtureFile
	if err := json.Unmarshal(data, &fixture); err != nil {
		return nil, fmt.Errorf("parse fixture %s: %w", path, err)
	}
	if len(fixture.Frames) == 0 {
		fixture.Frames = []fixtureFrame{{Sessions: []models.Session{}}}
	}
	if fixture.Status.Status == "" {
		fixture.Status = models.GatewayConnectionStatus{
			Connected: true,
			Status:    "connected",
		}
	}

	return &FixtureClient{
		defaultStatus: fixture.Status,
		frames:        fixture.Frames,
		lastReadIndex: -1,
	}, nil
}

func (c *FixtureClient) GetStatus() models.GatewayConnectionStatus {
	c.mu.Lock()
	defer c.mu.Unlock()

	frame := c.currentFrameLocked()
	if frame.Status != nil {
		return *frame.Status
	}
	return c.defaultStatus
}

func (c *FixtureClient) GetSessions() []models.Session {
	c.mu.Lock()
	defer c.mu.Unlock()

	index := c.currentIndex
	if index >= len(c.frames) {
		index = len(c.frames) - 1
	}
	c.lastReadIndex = index

	sessions := cloneSessions(c.frames[index].Sessions)
	if c.currentIndex < len(c.frames)-1 {
		c.currentIndex++
	}
	return sessions
}

func (c *FixtureClient) GetHealth() *models.HealthStatus {
	return &models.HealthStatus{
		Status:    "ok",
		Timestamp: "",
	}
}

func (c *FixtureClient) GetPresence() []models.PresenceEntry {
	return []models.PresenceEntry{}
}

func (c *FixtureClient) GetChannels() []models.ChannelStatus {
	return []models.ChannelStatus{}
}

func (c *FixtureClient) GetNodes() []models.NodeInfo {
	return []models.NodeInfo{}
}

func (c *FixtureClient) GetCronJobs() []models.CronJob {
	return []models.CronJob{}
}

func (c *FixtureClient) currentFrameLocked() fixtureFrame {
	index := c.lastReadIndex
	if index < 0 {
		index = c.currentIndex
	}
	if index >= len(c.frames) {
		index = len(c.frames) - 1
	}
	return c.frames[index]
}

func cloneSessions(sessions []models.Session) []models.Session {
	cloned := make([]models.Session, len(sessions))
	copy(cloned, sessions)
	return cloned
}
