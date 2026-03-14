package api

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"strings"
)

type publicIdentity struct {
	PublicID string
	AgentID  string
}

func derivePublicIdentity(sessionKey, salt string) publicIdentity {
	mac := hmac.New(sha256.New, []byte(salt))
	_, _ = mac.Write([]byte(sessionKey))
	sum := mac.Sum(nil)
	encoded := hex.EncodeToString(sum[:10])

	return publicIdentity{
		PublicID: "pub_" + encoded,
		AgentID:  fmt.Sprintf("Agent %s", strings.ToUpper(encoded[len(encoded)-6:])),
	}
}
