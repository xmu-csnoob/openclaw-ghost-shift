package api

import (
	"bufio"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"
)

const defaultHistoryCompactInterval = 10 * time.Minute

type recordedPublicSession struct {
	PublicID       string  `json:"publicId"`
	AgentID        string  `json:"agentId"`
	Status         string  `json:"status"`
	Model          string  `json:"model,omitempty"`
	Zone           string  `json:"zone"`
	Role           string  `json:"role"`
	Origin         string  `json:"origin"`
	ActivityScore  float64 `json:"activityScore,omitempty"`
	ActivityWindow string  `json:"activityWindow,omitempty"`
	Footprint      string  `json:"footprint,omitempty"`
	MessageCount   int     `json:"messageCount,omitempty"`
	InputTokens    int     `json:"inputTokens,omitempty"`
	OutputTokens   int     `json:"outputTokens,omitempty"`
	TotalTokens    int     `json:"totalTokens,omitempty"`
}

type PublicHistoryFrame struct {
	CapturedAt string                  `json:"capturedAt"`
	Status     PublicStatus            `json:"status"`
	Sessions   []recordedPublicSession `json:"sessions"`
}

type PublicTimelinePoint struct {
	CapturedAt      string                `json:"capturedAt"`
	Connected       bool                  `json:"connected"`
	Status          string                `json:"status"`
	Displayed       int                   `json:"displayed"`
	Running         int                   `json:"running"`
	AvgResponseTime float64               `json:"avgResponseTime"`
	ToolCallCount   int                   `json:"toolCallCount"`
	MessageCount    int                   `json:"messageCount"`
	ZoneMix         []PublicZoneMixEntry  `json:"zoneMix"`
	ModelMix        []PublicModelMixEntry `json:"modelMix"`
}

type PublicTimelineResponse struct {
	RetentionHours  int                   `json:"retentionHours"`
	IntervalSeconds int                   `json:"intervalSeconds"`
	Points          []PublicTimelinePoint `json:"points"`
}

type PublicReplayFrame struct {
	CapturedAt string          `json:"capturedAt"`
	Status     PublicStatus    `json:"status"`
	Sessions   []PublicSession `json:"sessions"`
}

type PublicReplayResponse struct {
	RetentionHours  int                 `json:"retentionHours"`
	IntervalSeconds int                 `json:"intervalSeconds"`
	Frames          []PublicReplayFrame `json:"frames"`
}

type PublicHistoryRecorder struct {
	path            string
	retention       time.Duration
	interval        time.Duration
	retentionHours  int
	intervalSeconds int
	compactInterval time.Duration
	now             func() time.Time
	mu              sync.RWMutex
	frames          []PublicHistoryFrame
	lastCompactAt   time.Time
	needsCompaction bool
}

func NewPublicHistoryRecorder(cfg Config) (*PublicHistoryRecorder, error) {
	recorder := &PublicHistoryRecorder{
		path:            cfg.PublicHistoryPath,
		retention:       cfg.PublicHistoryRetention,
		interval:        cfg.PublicHistoryInterval,
		retentionHours:  cfg.PublicHistoryHours,
		intervalSeconds: int(cfg.PublicHistoryInterval / time.Second),
		compactInterval: defaultHistoryCompactInterval,
		now:             func() time.Time { return time.Now().UTC() },
	}

	if err := recorder.load(); err != nil {
		return nil, err
	}
	return recorder, nil
}

func (r *PublicHistoryRecorder) Start(ctx context.Context, snapshotFn func() PublicSnapshot) {
	if err := r.recordSnapshot(snapshotFn()); err != nil {
		log.Printf("[PublicHistory] initial snapshot failed: %v", err)
	}

	ticker := time.NewTicker(r.interval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			if err := r.recordSnapshot(snapshotFn()); err != nil {
				log.Printf("[PublicHistory] snapshot failed: %v", err)
			}
		}
	}
}

func (r *PublicHistoryRecorder) recordSnapshot(snapshot PublicSnapshot) error {
	return r.recordSnapshotAt(snapshot, r.now())
}

func (r *PublicHistoryRecorder) recordSnapshotAt(snapshot PublicSnapshot, capturedAt time.Time) error {
	frame := buildHistoryFrame(snapshot, capturedAt)

	r.mu.Lock()
	defer r.mu.Unlock()

	pruned := r.pruneLocked(capturedAt)
	r.frames = append(r.frames, frame)

	if err := r.appendLocked(frame); err != nil {
		r.frames = r.frames[:len(r.frames)-1]
		return err
	}

	if pruned > 0 {
		r.needsCompaction = true
	}
	if r.needsCompaction && capturedAt.Sub(r.lastCompactAt) >= r.compactInterval {
		if err := r.rewriteLocked(); err != nil {
			return err
		}
	}

	return nil
}

func (r *PublicHistoryRecorder) Timeline(since, until time.Time) PublicTimelineResponse {
	frames := r.filteredFrames(since, until)
	points := make([]PublicTimelinePoint, 0, len(frames))
	for index, frame := range frames {
		var previous *PublicHistoryFrame
		if index > 0 {
			previous = &frames[index-1]
		}
		avgResponseTime, toolCallCount := intervalResponseAndToolMetrics(previous, frame)
		points = append(points, PublicTimelinePoint{
			CapturedAt:      frame.CapturedAt,
			Connected:       frame.Status.Connected,
			Status:          frame.Status.Status,
			Displayed:       frame.Status.Displayed,
			Running:         frame.Status.Running,
			AvgResponseTime: avgResponseTime,
			ToolCallCount:   toolCallCount,
			MessageCount:    totalMessageCount(frame.Sessions),
			ZoneMix:         buildZoneMix(frame.Sessions),
			ModelMix:        buildModelMix(frame.Sessions),
		})
	}

	return PublicTimelineResponse{
		RetentionHours:  r.retentionHours,
		IntervalSeconds: r.intervalSeconds,
		Points:          points,
	}
}

func (r *PublicHistoryRecorder) Replay(since, until time.Time) PublicReplayResponse {
	frames := r.filteredFrames(since, until)
	replayFrames := make([]PublicReplayFrame, 0, len(frames))
	for _, frame := range frames {
		replayFrames = append(replayFrames, PublicReplayFrame{
			CapturedAt: frame.CapturedAt,
			Status:     frame.Status,
			Sessions:   restorePublicSessions(frame.Sessions),
		})
	}

	return PublicReplayResponse{
		RetentionHours:  r.retentionHours,
		IntervalSeconds: r.intervalSeconds,
		Frames:          replayFrames,
	}
}

func (r *PublicHistoryRecorder) load() error {
	if err := ensureParentDir(r.path); err != nil {
		return err
	}

	file, err := os.Open(r.path)
	if errors.Is(err, os.ErrNotExist) {
		return nil
	}
	if err != nil {
		return err
	}
	defer file.Close()

	decoder := json.NewDecoder(bufio.NewReader(file))
	var frames []PublicHistoryFrame
	for {
		var frame PublicHistoryFrame
		if err := decoder.Decode(&frame); err != nil {
			if errors.Is(err, io.EOF) {
				break
			}
			return err
		}
		if strings.TrimSpace(frame.CapturedAt) == "" {
			continue
		}
		frames = append(frames, frame)
	}

	now := r.now()
	r.mu.Lock()
	r.frames = frames
	pruned := r.pruneLocked(now)
	r.mu.Unlock()

	if pruned > 0 {
		r.mu.Lock()
		defer r.mu.Unlock()
		return r.rewriteLocked()
	}
	return nil
}

func (r *PublicHistoryRecorder) filteredFrames(since, until time.Time) []PublicHistoryFrame {
	r.mu.RLock()
	defer r.mu.RUnlock()

	now := r.now()
	windowStart := now.Add(-r.retention)
	if !since.IsZero() && since.After(windowStart) {
		windowStart = since
	}

	windowEnd := now
	if !until.IsZero() && until.Before(windowEnd) {
		windowEnd = until
	}
	if windowEnd.Before(windowStart) {
		return []PublicHistoryFrame{}
	}

	frames := make([]PublicHistoryFrame, 0, len(r.frames))
	for _, frame := range r.frames {
		capturedAt, err := time.Parse(time.RFC3339, frame.CapturedAt)
		if err != nil {
			continue
		}
		if capturedAt.Before(windowStart) || capturedAt.After(windowEnd) {
			continue
		}
		frames = append(frames, frame)
	}
	return frames
}

func (r *PublicHistoryRecorder) cacheVersion() string {
	r.mu.RLock()
	defer r.mu.RUnlock()

	if len(r.frames) == 0 {
		return "empty"
	}
	return fmt.Sprintf("%d:%s", len(r.frames), r.frames[len(r.frames)-1].CapturedAt)
}

func (r *PublicHistoryRecorder) pruneLocked(now time.Time) int {
	if len(r.frames) == 0 {
		return 0
	}

	cutoff := now.Add(-r.retention)
	keepFrom := 0
	for keepFrom < len(r.frames) {
		capturedAt, err := time.Parse(time.RFC3339, r.frames[keepFrom].CapturedAt)
		if err != nil || !capturedAt.Before(cutoff) {
			break
		}
		keepFrom++
	}
	if keepFrom == 0 {
		return 0
	}

	r.frames = append([]PublicHistoryFrame(nil), r.frames[keepFrom:]...)
	return keepFrom
}

func (r *PublicHistoryRecorder) appendLocked(frame PublicHistoryFrame) error {
	if err := ensureParentDir(r.path); err != nil {
		return err
	}

	file, err := os.OpenFile(r.path, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0o600)
	if err != nil {
		return err
	}
	defer file.Close()

	return json.NewEncoder(file).Encode(frame)
}

func (r *PublicHistoryRecorder) rewriteLocked() error {
	if err := ensureParentDir(r.path); err != nil {
		return err
	}

	sort.Slice(r.frames, func(i, j int) bool {
		return r.frames[i].CapturedAt < r.frames[j].CapturedAt
	})

	file, err := os.OpenFile(r.path, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0o600)
	if err != nil {
		return err
	}
	defer file.Close()

	encoder := json.NewEncoder(file)
	for _, frame := range r.frames {
		if err := encoder.Encode(frame); err != nil {
			return err
		}
	}

	r.lastCompactAt = r.now()
	r.needsCompaction = false
	return nil
}

func buildHistoryFrame(snapshot PublicSnapshot, capturedAt time.Time) PublicHistoryFrame {
	sessions := make([]recordedPublicSession, 0, len(snapshot.Sessions))
	for _, session := range snapshot.Sessions {
		sessions = append(sessions, recordedPublicSession{
			PublicID:       session.PublicID,
			AgentID:        session.AgentID,
			Status:         session.Status,
			Model:          session.Model,
			Zone:           session.Zone,
			Role:           session.Role,
			Origin:         session.Origin,
			ActivityScore:  session.ActivityScore,
			ActivityWindow: session.ActivityWindow,
			Footprint:      session.Footprint,
			MessageCount:   session.MessageCount,
			InputTokens:    session.InputTokens,
			OutputTokens:   session.OutputTokens,
			TotalTokens:    session.TotalTokens,
		})
	}

	return PublicHistoryFrame{
		CapturedAt: capturedAt.UTC().Format(time.RFC3339),
		Status:     snapshot.Status,
		Sessions:   sessions,
	}
}

func restorePublicSessions(recorded []recordedPublicSession) []PublicSession {
	sessions := make([]PublicSession, 0, len(recorded))
	for _, session := range recorded {
		sessions = append(sessions, PublicSession{
			PublicID:       session.PublicID,
			SessionKey:     session.PublicID,
			AgentID:        session.AgentID,
			Status:         session.Status,
			Model:          session.Model,
			Zone:           session.Zone,
			Role:           session.Role,
			Origin:         session.Origin,
			ActivityScore:  session.ActivityScore,
			ActivityWindow: session.ActivityWindow,
			Footprint:      session.Footprint,
			MessageCount:   session.MessageCount,
			InputTokens:    session.InputTokens,
			OutputTokens:   session.OutputTokens,
			TotalTokens:    session.TotalTokens,
		})
	}
	return sessions
}

func ensureParentDir(path string) error {
	dir := filepath.Dir(path)
	if dir == "." || dir == "" {
		return nil
	}
	return os.MkdirAll(dir, 0o755)
}
