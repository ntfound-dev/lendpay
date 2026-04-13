package app

import (
	"context"
	"encoding/json"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"sync"
	"time"
)

var fallbackFeeds = []string{"INIT/USD", "BTC/USD", "ETH/USD"}

const fallbackPrice = 0.62

type oracleSnapshot struct {
	BaseCurrency   string
	BlockHeight    *int
	BlockTimestamp *string
	Decimals       *int
	FetchedAt      string
	Price          float64
	QuoteCurrency  string
	RawPrice       *string
	SourcePath     string
}

type feedCache struct {
	ExpiresAt int64
	Feeds     []string
}

type ConnectOracleClient struct {
	cfg       Config
	http      *http.Client
	feedCache *feedCache
	mu        sync.Mutex
}

func NewConnectOracleClient(cfg Config) *ConnectOracleClient {
	return &ConnectOracleClient{
		cfg: cfg,
		http: &http.Client{
			Timeout: 3500 * time.Millisecond,
		},
	}
}

func (c *ConnectOracleClient) GetSupportedFeeds(ctx context.Context) []string {
	c.mu.Lock()
	cache := c.feedCache
	c.mu.Unlock()

	now := time.Now().UnixMilli()
	if cache != nil && cache.ExpiresAt > now {
		return cache.Feeds
	}

	request, err := http.NewRequestWithContext(ctx, http.MethodGet, strings.TrimRight(c.cfg.ConnectRestURL, "/")+"/connect/oracle/v2/get_all_tickers", nil)
	if err != nil {
		return c.storeFeeds(now+60_000, fallbackFeeds)
	}

	response, err := c.http.Do(request)
	if err != nil {
		return c.storeFeeds(now+60_000, fallbackFeeds)
	}
	defer response.Body.Close()

	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return c.storeFeeds(now+60_000, fallbackFeeds)
	}

	var payload any
	if err := json.NewDecoder(response.Body).Decode(&payload); err != nil {
		return c.storeFeeds(now+60_000, fallbackFeeds)
	}

	feeds := extractFeeds(payload)
	if len(feeds) == 0 {
		feeds = fallbackFeeds
	}

	return c.storeFeeds(now+300_000, feeds)
}

func (c *ConnectOracleClient) GetPrice(ctx context.Context, baseCurrency, quoteCurrency string) oracleSnapshot {
	if strings.TrimSpace(baseCurrency) == "" {
		baseCurrency = c.cfg.ConnectBaseCurrency
	}
	if strings.TrimSpace(quoteCurrency) == "" {
		quoteCurrency = c.cfg.ConnectQuoteCurrency
	}

	pair := baseCurrency + "/" + quoteCurrency
	endpoint, err := url.Parse(strings.TrimRight(c.cfg.ConnectRestURL, "/") + "/connect/oracle/v2/get_price")
	if err != nil {
		return buildOracleSnapshot(baseCurrency, quoteCurrency, fallbackPrice, "fallback", nil, nil, nil)
	}
	query := endpoint.Query()
	query.Set("currency_pair", pair)
	endpoint.RawQuery = query.Encode()

	request, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint.String(), nil)
	if err != nil {
		return buildOracleSnapshot(baseCurrency, quoteCurrency, fallbackPrice, "fallback", nil, nil, nil)
	}

	response, err := c.http.Do(request)
	if err != nil {
		return buildOracleSnapshot(baseCurrency, quoteCurrency, fallbackPrice, "fallback", nil, nil, nil)
	}
	defer response.Body.Close()

	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return buildOracleSnapshot(baseCurrency, quoteCurrency, fallbackPrice, "fallback", nil, nil, nil)
	}

	var payload any
	if err := json.NewDecoder(response.Body).Decode(&payload); err != nil {
		return buildOracleSnapshot(baseCurrency, quoteCurrency, fallbackPrice, "fallback", nil, nil, nil)
	}

	return buildOracleSnapshotFromAPI(baseCurrency, quoteCurrency, payload)
}

func (c *ConnectOracleClient) storeFeeds(expiresAt int64, feeds []string) []string {
	cloned := append([]string(nil), feeds...)
	c.mu.Lock()
	c.feedCache = &feedCache{
		ExpiresAt: expiresAt,
		Feeds:     cloned,
	}
	c.mu.Unlock()
	return cloned
}

func buildOracleSnapshot(baseCurrency, quoteCurrency string, price float64, mode string, rawPrice *string, decimals *int, blockTimestamp *string) oracleSnapshot {
	sourcePath := "fallback://oracle/" + baseCurrency + "/" + quoteCurrency
	if mode == "connect" {
		sourcePath = "/connect/oracle/v2/get_price?currency_pair=" + baseCurrency + "/" + quoteCurrency
	}

	return oracleSnapshot{
		BaseCurrency:   baseCurrency,
		BlockTimestamp: blockTimestamp,
		Decimals:       decimals,
		FetchedAt:      time.Now().UTC().Format(time.RFC3339Nano),
		Price:          price,
		QuoteCurrency:  quoteCurrency,
		RawPrice:       rawPrice,
		SourcePath:     sourcePath,
	}
}

func buildOracleSnapshotFromAPI(baseCurrency, quoteCurrency string, payload any) oracleSnapshot {
	record := asMap(payload)
	priceNode := asMap(record["price"])
	if len(priceNode) == 0 {
		priceNode = asMap(record["data"])
	}

	rawPrice := firstString(priceNode["price"], record["price"], record["result"])
	var rawPricePtr *string
	if rawPrice != "" {
		rawPricePtr = &rawPrice
	}

	decimalsValue, decimalsOK := asInt(record["decimals"])
	var decimalsPtr *int
	if decimalsOK {
		decimalsPtr = &decimalsValue
	}

	price := extractPrice(payload)
	if rawPrice != "" && decimalsOK && decimalsValue > 0 {
		if parsed, err := strconv.ParseFloat(rawPrice, 64); err == nil {
			price = parsed / float64Pow10(decimalsValue)
		}
	}

	blockTimestamp := firstString(priceNode["block_timestamp"], record["block_timestamp"])
	var blockTimestampPtr *string
	if blockTimestamp != "" {
		blockTimestampPtr = &blockTimestamp
	}

	snapshot := buildOracleSnapshot(baseCurrency, quoteCurrency, price, "connect", rawPricePtr, decimalsPtr, blockTimestampPtr)
	if blockHeight, ok := asInt(firstNonNil(priceNode["block_height"], record["block_height"])); ok && blockHeight > 0 {
		snapshot.BlockHeight = &blockHeight
	}

	return snapshot
}

func extractFeeds(payload any) []string {
	if list, ok := payload.([]any); ok {
		result := make([]string, 0, len(list))
		for _, item := range list {
			if text := strings.TrimSpace(firstString(item)); text != "" {
				result = append(result, text)
			}
		}
		return result
	}

	record := asMap(payload)
	if len(record) == 0 {
		return nil
	}

	if currencyPairs, ok := record["currency_pairs"].([]any); ok {
		result := []string{}
		for _, entry := range currencyPairs {
			pair := asMap(entry)
			base := strings.TrimSpace(firstString(pair["Base"], pair["base"]))
			quote := strings.TrimSpace(firstString(pair["Quote"], pair["quote"]))
			if base != "" && quote != "" {
				result = append(result, base+"/"+quote)
			}
		}
		return result
	}

	for _, key := range []string{"tickers", "supported_tickers", "pairs", "data"} {
		if entries, ok := record[key].([]any); ok {
			result := []string{}
			for _, entry := range entries {
				if text := strings.TrimSpace(firstString(entry)); text != "" {
					result = append(result, text)
				}
			}
			if len(result) > 0 {
				return result
			}
		}
	}

	return nil
}

func extractPrice(payload any) float64 {
	switch value := payload.(type) {
	case float64:
		return value
	case string:
		if parsed, err := strconv.ParseFloat(value, 64); err == nil {
			return parsed
		}
	}

	record := asMap(payload)
	for _, key := range []string{"price", "data", "result"} {
		value := record[key]
		switch typed := value.(type) {
		case float64:
			return typed
		case string:
			if parsed, err := strconv.ParseFloat(typed, 64); err == nil {
				return parsed
			}
		case map[string]any:
			if nested := firstString(typed["price"]); nested != "" {
				if parsed, err := strconv.ParseFloat(nested, 64); err == nil {
					return parsed
				}
			}
		}
	}

	return fallbackPrice
}

func asMap(value any) map[string]any {
	record, ok := value.(map[string]any)
	if ok {
		return record
	}
	return map[string]any{}
}

func asInt(value any) (int, bool) {
	switch typed := value.(type) {
	case float64:
		return int(typed), true
	case int:
		return typed, true
	case string:
		parsed, err := strconv.Atoi(strings.TrimSpace(typed))
		if err == nil {
			return parsed, true
		}
	}
	return 0, false
}

func firstString(values ...any) string {
	for _, value := range values {
		switch typed := value.(type) {
		case string:
			if strings.TrimSpace(typed) != "" {
				return typed
			}
		}
	}
	return ""
}

func firstNonNil(values ...any) any {
	for _, value := range values {
		if value != nil {
			return value
		}
	}
	return nil
}

func float64Pow10(value int) float64 {
	result := 1.0
	for i := 0; i < value; i++ {
		result *= 10
	}
	return result
}
