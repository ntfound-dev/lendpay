package app

import (
	"strings"
	"sync"
)

type usernameResolution struct {
	Source   string
	Username *string
	Verified bool
}

type UsernamesClient struct {
	mu      sync.Mutex
	preview map[string]string
}

func NewUsernamesClient() *UsernamesClient {
	return &UsernamesClient{
		preview: map[string]string{},
	}
}

func (c *UsernamesClient) ResolveNameWithSource(address string, cfg Config) usernameResolution {
	if !cfg.EnableLiveInitiaReads {
		username := c.previewNameForAddress(address)
		return usernameResolution{
			Source:   "preview",
			Username: &username,
			Verified: false,
		}
	}

	username := c.previewNameForAddress(address)
	return usernameResolution{
		Source:   "preview",
		Username: &username,
		Verified: false,
	}
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
