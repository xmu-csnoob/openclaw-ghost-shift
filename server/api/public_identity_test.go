package api

import (
	"strings"
	"testing"
)

func TestDerivePublicIdentityIsStableAndSalted(t *testing.T) {
	t.Parallel()

	first := derivePublicIdentity("agent:claude-code:main", "salt-a")
	second := derivePublicIdentity("agent:claude-code:main", "salt-a")
	otherSalt := derivePublicIdentity("agent:claude-code:main", "salt-b")
	otherSession := derivePublicIdentity("agent:claude-code:review", "salt-a")

	if first != second {
		t.Fatalf("derivePublicIdentity() not stable: %#v != %#v", first, second)
	}
	if first.PublicID == otherSalt.PublicID {
		t.Fatalf("PublicID should change with salt: %q", first.PublicID)
	}
	if first.PublicID == otherSession.PublicID {
		t.Fatalf("PublicID should change with session key: %q", first.PublicID)
	}
	if strings.Contains(first.PublicID, "claude-code") {
		t.Fatalf("PublicID leaked raw session key: %q", first.PublicID)
	}
	if !strings.HasPrefix(first.PublicID, "pub_") {
		t.Fatalf("PublicID missing prefix: %q", first.PublicID)
	}
	if !strings.HasPrefix(first.AgentID, "Agent ") {
		t.Fatalf("AgentID missing prefix: %q", first.AgentID)
	}
}
