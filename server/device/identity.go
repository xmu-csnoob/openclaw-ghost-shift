package device

import (
	"crypto/ed25519"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

const deviceFile = "device-identity.json"

const (
	appConfigDirName    = "ghost-shift"
	legacyConfigDirName = "pixel-office"
)

type DeviceIdentity struct {
	DeviceID   string `json:"deviceId"`
	PrivateKey string `json:"privateKey"` // hex encoded
	PublicKey  string `json:"publicKey"`  // hex encoded
}

// LoadOrCreate loads an existing device identity or creates a new one
func LoadOrCreate() (*DeviceIdentity, error) {
	filePath, legacyPath, err := resolveIdentityPaths()
	if err != nil {
		return nil, err
	}

	// Try to load existing identity
	for _, candidate := range identityLoadCandidates(filePath, legacyPath) {
		identity, err := loadIdentity(candidate)
		if err != nil {
			continue
		}
		if candidate != filePath {
			if err := os.MkdirAll(filepath.Dir(filePath), 0700); err == nil {
				_ = writeIdentity(filePath, identity)
			}
		}
		return identity, nil
	}

	// Generate new identity
	pubKey, privKey, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		return nil, fmt.Errorf("failed to generate key: %w", err)
	}

	identity := &DeviceIdentity{
		DeviceID:   deriveDeviceID(pubKey),
		PrivateKey: hex.EncodeToString(privKey),
		PublicKey:  hex.EncodeToString(pubKey),
	}

	// Save to file
	if err := os.MkdirAll(filepath.Dir(filePath), 0700); err != nil {
		return nil, fmt.Errorf("failed to create config dir: %w", err)
	}
	if err := writeIdentity(filePath, identity); err != nil {
		return nil, err
	}

	return identity, nil
}

func resolveIdentityPaths() (string, string, error) {
	if explicit := strings.TrimSpace(os.Getenv("DEVICE_IDENTITY_PATH")); explicit != "" {
		return explicit, "", nil
	}

	configDir, err := os.UserConfigDir()
	if err != nil {
		return "", "", fmt.Errorf("failed to get config dir: %w", err)
	}

	return filepath.Join(configDir, appConfigDirName, deviceFile),
		filepath.Join(configDir, legacyConfigDirName, deviceFile),
		nil
}

func identityLoadCandidates(primaryPath, legacyPath string) []string {
	candidates := []string{primaryPath}
	if legacyPath != "" && legacyPath != primaryPath {
		candidates = append(candidates, legacyPath)
	}
	return candidates
}

func loadIdentity(filePath string) (*DeviceIdentity, error) {
	data, err := os.ReadFile(filePath)
	if err != nil {
		return nil, err
	}

	var identity DeviceIdentity
	if err := json.Unmarshal(data, &identity); err != nil {
		return nil, err
	}
	if identity.PrivateKey == "" || identity.PublicKey == "" {
		return nil, fmt.Errorf("identity is incomplete")
	}

	rawPublicKey, err := hex.DecodeString(identity.PublicKey)
	if err != nil {
		return nil, err
	}

	derivedDeviceID := deriveDeviceID(rawPublicKey)
	if derivedDeviceID == "" {
		return nil, fmt.Errorf("identity has invalid public key")
	}
	identity.DeviceID = derivedDeviceID
	return &identity, nil
}

// Sign signs a message with the device's private key
func (d *DeviceIdentity) Sign(message string) (string, error) {
	privKeyBytes, err := hex.DecodeString(d.PrivateKey)
	if err != nil {
		return "", fmt.Errorf("failed to decode private key: %w", err)
	}

	signature := ed25519.Sign(ed25519.PrivateKey(privKeyBytes), []byte(message))
	return base64.RawURLEncoding.EncodeToString(signature), nil
}

func (d *DeviceIdentity) PublicKeyBase64URL() (string, error) {
	pubKeyBytes, err := hex.DecodeString(d.PublicKey)
	if err != nil {
		return "", fmt.Errorf("failed to decode public key: %w", err)
	}
	return base64.RawURLEncoding.EncodeToString(pubKeyBytes), nil
}

func writeIdentity(filePath string, identity *DeviceIdentity) error {
	data, err := json.MarshalIndent(identity, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal identity: %w", err)
	}
	if err := os.WriteFile(filePath, data, 0600); err != nil {
		return fmt.Errorf("failed to write identity file: %w", err)
	}
	return nil
}

func deriveDeviceID(publicKey []byte) string {
	pubKeyHash := sha256.Sum256(publicKey)
	return hex.EncodeToString(pubKeyHash[:])
}

// BuildSignMessage builds the v2 device-auth payload.
func BuildSignMessage(deviceID, clientID, clientMode, role string, scopes []string, signedAt int64, token, nonce string) string {
	scopesStr := strings.Join(scopes, ",")
	return fmt.Sprintf("v2|%s|%s|%s|%s|%s|%d|%s|%s",
		deviceID, clientID, clientMode, role, scopesStr, signedAt, token, nonce)
}

// BuildSignMessageV3 builds the preferred v3 device-auth payload.
func BuildSignMessageV3(deviceID, clientID, clientMode, role string, scopes []string, signedAt int64, token, nonce, platform, deviceFamily string) string {
	scopesStr := strings.Join(scopes, ",")
	return fmt.Sprintf("v3|%s|%s|%s|%s|%s|%d|%s|%s|%s|%s",
		deviceID,
		clientID,
		clientMode,
		role,
		scopesStr,
		signedAt,
		token,
		nonce,
		strings.ToLower(strings.TrimSpace(platform)),
		strings.ToLower(strings.TrimSpace(deviceFamily)),
	)
}
