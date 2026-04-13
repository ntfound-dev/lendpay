package app

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"sync"
	"time"
)

type aiEngineStatus struct {
	ActiveProvider     string  `json:"activeProvider"`
	Available          bool    `json:"available"`
	BaseURL            *string `json:"baseUrl,omitempty"`
	ConfiguredProvider string  `json:"configuredProvider"`
	Model              *string `json:"model,omitempty"`
	Reason             *string `json:"reason,omitempty"`
}

type OllamaScoringClient struct {
	cfg    Config
	http   *http.Client
	cache  *cachedAIStatus
	cacheM sync.Mutex
}

type cachedAIStatus struct {
	ExpiresAt int64
	Value     aiEngineStatus
}

func NewOllamaScoringClient(cfg Config) *OllamaScoringClient {
	return &OllamaScoringClient{
		cfg: cfg,
		http: &http.Client{
			Timeout: time.Duration(cfg.OllamaTimeoutMS) * time.Millisecond,
		},
	}
}

func (c *OllamaScoringClient) GetStatus(ctx context.Context, force bool) aiEngineStatus {
	if !strings.EqualFold(c.cfg.AIProvider, "ollama") {
		reason := "Heuristic provider configured."
		return aiEngineStatus{
			ActiveProvider:     "heuristic",
			Available:          true,
			ConfiguredProvider: c.cfg.AIProvider,
			Reason:             &reason,
		}
	}

	c.cacheM.Lock()
	cache := c.cache
	c.cacheM.Unlock()
	if !force && cache != nil && cache.ExpiresAt > time.Now().UnixMilli() {
		return cache.Value
	}

	request, err := http.NewRequestWithContext(ctx, http.MethodGet, strings.TrimRight(c.cfg.OllamaBaseURL, "/")+"/api/tags", nil)
	if err != nil {
		return c.storeStatus(5_000, aiEngineStatus{
			ActiveProvider:     "heuristic",
			Available:          false,
			ConfiguredProvider: "ollama",
			BaseURL:            stringPtr(c.cfg.OllamaBaseURL),
			Model:              stringPtr(c.cfg.OllamaModel),
			Reason:             stringPtr("Ollama request could not be prepared."),
		})
	}

	response, err := c.http.Do(request)
	if err != nil {
		return c.storeStatus(5_000, aiEngineStatus{
			ActiveProvider:     "heuristic",
			Available:          false,
			ConfiguredProvider: "ollama",
			BaseURL:            stringPtr(c.cfg.OllamaBaseURL),
			Model:              stringPtr(c.cfg.OllamaModel),
			Reason:             stringPtr(err.Error()),
		})
	}
	defer response.Body.Close()

	if response.StatusCode < 200 || response.StatusCode >= 300 {
		reason := "Ollama returned " + response.Status
		return c.storeStatus(5_000, aiEngineStatus{
			ActiveProvider:     "heuristic",
			Available:          false,
			ConfiguredProvider: "ollama",
			BaseURL:            stringPtr(c.cfg.OllamaBaseURL),
			Model:              stringPtr(c.cfg.OllamaModel),
			Reason:             &reason,
		})
	}

	var payload struct {
		Models []struct {
			Model string `json:"model"`
			Name  string `json:"name"`
		} `json:"models"`
	}
	if err := json.NewDecoder(response.Body).Decode(&payload); err != nil {
		return c.storeStatus(5_000, aiEngineStatus{
			ActiveProvider:     "heuristic",
			Available:          false,
			ConfiguredProvider: "ollama",
			BaseURL:            stringPtr(c.cfg.OllamaBaseURL),
			Model:              stringPtr(c.cfg.OllamaModel),
			Reason:             stringPtr("Ollama response could not be decoded."),
		})
	}

	modelExists := len(payload.Models) == 0
	for _, model := range payload.Models {
		if model.Model == c.cfg.OllamaModel || model.Name == c.cfg.OllamaModel {
			modelExists = true
			break
		}
	}

	activeProvider := "heuristic"
	reason := "Model " + c.cfg.OllamaModel + " is not pulled yet."
	if modelExists {
		activeProvider = "ollama"
		reason = "Ollama is reachable."
	}

	return c.storeStatus(15_000, aiEngineStatus{
		ActiveProvider:     activeProvider,
		Available:          modelExists,
		ConfiguredProvider: "ollama",
		BaseURL:            stringPtr(c.cfg.OllamaBaseURL),
		Model:              stringPtr(c.cfg.OllamaModel),
		Reason:             &reason,
	})
}

func (c *OllamaScoringClient) storeStatus(ttlMS int64, value aiEngineStatus) aiEngineStatus {
	c.cacheM.Lock()
	c.cache = &cachedAIStatus{
		ExpiresAt: time.Now().UnixMilli() + ttlMS,
		Value:     value,
	}
	c.cacheM.Unlock()
	return value
}

func stringPtr(value string) *string {
	if strings.TrimSpace(value) == "" {
		return nil
	}
	return &value
}
