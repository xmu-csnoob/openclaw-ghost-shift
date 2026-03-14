package main

import (
	"context"
	"crypto/subtle"
	"errors"
	"fmt"
	"log"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/xmu-csnoob/openclaw-ghost-shift/server/api"
	"github.com/xmu-csnoob/openclaw-ghost-shift/server/gateway"
)

func main() {
	port := strings.TrimSpace(os.Getenv("PORT"))
	if port == "" {
		port = "3002"
	}

	bindAddr := strings.TrimSpace(os.Getenv("BIND_ADDR"))
	if bindAddr == "" {
		bindAddr = "127.0.0.1"
	}

	cfg, err := api.LoadConfigFromEnv()
	if err != nil {
		log.Fatal(err)
	}

	source, startBackground, err := newDataSource()
	if err != nil {
		log.Fatal(err)
	}
	if startBackground != nil {
		go startBackground()
	}

	h, err := api.NewHandler(source, cfg)
	if err != nil {
		log.Fatal(err)
	}
	h.StartBackground(context.Background())
	mux := http.NewServeMux()

	mux.HandleFunc("/api/sessions", h.PublicSessions)
	mux.HandleFunc("/api/status", h.PublicStatus)
	mux.HandleFunc("/api/public/snapshot", h.PublicSnapshot)
	mux.HandleFunc("/api/public/timeline", h.PublicTimeline)
	mux.HandleFunc("/api/public/replay", h.PublicReplay)

	if enableInternalAPI() {
		internalToken, err := loadInternalAPIToken()
		if err != nil {
			log.Fatal(err)
		}

		internalMux := http.NewServeMux()
		internalMux.HandleFunc("/health", h.InternalHealth)
		internalMux.HandleFunc("/presence", h.InternalPresence)
		internalMux.HandleFunc("/channels", h.InternalChannels)
		internalMux.HandleFunc("/nodes", h.InternalNodes)
		internalMux.HandleFunc("/cron", h.InternalCron)

		mux.Handle("/internal-api/", http.StripPrefix("/internal-api", requireInternalToken(internalToken, internalMux)))
		log.Printf("Internal API enabled under /internal-api/* with token auth")
	}

	if staticDir, ok := resolveStaticDir(); ok {
		log.Printf("Serving static frontend from %s", staticDir)
		mux.Handle("/", spaHandler(staticDir))
	} else {
		log.Printf("Static frontend not found; serving API-only mode")
	}

	addr := net.JoinHostPort(bindAddr, port)
	log.Printf("Ghost Shift server starting on %s", addr)
	log.Fatal(http.ListenAndServe(addr, securityHeaders(mux)))
}

func enableInternalAPI() bool {
	value := strings.TrimSpace(strings.ToLower(os.Getenv("ENABLE_INTERNAL_API")))
	return value == "1" || value == "true" || value == "yes"
}

func loadInternalAPIToken() (string, error) {
	token := strings.TrimSpace(os.Getenv("INTERNAL_API_TOKEN"))
	if token == "" {
		return "", errors.New("ENABLE_INTERNAL_API requires INTERNAL_API_TOKEN")
	}
	return token, nil
}

func resolveStaticDir() (string, bool) {
	if explicit := strings.TrimSpace(os.Getenv("STATIC_DIR")); explicit != "" {
		if dirExists(explicit) {
			return explicit, true
		}
		return "", false
	}

	if cwd, err := os.Getwd(); err == nil {
		candidates := []string{
			filepath.Join(cwd, "dist"),
			filepath.Join(cwd, "..", "dist"),
		}
		for _, candidate := range candidates {
			if dirExists(candidate) {
				return candidate, true
			}
		}
	}

	execPath, err := os.Executable()
	if err != nil {
		return "", false
	}
	for _, candidate := range []string{
		filepath.Join(filepath.Dir(execPath), "..", "dist"),
		filepath.Join(filepath.Dir(execPath), "dist"),
	} {
		if dirExists(candidate) {
			return candidate, true
		}
	}
	return "", false
}

func dirExists(path string) bool {
	info, err := os.Stat(path)
	return err == nil && info.IsDir()
}

func spaHandler(staticDir string) http.Handler {
	fileServer := http.FileServer(http.Dir(staticDir))
	indexFile := filepath.Join(staticDir, "index.html")

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasPrefix(r.URL.Path, "/api/") || strings.HasPrefix(r.URL.Path, "/internal-api/") {
			http.NotFound(w, r)
			return
		}

		cleanPath := filepath.Clean(strings.TrimPrefix(r.URL.Path, "/"))
		if cleanPath == "." || cleanPath == "" {
			http.ServeFile(w, r, indexFile)
			return
		}

		target := filepath.Join(staticDir, cleanPath)
		if info, err := os.Stat(target); err == nil && !info.IsDir() {
			fileServer.ServeHTTP(w, r)
			return
		}

		http.ServeFile(w, r, indexFile)
	})
}

func securityHeaders(next http.Handler) http.Handler {
	frameAncestors := frameAncestorsDirective()
	contentSecurityPolicy := fmt.Sprintf(
		"default-src 'self'; base-uri 'none'; object-src 'none'; frame-ancestors %s; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self'",
		frameAncestors,
	)

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		if frameAncestors == "'none'" {
			w.Header().Set("X-Frame-Options", "DENY")
		}
		w.Header().Set("Cross-Origin-Opener-Policy", "same-origin")
		w.Header().Set("Cross-Origin-Resource-Policy", "same-origin")
		w.Header().Set("Referrer-Policy", "no-referrer")
		w.Header().Set("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
		w.Header().Set("Content-Security-Policy", contentSecurityPolicy)
		next.ServeHTTP(w, r)
	})
}

func newDataSource() (api.DataSource, func(), error) {
	fixturePath := strings.TrimSpace(os.Getenv("GHOST_SHIFT_FIXTURE_PATH"))
	if fixturePath != "" {
		fixtureClient, err := gateway.NewFixtureClientFromFile(fixturePath)
		if err != nil {
			return nil, nil, err
		}
		return fixtureClient, nil, nil
	}

	client := gateway.NewClient()
	return client, client.Connect, nil
}

func frameAncestorsDirective() string {
	raw := strings.TrimSpace(os.Getenv("GHOST_SHIFT_EMBED_ALLOWED_ORIGINS"))
	if raw == "" {
		return "'none'"
	}

	parts := make([]string, 0, 4)
	for _, value := range strings.Split(raw, ",") {
		candidate := strings.TrimSpace(value)
		if candidate == "" {
			continue
		}
		if strings.EqualFold(candidate, "self") || candidate == "'self'" {
			parts = append(parts, "'self'")
			continue
		}
		parts = append(parts, candidate)
	}
	if len(parts) == 0 {
		return "'none'"
	}
	return strings.Join(parts, " ")
}

func requireInternalToken(token string, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		candidate := strings.TrimSpace(strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer "))
		if candidate == "" {
			candidate = strings.TrimSpace(r.Header.Get("X-Internal-API-Token"))
		}
		if subtle.ConstantTimeCompare([]byte(candidate), []byte(token)) != 1 {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		next.ServeHTTP(w, r)
	})
}
