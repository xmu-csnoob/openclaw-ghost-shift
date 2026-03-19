package api

import (
	"encoding/json"
	"net/http"
)

// AdminHandler handles admin API endpoints
type AdminHandler struct {
	zoneManager *ZoneManager
}

// NewAdminHandler creates a new AdminHandler
func NewAdminHandler(zoneManager *ZoneManager) *AdminHandler {
	return &AdminHandler{
		zoneManager: zoneManager,
	}
}

// GetZones returns the current zone configuration
func (h *AdminHandler) GetZones(w http.ResponseWriter, r *http.Request) {
	if !h.requireMethod(w, r, "admin_get_zones", http.MethodGet) {
		return
	}

	config := h.zoneManager.Get()
	writeJSON(w, http.StatusOK, config)
}

// ZoneUpdateRequest represents a request to update zone rules
type ZoneUpdateRequest struct {
	Rules []ZoneRule `json:"rules,omitempty"`
}

// PatchZones partially updates zone configuration
func (h *AdminHandler) PatchZones(w http.ResponseWriter, r *http.Request) {
	const route = "admin_patch_zones"
	if !h.requireMethod(w, r, route, http.MethodPatch) {
		return
	}

	var req ZoneUpdateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		WriteJSONError(w, r, http.StatusBadRequest, "invalid_json", "failed to parse request body", ErrorDetail{
			"error": err.Error(),
		})
		return
	}

	current := h.zoneManager.Get()
	rules := current.Rules

	// Update rules if provided
	if req.Rules != nil {
		rules = req.Rules
	}

	if err := h.zoneManager.UpdateRules(rules, "admin-api"); err != nil {
		WriteJSONError(w, r, http.StatusInternalServerError, "save_failed", "failed to save zone configuration", ErrorDetail{
			"error": err.Error(),
		})
		return
	}

	config := h.zoneManager.Get()
	writeJSON(w, http.StatusOK, config)
}

// ReloadZones resets zone configuration to default
func (h *AdminHandler) ReloadZones(w http.ResponseWriter, r *http.Request) {
	const route = "admin_reload_zones"
	if !h.requireMethod(w, r, route, http.MethodPost) {
		return
	}

	if err := h.zoneManager.Reset(); err != nil {
		WriteJSONError(w, r, http.StatusInternalServerError, "reset_failed", "failed to reset zone configuration", ErrorDetail{
			"error": err.Error(),
		})
		return
	}

	config := h.zoneManager.Get()
	writeJSON(w, http.StatusOK, config)
}

func (h *AdminHandler) requireMethod(w http.ResponseWriter, r *http.Request, route string, method string) bool {
	if r.Method != method {
		WriteJSONError(w, r, http.StatusMethodNotAllowed, "method_not_allowed", "method not allowed", ErrorDetail{
			"expected": method,
			"actual":   r.Method,
		})
		return false
	}
	return true
}
