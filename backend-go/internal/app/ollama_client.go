package app

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"regexp"
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

type ollamaGuideRewriteRequest struct {
	Format  string         `json:"format,omitempty"`
	Model   string         `json:"model"`
	Options map[string]any `json:"options,omitempty"`
	Prompt  string         `json:"prompt"`
	Stream  bool           `json:"stream"`
}

type ollamaGuideRewriteResponse struct {
	Response string `json:"response"`
}

type ollamaGuideRewritePayload struct {
	AssistantDetail string `json:"assistantDetail"`
	PanelBody       string `json:"panelBody"`
	PanelTitle      string `json:"panelTitle"`
	Recommendation  string `json:"recommendation"`
}

var (
	ollamaFactTokenPattern  = regexp.MustCompile(`[$]?\d+(?:\.\d+)?%?`)
	ollamaMonthTokenPattern = regexp.MustCompile(`\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b`)
)

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

func (c *OllamaScoringClient) RewriteAgentGuidance(
	ctx context.Context,
	guide agentGuidanceState,
	contextSummary string,
) (agentGuidanceState, error) {
	status := c.GetStatus(ctx, false)
	if !strings.EqualFold(status.ActiveProvider, "ollama") || !status.Available {
		return guide, nil
	}

	prompt := strings.TrimSpace(fmt.Sprintf(
		`You rewrite product guidance for a credit assistant.
Return strict JSON only with these keys: assistantDetail, panelTitle, panelBody, recommendation.

Rules:
- Keep the underlying action and risk posture unchanged.
- Do not invent amounts, due dates, limits, or statuses.
- Keep assistantDetail to one short sentence.
- Keep panelTitle under 12 words.
- Keep panelBody to 1-2 short sentences.
- Keep recommendation to 3-8 words.
- No markdown. No code fences. No hype.

Deterministic guide:
- surface: %s
- assistant label: %s
- current assistant detail: %s
- current title: %s
- current body: %s
- current recommendation: %s
- current action label: %s
- confidence: %s

Borrower context:
%s`,
		guide.Surface,
		guide.AssistantLabel,
		guide.AssistantDetail,
		guide.PanelTitle,
		guide.PanelBody,
		guide.Recommendation,
		strings.TrimSpace(derefString(guide.ActionLabel)),
		strings.TrimSpace(derefInt(guide.Confidence)),
		contextSummary,
	))

	requestPayload := ollamaGuideRewriteRequest{
		Format: "json",
		Model:  c.cfg.OllamaModel,
		Options: map[string]any{
			"temperature": c.cfg.OllamaTemperature,
		},
		Prompt: prompt,
		Stream: false,
	}

	requestBody, err := json.Marshal(requestPayload)
	if err != nil {
		return guide, err
	}

	request, err := http.NewRequestWithContext(
		ctx,
		http.MethodPost,
		strings.TrimRight(c.cfg.OllamaBaseURL, "/")+"/api/generate",
		bytes.NewReader(requestBody),
	)
	if err != nil {
		return guide, err
	}
	request.Header.Set("Content-Type", "application/json")

	response, err := c.http.Do(request)
	if err != nil {
		return guide, err
	}
	defer response.Body.Close()

	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return guide, fmt.Errorf("ollama returned %s", response.Status)
	}

	var payload ollamaGuideRewriteResponse
	if err := json.NewDecoder(response.Body).Decode(&payload); err != nil {
		return guide, err
	}

	rewritten := ollamaGuideRewritePayload{}
	if err := decodeLooseJSONObject(payload.Response, &rewritten); err != nil {
		return guide, err
	}

	sanitizedGuide, usedRewrite := sanitizeOllamaGuideRewrite(guide, rewritten, contextSummary)
	if !usedRewrite {
		return guide, nil
	}

	sanitizedGuide.Provider = "ollama"
	sanitizedGuide.Model = stringPtr(c.cfg.OllamaModel)
	return sanitizedGuide, nil
}

func decodeLooseJSONObject(raw string, target any) error {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return fmt.Errorf("empty ollama response")
	}

	if err := json.Unmarshal([]byte(trimmed), target); err == nil {
		return nil
	}

	start := strings.Index(trimmed, "{")
	end := strings.LastIndex(trimmed, "}")
	if start >= 0 && end > start {
		return json.Unmarshal([]byte(trimmed[start:end+1]), target)
	}

	return fmt.Errorf("ollama response was not valid json")
}

func derefString(value *string) string {
	if value == nil {
		return ""
	}

	return *value
}

func derefInt(value *int) string {
	if value == nil {
		return ""
	}

	return fmt.Sprintf("%d", *value)
}

func stringPtr(value string) *string {
	if strings.TrimSpace(value) == "" {
		return nil
	}
	return &value
}

func sanitizeOllamaGuideRewrite(
	guide agentGuidanceState,
	rewritten ollamaGuideRewritePayload,
	contextSummary string,
) (agentGuidanceState, bool) {
	allowedFacts := collectRewriteFactTokens(strings.Join([]string{
		guide.AssistantDetail,
		guide.PanelTitle,
		guide.PanelBody,
		guide.Recommendation,
		contextSummary,
	}, "\n"))
	usedRewrite := false

	if next := sanitizeGuideRewriteField(rewritten.AssistantDetail, guide.AssistantDetail, 16, allowedFacts); next != guide.AssistantDetail {
		guide.AssistantDetail = next
		usedRewrite = true
	}
	if next := sanitizeGuideRewriteField(rewritten.PanelTitle, guide.PanelTitle, 12, allowedFacts); next != guide.PanelTitle {
		guide.PanelTitle = next
		usedRewrite = true
	}
	if next := sanitizeGuideRewriteField(rewritten.PanelBody, guide.PanelBody, 28, allowedFacts); next != guide.PanelBody {
		guide.PanelBody = next
		usedRewrite = true
	}
	if next := sanitizeGuideRewriteField(rewritten.Recommendation, guide.Recommendation, 8, allowedFacts); next != guide.Recommendation {
		guide.Recommendation = next
		usedRewrite = true
	}

	return guide, usedRewrite
}

func sanitizeGuideRewriteField(
	candidate string,
	fallback string,
	maxWords int,
	allowedFacts map[string]struct{},
) string {
	normalized := normalizeGuideRewriteText(candidate)
	if normalized == "" {
		return fallback
	}
	if strings.ContainsAny(normalized, "`{}[]") {
		return fallback
	}
	if len(strings.Fields(normalized)) > maxWords {
		return fallback
	}

	for token := range collectRewriteFactTokens(normalized) {
		if _, ok := allowedFacts[token]; !ok {
			return fallback
		}
	}

	return normalized
}

func normalizeGuideRewriteText(value string) string {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return ""
	}

	return strings.Join(strings.Fields(trimmed), " ")
}

func collectRewriteFactTokens(value string) map[string]struct{} {
	tokens := map[string]struct{}{}
	normalized := strings.ToLower(value)

	for _, match := range ollamaFactTokenPattern.FindAllString(normalized, -1) {
		tokens[match] = struct{}{}
	}
	for _, match := range ollamaMonthTokenPattern.FindAllString(normalized, -1) {
		tokens[match] = struct{}{}
	}

	return tokens
}
