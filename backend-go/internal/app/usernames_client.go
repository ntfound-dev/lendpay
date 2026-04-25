package app

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"sync"
	"time"
)

type usernameResolution struct {
	Source           string
	Username         *string
	Verified         bool
	VerifiedOnL1     bool
	VerifiedOnRollup bool
}

type UsernamesClient struct {
	mu      sync.Mutex
	http    *http.Client
	preview map[string]string
}

func NewUsernamesClient() *UsernamesClient {
	return &UsernamesClient{
		http:    &http.Client{Timeout: 12 * time.Second},
		preview: map[string]string{},
	}
}

func (c *UsernamesClient) ResolveNameWithSource(ctx context.Context, address string, cfg Config) (usernameResolution, error) {
	if !cfg.EnableLiveInitiaReads {
		username := c.previewNameForAddress(address)
		return usernameResolution{
			Source:   "preview",
			Username: &username,
			Verified: false,
		}, nil
	}

	l1Resolution, l1Err := c.resolveNameFromInitiaL1(ctx, address, cfg)
	rollupResolution, rollupErr := c.resolveNameFromRollup(ctx, address, cfg)

	if l1Err != nil && rollupErr != nil {
		return usernameResolution{}, errors.Join(l1Err, rollupErr)
	}

	result := usernameResolution{
		VerifiedOnL1:     l1Resolution.VerifiedOnL1,
		VerifiedOnRollup: rollupResolution.VerifiedOnRollup,
	}
	result.Verified = result.VerifiedOnL1 || result.VerifiedOnRollup

	switch {
	case l1Resolution.Username != nil:
		result.Source = "initia_l1"
		result.Username = l1Resolution.Username
	case rollupResolution.Username != nil:
		result.Source = "rollup"
		result.Username = rollupResolution.Username
	case result.VerifiedOnRollup:
		result.Source = "rollup"
	case result.VerifiedOnL1:
		result.Source = "initia_l1"
	}

	return result, nil
}

func (c *UsernamesClient) resolveNameFromInitiaL1(
	ctx context.Context,
	address string,
	cfg Config,
) (usernameResolution, error) {
	restURL := strings.TrimSpace(cfg.InitiaL1RestURL)
	moduleAddress := strings.TrimSpace(cfg.InitiaUsernamesModuleAddress)
	if restURL == "" || moduleAddress == "" {
		return usernameResolution{}, nil
	}

	encodedAddress, err := encodeMoveViewAddressArg(address)
	if err != nil {
		return usernameResolution{Source: "initia_l1"}, err
	}

	payload, err := json.Marshal(rollupViewRequest{
		Address:      moduleAddress,
		Args:         []string{encodedAddress},
		FunctionName: "get_name_from_address",
		ModuleName:   "usernames",
		TypeArgs:     []string{},
	})
	if err != nil {
		return usernameResolution{Source: "initia_l1"}, err
	}

	request, err := http.NewRequestWithContext(
		ctx,
		http.MethodPost,
		strings.TrimRight(restURL, "/")+"/initia/move/v1/view",
		bytes.NewReader(payload),
	)
	if err != nil {
		return usernameResolution{Source: "initia_l1"}, err
	}
	request.Header.Set("content-type", "application/json")

	response, err := c.http.Do(request)
	if err != nil {
		return usernameResolution{Source: "initia_l1"}, err
	}
	defer response.Body.Close()

	if response.StatusCode == http.StatusNotFound {
		// Address has no registered username — valid, not an error
		return usernameResolution{Source: "initia_l1"}, nil
	}
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return usernameResolution{Source: "initia_l1"}, errRollupViewUnavailable
	}

	envelope := rollupViewEnvelope{}
	if err := json.NewDecoder(response.Body).Decode(&envelope); err != nil {
		return usernameResolution{Source: "initia_l1"}, err
	}

	username, err := decodeInitiaUsername(envelope.Data)
	if err != nil {
		return usernameResolution{Source: "initia_l1"}, err
	}

	return usernameResolution{
		Source:       "initia_l1",
		Username:     username,
		Verified:     username != nil,
		VerifiedOnL1: username != nil,
	}, nil
}

func (c *UsernamesClient) resolveNameFromRollup(
	ctx context.Context,
	address string,
	cfg Config,
) (usernameResolution, error) {
	reputation, err := NewRollupTxClient(cfg).GetReputation(ctx, address)
	if err != nil {
		return usernameResolution{
			Source: "rollup",
		}, err
	}

	username := normalizeInitiaUsername(reputation.Username)
	return usernameResolution{
		Source:           "rollup",
		Username:         username,
		Verified:         reputation.UsernameVerified,
		VerifiedOnRollup: reputation.UsernameVerified,
	}, nil
}

func decodeInitiaUsername(raw string) (*string, error) {
	if strings.TrimSpace(raw) == "" || strings.TrimSpace(raw) == "null" {
		return nil, nil
	}

	var username *string
	if err := json.Unmarshal([]byte(raw), &username); err != nil {
		return nil, err
	}

	if username == nil {
		return nil, nil
	}

	return normalizeInitiaUsername(*username), nil
}

func normalizeInitiaUsername(value string) *string {
	normalized := strings.TrimSpace(value)
	if normalized == "" {
		return nil
	}

	if !strings.Contains(normalized, ".") {
		normalized += ".init"
	}

	return &normalized
}

func (c *UsernamesClient) previewNameForAddress(address string) string {
	c.mu.Lock()
	defer c.mu.Unlock()

	if username, ok := c.preview[strings.TrimSpace(address)]; ok {
		return username
	}

	suffix := strings.ToLower(strings.TrimSpace(address))
	if len(suffix) > 6 {
		suffix = suffix[len(suffix)-6:]
	}
	suffix = sanitizeUsernameFragment(suffix)
	if suffix == "" {
		suffix = "user"
	}

	username := suffix + ".init"
	c.preview[strings.TrimSpace(address)] = username
	return username
}

func sanitizeUsernameFragment(value string) string {
	filtered := strings.Builder{}
	for _, char := range value {
		if (char >= 'a' && char <= 'z') || (char >= '0' && char <= '9') {
			filtered.WriteRune(char)
		}
	}
	return filtered.String()
}
