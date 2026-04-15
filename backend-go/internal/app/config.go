package app

import (
	"net/url"
	"os"
	"strconv"
	"strings"
)

type Config struct {
	AppEnv                   string
	AIProvider               string
	ApproveFunctionName      string
	AuthAcceptAnySignature   bool
	ConnectBaseCurrency      string
	ConnectQuoteCurrency     string
	ConnectRestURL           string
	CORSOrigin               string
	DatabaseURL              string
	DirectDatabaseURL        string
	EnableLiveInitiaReads    bool
	EnableLiveRollupWrites   bool
	FaucetClaimAmount        int
	FaucetCooldownHours      int
	InitiaL1RestURL          string
	JWTSecret                string
	JWTTTLSeconds            int
	LendpayPackageAddress    string
	LoanModuleName           string
	MinitiadBin              string
	MinievmChainID           string
	MinievmChainName         string
	MinievmLookupDenom       string
	MinievmRestURL           string
	OllamaBaseURL            string
	OllamaModel              string
	OllamaTemperature        float64
	OllamaTimeoutMS          int
	Port                     string
	PreviewApprovalEnabled   bool
	PreviewOperatorToken     string
	RateLimitAIMaxRequests   int
	RateLimitAuthMaxRequests int
	RateLimitEnabled         bool
	RateLimitGlobalMax       int
	RateLimitMutationMax     int
	RateLimitWindowMS        int
	RollupChainID            string
	RollupGasAdjustment      string
	RollupGasPrices          string
	RollupHome               string
	RollupKeyName            string
	RollupKeyringBackend     string
	RollupNativeDenom        string
	RollupNativeSymbol       string
	RollupOperatorMnemonic   string
	PublicRollupRESTURL      string
	PublicRollupRPCURL       string
	RollupRESTURL            string
	RollupRPCURL             string
}

func LoadConfig() Config {
	databaseURL := normalizeDatabaseURL(getEnv(
		"DATABASE_URL",
		"postgresql://postgres:postgres@127.0.0.1:55432/lendpay_dev?schema=public",
	))
	directDatabaseURL := normalizeDatabaseURL(getEnv("DIRECT_DATABASE_URL", ""))
	rollupRESTURL := getEnv("ROLLUP_REST_URL", "http://localhost:1317")
	rollupRPCURL := getEnv("ROLLUP_RPC_URL", "http://localhost:26657")

	return Config{
		ApproveFunctionName:      getEnv("APPROVE_FUNCTION_NAME", "approve_request"),
		AppEnv:                   getEnv("APP_ENV", "development"),
		AIProvider:               getEnv("AI_PROVIDER", "heuristic"),
		AuthAcceptAnySignature:   getEnvBool("AUTH_ACCEPT_ANY_SIGNATURE", false),
		ConnectBaseCurrency:      getEnv("CONNECT_BASE_CURRENCY", "INIT"),
		ConnectQuoteCurrency:     getEnv("CONNECT_QUOTE_CURRENCY", "USD"),
		ConnectRestURL:           getEnv("CONNECT_REST_URL", "https://rest.testnet.initia.xyz"),
		CORSOrigin:               getEnv("CORS_ORIGIN", "*"),
		DatabaseURL:              databaseURL,
		DirectDatabaseURL:        directDatabaseURL,
		EnableLiveInitiaReads:    getEnvBool("ENABLE_LIVE_INITIA_READS", false),
		EnableLiveRollupWrites:   getEnvBool("ENABLE_LIVE_ROLLUP_WRITES", false),
		FaucetClaimAmount:        getEnvInt("FAUCET_CLAIM_AMOUNT", 100000000),
		FaucetCooldownHours:      getEnvInt("FAUCET_COOLDOWN_HOURS", 24),
		InitiaL1RestURL:          getEnv("INITIA_L1_REST_URL", "https://rest.testnet.initia.xyz"),
		JWTSecret:                getEnv("JWT_SECRET", "change-me-now"),
		JWTTTLSeconds:            getEnvInt("JWT_TTL_SECONDS", 60*60*24*7),
		LendpayPackageAddress:    getEnv("LENDPAY_PACKAGE_ADDRESS", ""),
		LoanModuleName:           getEnv("LOAN_MODULE_NAME", "loan_book"),
		MinitiadBin:              getEnv("MINITIAD_BIN", "minitiad"),
		MinievmChainID:           getEnv("MINIEVM_CHAIN_ID", "evm-1"),
		MinievmChainName:         getEnv("MINIEVM_CHAIN_NAME", "Initia MiniEVM"),
		MinievmLookupDenom:       getEnv("MINIEVM_LOOKUP_DENOM", ""),
		MinievmRestURL:           getEnv("MINIEVM_REST_URL", "https://rest-evm-1.anvil.asia-southeast.initia.xyz"),
		OllamaBaseURL:            getEnv("OLLAMA_BASE_URL", "http://127.0.0.1:11434"),
		OllamaModel:              getEnv("OLLAMA_MODEL", "llama3.2:3b"),
		OllamaTemperature:        getEnvFloat("OLLAMA_TEMPERATURE", 0.15),
		OllamaTimeoutMS:          getEnvInt("OLLAMA_TIMEOUT_MS", 12000),
		Port:                     getEnv("PORT", "8080"),
		PreviewApprovalEnabled:   getEnvBool("PREVIEW_APPROVAL_ENABLED", true),
		PreviewOperatorToken:     getEnv("PREVIEW_OPERATOR_TOKEN", "preview-operator"),
		RateLimitAIMaxRequests:   getEnvInt("RATE_LIMIT_AI_MAX_REQUESTS", 10),
		RateLimitAuthMaxRequests: getEnvInt("RATE_LIMIT_AUTH_MAX_REQUESTS", 20),
		RateLimitEnabled:         getEnvBool("RATE_LIMIT_ENABLED", true),
		RateLimitGlobalMax:       getEnvInt("RATE_LIMIT_GLOBAL_MAX_REQUESTS", 240),
		RateLimitMutationMax:     getEnvInt("RATE_LIMIT_MUTATION_MAX_REQUESTS", 60),
		RateLimitWindowMS:        getEnvInt("RATE_LIMIT_WINDOW_MS", 60000),
		RollupChainID:            getEnv("ROLLUP_CHAIN_ID", "lendpay-4"),
		RollupGasAdjustment:      getEnv("ROLLUP_GAS_ADJUSTMENT", "1.5"),
		RollupGasPrices:          getEnv("ROLLUP_GAS_PRICES", "0.015ulend"),
		RollupHome:               getEnv("ROLLUP_HOME", ""),
		RollupKeyName:            getEnv("ROLLUP_KEY_NAME", ""),
		RollupKeyringBackend:     getEnv("ROLLUP_KEYRING_BACKEND", "test"),
		RollupNativeDenom:        getEnv("ROLLUP_NATIVE_DENOM", "ulend"),
		RollupNativeSymbol:       getEnv("ROLLUP_NATIVE_SYMBOL", "LEND"),
		RollupOperatorMnemonic:   getEnv("ROLLUP_OPERATOR_MNEMONIC", ""),
		PublicRollupRESTURL:      resolvePublicServiceURL(getEnv("PUBLIC_ROLLUP_REST_URL", ""), rollupRESTURL),
		PublicRollupRPCURL:       resolvePublicServiceURL(getEnv("PUBLIC_ROLLUP_RPC_URL", ""), rollupRPCURL),
		RollupRESTURL:            rollupRESTURL,
		RollupRPCURL:             rollupRPCURL,
	}
}

func (c Config) DatabaseSchema() string {
	parsed, err := url.Parse(c.DatabaseURL)
	if err != nil {
		return "public"
	}

	schema := strings.TrimSpace(parsed.Query().Get("schema"))
	if schema == "" {
		return "public"
	}

	return schema
}

func getEnv(key, fallback string) string {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}

	return value
}

func getEnvInt(key string, fallback int) int {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}

	parsed, err := strconv.Atoi(value)
	if err != nil {
		return fallback
	}

	return parsed
}

func getEnvFloat(key string, fallback float64) float64 {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}

	parsed, err := strconv.ParseFloat(value, 64)
	if err != nil {
		return fallback
	}

	return parsed
}

func getEnvBool(key string, fallback bool) bool {
	value := strings.TrimSpace(strings.ToLower(os.Getenv(key)))
	if value == "" {
		return fallback
	}

	switch value {
	case "1", "true", "yes", "on":
		return true
	case "0", "false", "no", "off":
		return false
	default:
		return fallback
	}
}

func normalizeDatabaseURL(databaseURL string) string {
	if !strings.HasPrefix(databaseURL, "postgres://") && !strings.HasPrefix(databaseURL, "postgresql://") {
		return databaseURL
	}

	parsedURL, err := url.Parse(databaseURL)
	if err != nil {
		return databaseURL
	}

	sslMode := strings.TrimSpace(parsedURL.Query().Get("sslmode"))
	useLibpqCompat := strings.EqualFold(parsedURL.Query().Get("uselibpqcompat"), "true")
	if sslMode == "" || useLibpqCompat {
		return databaseURL
	}

	switch sslMode {
	case "prefer", "require", "verify-ca":
		query := parsedURL.Query()
		query.Set("sslmode", "verify-full")
		parsedURL.RawQuery = query.Encode()
		return parsedURL.String()
	default:
		return databaseURL
	}
}

func resolvePublicServiceURL(explicitValue, configuredValue string) string {
	explicitValue = strings.TrimSpace(explicitValue)
	if explicitValue != "" {
		return explicitValue
	}

	configuredValue = strings.TrimSpace(configuredValue)
	if configuredValue == "" {
		return ""
	}

	parsedURL, err := url.Parse(configuredValue)
	if err != nil {
		return configuredValue
	}

	hostname := strings.TrimSpace(parsedURL.Hostname())
	if !strings.HasSuffix(hostname, ".railway.internal") {
		return configuredValue
	}

	serviceName := strings.TrimSuffix(hostname, ".railway.internal")
	if serviceName == "" {
		return ""
	}

	serviceEnvKey := "RAILWAY_SERVICE_" + strings.ToUpper(strings.ReplaceAll(serviceName, "-", "_")) + "_URL"
	serviceURL := strings.TrimSpace(os.Getenv(serviceEnvKey))
	if serviceURL == "" {
		return ""
	}

	if strings.HasPrefix(serviceURL, "http://") || strings.HasPrefix(serviceURL, "https://") {
		return serviceURL
	}

	return "https://" + serviceURL
}
