package app

import (
	"context"
	"encoding/json"
	"net/http"
	"net/url"
	"strings"
	"time"
)

type MiniEvmClient struct {
	cfg  Config
	http *http.Client
}

func NewMiniEvmClient(cfg Config) *MiniEvmClient {
	return &MiniEvmClient{
		cfg: cfg,
		http: &http.Client{
			Timeout: 3500 * time.Millisecond,
		},
	}
}

func (c *MiniEvmClient) GetErc20FactoryAddress(ctx context.Context) *string {
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, strings.TrimRight(c.cfg.MinievmRestURL, "/")+"/minievm/evm/v1/contracts/erc20_factory", nil)
	if err != nil {
		return nil
	}

	response, err := c.http.Do(request)
	if err != nil {
		return nil
	}
	defer response.Body.Close()

	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return nil
	}

	var payload any
	if err := json.NewDecoder(response.Body).Decode(&payload); err != nil {
		return nil
	}

	return extractAddress(payload)
}

func (c *MiniEvmClient) GetContractByDenom(ctx context.Context, denom string) *string {
	if strings.TrimSpace(denom) == "" {
		return nil
	}

	endpoint, err := url.Parse(strings.TrimRight(c.cfg.MinievmRestURL, "/") + "/minievm/evm/v1/contracts/by_denom")
	if err != nil {
		return nil
	}
	query := endpoint.Query()
	query.Set("denom", denom)
	endpoint.RawQuery = query.Encode()

	request, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint.String(), nil)
	if err != nil {
		return nil
	}

	response, err := c.http.Do(request)
	if err != nil {
		return nil
	}
	defer response.Body.Close()

	if response.StatusCode == http.StatusNotFound || response.StatusCode < 200 || response.StatusCode >= 300 {
		return nil
	}

	var payload any
	if err := json.NewDecoder(response.Body).Decode(&payload); err != nil {
		return nil
	}

	return extractAddress(payload)
}

func extractAddress(payload any) *string {
	record := asMap(payload)
	if address := strings.TrimSpace(firstString(record["address"])); address != "" {
		return &address
	}

	contract := asMap(record["contract"])
	if address := strings.TrimSpace(firstString(contract["address"])); address != "" {
		return &address
	}

	return nil
}
