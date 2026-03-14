package gateway

import "testing"

func TestParseSessionsPayloadEnvelope(t *testing.T) {
	t.Parallel()

	payload := []byte(`{
		"sessions": [
			{
				"key": "agent:claude-code:main",
				"sessionId": "sess-1",
				"channel": "workspace",
				"displayName": "Claude Code",
				"kind": "session",
				"model": "claude-sonnet-4",
				"modelProvider": "anthropic",
				"thinkingLevel": "high",
				"updatedAt": 1773463895411,
				"inputTokens": 42,
				"outputTokens": 84,
				"totalTokens": 126
			}
		]
	}`)

	sessions, err := parseSessionsPayload(payload)
	if err != nil {
		t.Fatalf("parseSessionsPayload() error = %v", err)
	}
	if len(sessions) != 1 {
		t.Fatalf("len(parseSessionsPayload()) = %d, want 1", len(sessions))
	}

	session := sessions[0]
	if session.SessionKey != "agent:claude-code:main" {
		t.Fatalf("SessionKey = %q", session.SessionKey)
	}
	if session.AgentID != "claude-code" {
		t.Fatalf("AgentID = %q, want %q", session.AgentID, "claude-code")
	}
	if session.Model != "claude-sonnet-4" {
		t.Fatalf("Model = %q", session.Model)
	}
	if session.TotalTokens != 126 {
		t.Fatalf("TotalTokens = %d, want 126", session.TotalTokens)
	}
	if session.UpdatedAt == "" || session.LastActiveAt == "" {
		t.Fatalf("UpdatedAt and LastActiveAt should be populated")
	}
}

func TestParseSessionsResponseRejectsNotOK(t *testing.T) {
	t.Parallel()

	_, err := parseSessionsResponse([]byte(`{"ok":false,"payload":{"sessions":[]}}`))
	if err == nil {
		t.Fatal("parseSessionsResponse() error = nil, want non-nil")
	}
}
