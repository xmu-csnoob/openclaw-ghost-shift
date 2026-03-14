package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestPublicHistoryRecorderPersistsSanitizedFramesAndPrunes(t *testing.T) {
	t.Parallel()

	path := filepath.Join(t.TempDir(), "public-history.jsonl")
	recorder, err := NewPublicHistoryRecorder(Config{
		PublicIDSalt:           "test-salt",
		PublicHistoryPath:      path,
		PublicHistoryHours:     1,
		PublicHistoryInterval:  30 * time.Second,
		PublicHistoryRetention: time.Hour,
	})
	if err != nil {
		t.Fatalf("NewPublicHistoryRecorder() error = %v", err)
	}
	recorder.compactInterval = time.Nanosecond

	t0 := time.Date(2026, time.March, 14, 10, 0, 0, 0, time.UTC)
	t1 := t0.Add(2 * time.Hour)
	recorder.now = func() time.Time { return t1 }

	first := PublicSnapshot{
		Status: PublicStatus{
			Connected:     true,
			Status:        "connected",
			Displayed:     1,
			Running:       1,
			LastUpdatedAt: t0.Format(time.RFC3339),
		},
		Sessions: []PublicSession{{
			PublicID:       "pub_a1",
			SessionKey:     "should-not-persist",
			AgentID:        "Agent A1",
			Status:         "running",
			Model:          "claude-sonnet-4",
			Zone:           "code-studio",
			Role:           "coding-agent",
			Origin:         "Claude Code",
			ActivityScore:  1,
			ActivityWindow: "live",
			Footprint:      "working-set",
		}},
	}

	if err := recorder.recordSnapshotAt(first, t0); err != nil {
		t.Fatalf("recordSnapshotAt(first) error = %v", err)
	}

	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("ReadFile() error = %v", err)
	}
	text := string(data)
	for _, forbidden := range []string{"sessionKey", "channel", "should-not-persist"} {
		if strings.Contains(text, forbidden) {
			t.Fatalf("history file leaked forbidden value %q: %s", forbidden, text)
		}
	}

	second := PublicSnapshot{
		Status: PublicStatus{
			Connected:     true,
			Status:        "connected",
			Displayed:     0,
			Running:       0,
			LastUpdatedAt: t1.Format(time.RFC3339),
		},
	}
	if err := recorder.recordSnapshotAt(second, t1); err != nil {
		t.Fatalf("recordSnapshotAt(second) error = %v", err)
	}

	replay := recorder.Replay(time.Time{}, time.Time{})
	if len(replay.Frames) != 1 {
		t.Fatalf("len(Replay().Frames) = %d, want 1", len(replay.Frames))
	}
	if replay.Frames[0].CapturedAt != t1.Format(time.RFC3339) {
		t.Fatalf("Replay().Frames[0].CapturedAt = %q, want %q", replay.Frames[0].CapturedAt, t1.Format(time.RFC3339))
	}

	data, err = os.ReadFile(path)
	if err != nil {
		t.Fatalf("ReadFile() after prune error = %v", err)
	}
	if strings.Contains(string(data), t0.Format(time.RFC3339)) {
		t.Fatalf("history file still contains pruned frame: %s", string(data))
	}
}

func TestPublicTimelineAndReplayEndpoints(t *testing.T) {
	t.Parallel()

	path := filepath.Join(t.TempDir(), "public-history.jsonl")
	recorder, err := NewPublicHistoryRecorder(Config{
		PublicIDSalt:           "test-salt",
		PublicHistoryPath:      path,
		PublicHistoryHours:     24,
		PublicHistoryInterval:  30 * time.Second,
		PublicHistoryRetention: 24 * time.Hour,
	})
	if err != nil {
		t.Fatalf("NewPublicHistoryRecorder() error = %v", err)
	}

	t0 := time.Date(2026, time.March, 14, 9, 0, 0, 0, time.UTC)
	t1 := t0.Add(30 * time.Second)
	recorder.now = func() time.Time { return t1 }

	for idx, capturedAt := range []time.Time{t0, t1} {
		snapshot := PublicSnapshot{
			Status: PublicStatus{
				Connected:     true,
				Status:        "connected",
				Displayed:     1,
				Running:       idx + 1,
				LastUpdatedAt: capturedAt.Format(time.RFC3339),
			},
			Sessions: []PublicSession{{
				PublicID:       "pub_track_1",
				SessionKey:     "ignored-alias",
				AgentID:        "Agent TRACK1",
				Status:         "running",
				Model:          "claude-sonnet-4",
				Zone:           "code-studio",
				Role:           "coding-agent",
				Origin:         "Claude Code",
				ActivityScore:  0.96,
				ActivityWindow: "just-now",
				Footprint:      "working-set",
			}},
		}
		if err := recorder.recordSnapshotAt(snapshot, capturedAt); err != nil {
			t.Fatalf("recordSnapshotAt(%d) error = %v", idx, err)
		}
	}

	handler := &Handler{history: recorder}

	timelineReq := httptest.NewRequest(
		http.MethodGet,
		"/api/public/timeline?since="+url.QueryEscape(t0.Format(time.RFC3339))+"&until="+url.QueryEscape(t1.Format(time.RFC3339)),
		nil,
	)
	timelineRes := httptest.NewRecorder()
	handler.PublicTimeline(timelineRes, timelineReq)

	if timelineRes.Code != http.StatusOK {
		t.Fatalf("PublicTimeline status = %d, want 200", timelineRes.Code)
	}

	var timeline PublicTimelineResponse
	if err := json.Unmarshal(timelineRes.Body.Bytes(), &timeline); err != nil {
		t.Fatalf("json.Unmarshal(timeline) error = %v", err)
	}
	if len(timeline.Points) != 2 {
		t.Fatalf("len(timeline.Points) = %d, want 2", len(timeline.Points))
	}

	replayReq := httptest.NewRequest(
		http.MethodGet,
		"/api/public/replay?since="+url.QueryEscape(t0.Format(time.RFC3339)),
		nil,
	)
	replayRes := httptest.NewRecorder()
	handler.PublicReplay(replayRes, replayReq)

	if replayRes.Code != http.StatusOK {
		t.Fatalf("PublicReplay status = %d, want 200", replayRes.Code)
	}

	var replay PublicReplayResponse
	if err := json.Unmarshal(replayRes.Body.Bytes(), &replay); err != nil {
		t.Fatalf("json.Unmarshal(replay) error = %v", err)
	}
	if len(replay.Frames) != 2 {
		t.Fatalf("len(replay.Frames) = %d, want 2", len(replay.Frames))
	}
	if replay.Frames[0].Sessions[0].PublicID != "pub_track_1" {
		t.Fatalf("replay publicId = %q, want %q", replay.Frames[0].Sessions[0].PublicID, "pub_track_1")
	}
	if replay.Frames[0].Sessions[0].SessionKey != "pub_track_1" {
		t.Fatalf("replay sessionKey alias = %q, want %q", replay.Frames[0].Sessions[0].SessionKey, "pub_track_1")
	}
}
