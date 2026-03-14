package api

import (
	"testing"
	"time"

	"github.com/xmu-csnoob/openclaw-ghost-shift/server/models"
)

func TestClassifyRoleOriginAndZone(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name    string
		session models.Session
		role    string
		origin  string
		zone    string
	}{
		{
			name: "coding session",
			session: models.Session{
				SessionKey:  "agent:claude-code:main",
				Channel:     "workspace",
				DisplayName: "Terminal",
			},
			role:   "coding-agent",
			origin: "Claude Code",
			zone:   "code-studio",
		},
		{
			name: "feishu session",
			session: models.Session{
				SessionKey:  "feishu:ou_xxx",
				Channel:     "feishu",
				DisplayName: "Feishu bridge",
			},
			role:   "webchat",
			origin: "Feishu",
			zone:   "chat-lounge",
		},
		{
			name: "ops session",
			session: models.Session{
				SessionKey:  "ops:cron:nightly",
				Channel:     "system",
				DisplayName: "Nightly automation",
			},
			role:   "automation",
			origin: "Local",
			zone:   "ops-lab",
		},
	}

	for _, tc := range cases {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			if got := classifyRole(tc.session); got != tc.role {
				t.Fatalf("classifyRole() = %q, want %q", got, tc.role)
			}
			if got := classifyOrigin(tc.session); got != tc.origin {
				t.Fatalf("classifyOrigin() = %q, want %q", got, tc.origin)
			}
			if got := classifyZone(tc.session); got != tc.zone {
				t.Fatalf("classifyZone() = %q, want %q", got, tc.zone)
			}
		})
	}
}

func TestClassifyActivityUsesRecencyAndFootprint(t *testing.T) {
	t.Parallel()

	now := time.Date(2026, time.March, 14, 12, 0, 0, 0, time.UTC)
	session := models.Session{
		Status:       "idle",
		UpdatedAt:    now.Add(-30 * time.Second).Format(time.RFC3339),
		MessageCount: 12,
		TotalTokens:  9000,
	}

	activity := classifyActivity(session, now)
	if activity.Status != "running" {
		t.Fatalf("classifyActivity().Status = %q, want %q", activity.Status, "running")
	}
	if activity.Window != "just-now" {
		t.Fatalf("classifyActivity().Window = %q, want %q", activity.Window, "just-now")
	}
	if activity.Score != 0.96 {
		t.Fatalf("classifyActivity().Score = %v, want %v", activity.Score, 0.96)
	}
	if activity.Footprint != "working-set" {
		t.Fatalf("classifyActivity().Footprint = %q, want %q", activity.Footprint, "working-set")
	}
}
