package app

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"expvar"
	"fmt"
	"log"
	"math"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	chicors "github.com/go-chi/cors"
	"github.com/jackc/pgx/v5"
)

type Server struct {
	cfg        Config
	challenges *challengeStore
	db         *Database
	merchants  []merchantState
	limiter    *inMemoryRateLimiter
	minievm    *MiniEvmClient
	ollama     *OllamaScoringClient
	oracle     *ConnectOracleClient
	rollup     *RollupTxClient
	usernames  *UsernamesClient
}

var repayMetrics = expvar.NewMap("repay")

type statusCapturingResponseWriter struct {
	http.ResponseWriter
	statusCode int
}

func (w *statusCapturingResponseWriter) WriteHeader(statusCode int) {
	w.statusCode = statusCode
	w.ResponseWriter.WriteHeader(statusCode)
}

func (w *statusCapturingResponseWriter) Write(body []byte) (int, error) {
	if w.statusCode == 0 {
		w.statusCode = http.StatusOK
	}

	return w.ResponseWriter.Write(body)
}

type rowScanner interface {
	Scan(dest ...any) error
}

type loanRequestInput struct {
	Amount           float64 `json:"amount"`
	CollateralAmount float64 `json:"collateralAmount"`
	MerchantID       string  `json:"merchantId"`
	ProfileID        int     `json:"profileId"`
	TenorMonths      int     `json:"tenorMonths"`
	TxHash           string  `json:"txHash"`
}

type referralApplyInput struct {
	Code string `json:"code"`
}

type scoreInput struct {
	TxHash string `json:"txHash"`
}

type repayInput struct {
	TxHash string `json:"txHash"`
}

type approveInput struct {
	Reason string `json:"reason"`
}

type minitiadTxResponse struct {
	Code   int    `json:"code"`
	RawLog string `json:"raw_log"`
	TxHash string `json:"txhash"`
}

func parseMinitiadTxResponse(output []byte) (minitiadTxResponse, error) {
	result := minitiadTxResponse{}
	trimmed := strings.TrimSpace(string(output))
	if trimmed == "" {
		return result, fmt.Errorf("minitiad returned empty output")
	}

	if err := json.Unmarshal([]byte(trimmed), &result); err == nil {
		return result, nil
	}

	start := strings.Index(trimmed, "{")
	end := strings.LastIndex(trimmed, "}")
	if start >= 0 && end > start {
		if err := json.Unmarshal([]byte(trimmed[start:end+1]), &result); err == nil {
			return result, nil
		}
	}

	return result, fmt.Errorf("could not parse minitiad output: %s", trimmed)
}

func extractGasEstimate(output []byte) (int, bool) {
	for _, line := range strings.Split(string(output), "\n") {
		trimmed := strings.TrimSpace(line)
		lower := strings.ToLower(trimmed)
		if !strings.HasPrefix(lower, "gas estimate:") {
			continue
		}

		rawEstimate := strings.TrimSpace(trimmed[len("gas estimate:"):])
		estimate, err := strconv.Atoi(rawEstimate)
		if err == nil && estimate > 0 {
			return estimate, true
		}
	}

	return 0, false
}

func adjustedGasLimit(estimate int, adjustmentRaw string) int {
	if estimate <= 0 {
		return 0
	}

	adjustment, err := strconv.ParseFloat(strings.TrimSpace(adjustmentRaw), 64)
	if err != nil || adjustment < 1 {
		adjustment = 1
	}

	return maxInt(estimate, int(math.Ceil(float64(estimate)*adjustment)))
}

func usesAutoGas(args []string) bool {
	for index := 0; index < len(args)-1; index += 1 {
		if args[index] == "--gas" {
			return strings.EqualFold(strings.TrimSpace(args[index+1]), "auto")
		}
	}

	return false
}

func argsWithFixedGas(args []string, gasLimit int) []string {
	if gasLimit <= 0 {
		return append([]string(nil), args...)
	}

	nextArgs := make([]string, 0, len(args))
	for index := 0; index < len(args); index += 1 {
		switch args[index] {
		case "--gas":
			nextArgs = append(nextArgs, "--gas", strconv.Itoa(gasLimit))
			index += 1
		case "--gas-adjustment":
			index += 1
		default:
			nextArgs = append(nextArgs, args[index])
		}
	}

	return nextArgs
}

func NewServer(ctx context.Context, cfg Config) (*Server, error) {
	db, err := NewDatabase(ctx, cfg)
	if err != nil {
		return nil, err
	}

	return &Server{
		cfg:        cfg,
		challenges: newChallengeStore(),
		db:         db,
		merchants:  defaultMerchants(),
		limiter:    newInMemoryRateLimiter(),
		minievm:    NewMiniEvmClient(cfg),
		ollama:     NewOllamaScoringClient(cfg),
		oracle:     NewConnectOracleClient(cfg),
		rollup:     NewRollupTxClient(cfg),
		usernames:  NewUsernamesClient(),
	}, nil
}

func (s *Server) Close() {
	if s == nil {
		return
	}

	s.db.Close()
}

func (s *Server) Handler() http.Handler {
	router := chi.NewRouter()
	if s.cfg.RateLimitEnabled {
		router.Use(rateLimitMiddleware(s.cfg, s.limiter))
	}
	router.Use(requestLogMiddleware)
	router.Use(chicors.Handler(chicors.Options{
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-Operator-Token"},
		AllowedMethods:   []string{"GET", "POST", "OPTIONS"},
		AllowedOrigins:   allowedOrigins(s.cfg.CORSOrigin),
		AllowCredentials: true,
		MaxAge:           300,
	}))

	router.Get("/api/v1/health", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]any{
			"ok":      true,
			"env":     s.cfg.AppEnv,
			"mode":    s.runtimeMode(),
			"chainId": s.cfg.RollupChainID,
		})
	})

	router.Get("/api/v1/meta/connect-feeds", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]any{
			"feeds": s.oracle.GetSupportedFeeds(r.Context()),
		})
	})

	router.Get("/api/v1/meta/treasury", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]any{
			"mode":         s.runtimeMode(),
			"canBroadcast": s.liveRollupWritesEnabled(),
			"nativeSymbol": s.cfg.RollupNativeSymbol,
			"nativeDenom":  s.cfg.RollupNativeDenom,
		})
	})

	router.Get("/api/v1/meta/ai", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, s.ollama.GetStatus(r.Context(), false))
	})
	router.Get("/api/v1/meta/metrics", s.handleGetMetrics)

	router.Get("/api/v1/meta/chains", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]any{
			"l1RestUrl":     s.cfg.InitiaL1RestURL,
			"rollupRestUrl": s.cfg.PublicRollupRESTURL,
			"rollupRpcUrl":  s.cfg.PublicRollupRPCURL,
			"rollupChainId": s.cfg.RollupChainID,
		})
	})

	router.Get("/indexer/tx/v1/txs/by_account/{address}", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]any{
			"txs": []any{},
			"pagination": map[string]any{
				"next_key": nil,
				"total":    "0",
			},
		})
	})

	router.Get("/indexer/nft/v1/tokens/by_account/{address}", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]any{
			"tokens": []any{},
			"pagination": map[string]any{
				"next_key": nil,
				"total":    "0",
			},
		})
	})

	router.Post("/api/v1/auth/challenge", s.handleCreateChallenge)
	router.Post("/api/v1/auth/verify", s.handleVerifySession)
	router.Post("/api/v1/auth/refresh", s.handleRefreshSession)
	router.Post("/api/v1/auth/logout", s.handleLogout)

	router.Get("/api/v1/me", s.handleGetMe)
	router.Get("/api/v1/me/username", s.handleGetUsername)
	router.Post("/api/v1/me/username/refresh", s.handleRefreshUsername)
	router.Get("/api/v1/me/points", s.handleGetPoints)
	router.Post("/api/v1/me/rewards/sync", s.handleSyncRewards)
	router.Get("/api/v1/me/activity", s.handleListActivity)
	router.Get("/api/v1/me/faucet", s.handleGetFaucet)
	router.Post("/api/v1/me/faucet/claim", s.handleClaimFaucet)
	router.Get("/api/v1/me/referral", s.handleGetReferral)
	router.Post("/api/v1/me/referral/apply", s.handleApplyReferral)

	router.Get("/api/v1/leaderboard", s.handleGetLeaderboard)
	router.Get("/api/v1/score", s.handleGetScore)
	router.Post("/api/v1/score/analyze", s.handleAnalyzeScore)
	router.Get("/api/v1/score/history", s.handleScoreHistory)
	router.Get("/api/v1/agent/guide", s.handleGetAgentGuide)
	router.Post("/api/v1/agent/guide", s.handlePostAgentGuide)

	router.Get("/api/v1/loan-requests", s.handleListLoanRequests)
	router.Post("/api/v1/loan-requests", s.handleCreateLoanRequest)
	router.Get("/api/v1/loan-requests/{id}", s.handleGetLoanRequest)
	router.Post("/api/v1/loan-requests/{id}/approve", s.handleApproveLoanRequest)
	router.Post("/api/v1/loan-requests/{id}/review-demo", s.handleReviewDemoLoanRequest)

	router.Get("/api/v1/loans", s.handleListLoans)
	router.Get("/api/v1/loans/{id}", s.handleGetLoan)
	router.Get("/api/v1/loans/{id}/schedule", s.handleGetLoanSchedule)
	router.Get("/api/v1/loans/{id}/fees", s.handleGetLoanFees)
	router.Post("/api/v1/loans/{id}/repay", s.handleRepayLoan)

	router.Get("/api/v1/protocol/profiles", s.handleListProfiles)
	router.Get("/api/v1/protocol/campaigns", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, []any{})
	})
	router.Post("/api/v1/protocol/campaigns", s.handlePreviewProtocolAction("campaign_create"))
	router.Post("/api/v1/protocol/campaigns/{id}/allocations", s.handlePreviewProtocolAction("campaign_allocate"))
	router.Post("/api/v1/protocol/campaigns/{id}/close", s.handlePreviewProtocolAction("campaign_close"))
	router.Get("/api/v1/protocol/governance", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, []any{})
	})
	router.Post("/api/v1/protocol/governance/proposals", s.handlePreviewProtocolAction("governance_propose"))
	router.Post("/api/v1/protocol/governance/{id}/vote", s.handlePreviewProtocolAction("governance_vote"))
	router.Post("/api/v1/protocol/governance/{id}/finalize", s.handlePreviewProtocolAction("governance_finalize"))
	router.Get("/api/v1/protocol/merchants", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, s.merchants)
	})
	router.Post("/api/v1/protocol/merchants", s.handlePreviewProtocolAction("merchant_register"))
	router.Post("/api/v1/protocol/merchants/{id}/active", s.handlePreviewProtocolAction("merchant_set_active"))
	router.Get("/api/v1/protocol/tx/{hash}", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, nil)
	})
	router.Get("/api/v1/protocol/viral-drop/items", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, []any{})
	})
	router.Get("/api/v1/protocol/viral-drop/purchases", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, []any{})
	})
	router.Get("/api/v1/protocol/liquidity/lend", s.handleGetLendLiquidityRoute)

	router.Post("/api/v1/admin/vip/stages/{stage}/publish", s.handleAdminPreviewAction("vip_publish"))
	router.Post("/api/v1/admin/vip/stages/{stage}/finalize", s.handleAdminPreviewAction("vip_finalize"))
	router.Post("/api/v1/admin/dex/simulate", s.handleAdminPreviewAction("dex_simulate"))
	router.Post("/api/v1/admin/dex/rebalance", s.handleAdminPreviewAction("dex_rebalance"))

	return router
}

func requestLogMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		startedAt := time.Now()
		capture := &statusCapturingResponseWriter{ResponseWriter: w}
		next.ServeHTTP(capture, r)

		statusCode := capture.statusCode
		if statusCode == 0 {
			statusCode = http.StatusOK
		}

		log.Printf(
			"[http] method=%s path=%s status=%d duration_ms=%d remote=%s",
			r.Method,
			r.URL.Path,
			statusCode,
			time.Since(startedAt).Milliseconds(),
			r.RemoteAddr,
		)
	})
}

func allowedOrigins(value string) []string {
	if strings.TrimSpace(value) == "" || value == "*" {
		return []string{"*"}
	}

	parts := strings.Split(value, ",")
	origins := make([]string, 0, len(parts))
	for _, part := range parts {
		trimmed := strings.TrimSpace(part)
		if trimmed != "" {
			origins = append(origins, trimmed)
		}
	}
	if len(origins) == 0 {
		return []string{"*"}
	}

	return origins
}

func (s *Server) handleCreateChallenge(w http.ResponseWriter, r *http.Request) {
	body := struct {
		Address string `json:"address"`
	}{}
	if err := decodeJSON(r, &body); err != nil {
		writeAppError(w, err)
		return
	}

	address := strings.TrimSpace(body.Address)
	if !isValidChallengeAddress(address) {
		writeAppError(w, &appError{
			Code:       "VALIDATION_ERROR",
			Message:    "A valid Initia wallet address is required.",
			StatusCode: http.StatusBadRequest,
		})
		return
	}

	writeJSON(w, http.StatusOK, s.createChallenge(address))
}

func (s *Server) handleVerifySession(w http.ResponseWriter, r *http.Request) {
	body := verifySessionRequest{}
	if err := decodeJSON(r, &body); err != nil {
		writeAppError(w, err)
		return
	}

	if strings.TrimSpace(body.Address) == "" || strings.TrimSpace(body.ChallengeID) == "" {
		writeAppError(w, &appError{
			Code:       "VALIDATION_ERROR",
			Message:    "Address and challengeId are required.",
			StatusCode: http.StatusBadRequest,
		})
		return
	}

	session, appErr := s.verifyChallenge(body)
	if appErr != nil {
		writeAppError(w, appErr)
		return
	}

	user, appErr := s.ensureUser(r.Context(), body.Address)
	if appErr != nil {
		writeAppError(w, appErr)
		return
	}

	_ = s.pushActivity(r.Context(), body.Address, activityItem{
		ID:        createID("activity"),
		Kind:      "identity",
		Label:     "Wallet linked",
		Detail:    "A backend session was created from your wallet signature.",
		Timestamp: isoTime(time.Now().UTC()),
	})

	writeJSON(w, http.StatusOK, authResponse{
		Token: session.Token,
		User:  s.presentUserProfile(r.Context(), user),
	})
}

func (s *Server) handleRefreshSession(w http.ResponseWriter, r *http.Request) {
	session, appErr := s.requireSession(r)
	if appErr != nil {
		writeAppError(w, appErr)
		return
	}

	next, appErr := s.createSessionToken(session.InitiaAddress)
	if appErr != nil {
		writeAppError(w, appErr)
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"token":         next.Token,
		"initiaAddress": next.InitiaAddress,
		"expiresAt":     isoTime(next.ExpiresAt),
	})
}

func (s *Server) handleLogout(w http.ResponseWriter, r *http.Request) {
	if _, appErr := s.requireSession(r); appErr != nil {
		writeAppError(w, appErr)
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"success": true,
	})
}

func (s *Server) handleGetMe(w http.ResponseWriter, r *http.Request) {
	user, appErr := s.currentUser(r)
	if appErr != nil {
		writeAppError(w, appErr)
		return
	}

	if syncedUser, err := s.syncUserOnchainState(r.Context(), user); err == nil {
		user = syncedUser
	}
	s.syncOnchainBorrowerCredit(r.Context(), user.InitiaAddress)

	writeJSON(w, http.StatusOK, s.presentUserProfile(r.Context(), user))
}

func (s *Server) handleGetUsername(w http.ResponseWriter, r *http.Request) {
	user, appErr := s.currentUser(r)
	if appErr != nil {
		writeAppError(w, appErr)
		return
	}

	profile := s.presentUserProfile(r.Context(), user)
	writeJSON(w, http.StatusOK, map[string]any{
		"address":                 user.InitiaAddress,
		"username":                profile.Username,
		"usernameAttestedOnRollup": profile.UsernameAttestedOnRollup,
		"usernameSource":          profile.UsernameSource,
		"usernameVerified":        profile.UsernameVerified,
		"usernameVerifiedOnL1":    profile.UsernameVerifiedOnL1,
	})
}

func (s *Server) handleRefreshUsername(w http.ResponseWriter, r *http.Request) {
	user, appErr := s.currentUser(r)
	if appErr != nil {
		writeAppError(w, appErr)
		return
	}

	refreshed, appErr := s.syncUsername(r.Context(), user)
	if appErr != nil {
		writeAppError(w, appErr)
		return
	}

	writeJSON(w, http.StatusOK, s.presentUserProfile(r.Context(), refreshed))
}

func (s *Server) handleGetPoints(w http.ResponseWriter, r *http.Request) {
	user, appErr := s.currentUser(r)
	if appErr != nil {
		writeAppError(w, appErr)
		return
	}

	if syncedUser, err := s.syncUserOnchainState(r.Context(), user); err == nil {
		user = syncedUser
	}

	writeJSON(w, http.StatusOK, mapUserProfile(user).Rewards)
}

func (s *Server) handleSyncRewards(w http.ResponseWriter, r *http.Request) {
	user, appErr := s.currentUser(r)
	if appErr != nil {
		writeAppError(w, appErr)
		return
	}

	body := repayInput{}
	if err := decodeJSON(r, &body); err != nil {
		writeAppError(w, err)
		return
	}

	if _, appErr := s.waitForTxConfirmation(r.Context(), body.TxHash); appErr != nil {
		writeAppError(w, appErr)
		return
	}
	s.syncOnchainBorrowerCredit(r.Context(), user.InitiaAddress)
	if syncedUser, err := s.syncUserOnchainState(r.Context(), user); err == nil {
		user = syncedUser
	}

	writeJSON(w, http.StatusOK, mapUserProfile(user).Rewards)
}

func (s *Server) handleListActivity(w http.ResponseWriter, r *http.Request) {
	user, appErr := s.currentUser(r)
	if appErr != nil {
		writeAppError(w, appErr)
		return
	}

	items, appErr := s.listActivity(r.Context(), user.InitiaAddress)
	if appErr != nil {
		writeAppError(w, appErr)
		return
	}

	writeJSON(w, http.StatusOK, items)
}

func (s *Server) handleGetFaucet(w http.ResponseWriter, r *http.Request) {
	user, appErr := s.currentUser(r)
	if appErr != nil {
		writeAppError(w, appErr)
		return
	}

	state, appErr := s.getFaucetState(r.Context(), user.InitiaAddress)
	if appErr != nil {
		writeAppError(w, appErr)
		return
	}

	writeJSON(w, http.StatusOK, state)
}

func (s *Server) handleClaimFaucet(w http.ResponseWriter, r *http.Request) {
	user, appErr := s.currentUser(r)
	if appErr != nil {
		writeAppError(w, appErr)
		return
	}

	state, appErr := s.getFaucetState(r.Context(), user.InitiaAddress)
	if appErr != nil {
		writeAppError(w, appErr)
		return
	}

	if !state.Enabled {
		writeAppError(w, &appError{
			Code:       "FAUCET_UNAVAILABLE",
			Message:    "The faucet is not enabled for this environment.",
			StatusCode: http.StatusServiceUnavailable,
		})
		return
	}

	if !state.CanClaim {
		message := "Your next faucet claim will be available after the cooldown window."
		if state.NextClaimAt != nil {
			message = fmt.Sprintf("Your next faucet claim will be available at %s.", *state.NextClaimAt)
		}

		writeAppError(w, &appError{
			Code:       "FAUCET_COOLDOWN_ACTIVE",
			Message:    message,
			StatusCode: http.StatusConflict,
		})
		return
	}

	now := time.Now().UTC()
	txHash := previewTxHash("faucet", user.InitiaAddress)
	_, err := s.db.pool.Exec(
		r.Context(),
		fmt.Sprintf(
			`INSERT INTO %s ("id","actorAddress","actionType","targetType","targetId","reason","txHash","status","createdAt")
			 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
			s.db.table("OperatorAction"),
		),
		createID("operator"),
		user.InitiaAddress,
		"faucet_claim",
		"wallet",
		user.InitiaAddress,
		fmt.Sprintf("Preview faucet claim for %s %s", formatTokenAmount(s.cfg.FaucetClaimAmount, s.cfg.RollupNativeDecimals), s.cfg.RollupNativeSymbol),
		txHash,
		"preview",
		now,
	)
	if err != nil {
		writeAppError(w, &appError{
			Code:       "DATABASE_ERROR",
			Message:    "Faucet claim could not be recorded.",
			StatusCode: http.StatusInternalServerError,
		})
		return
	}

	nextState, appErr := s.getFaucetState(r.Context(), user.InitiaAddress)
	if appErr != nil {
		writeAppError(w, appErr)
		return
	}
	nextState.TxHash = &txHash
	lastClaimAt := isoTime(now)
	nextClaimAt := isoTime(now.Add(time.Duration(s.cfg.FaucetCooldownHours) * time.Hour))
	nextState.LastClaimAt = &lastClaimAt
	nextState.NextClaimAt = &nextClaimAt
	nextState.CanClaim = false

	writeJSON(w, http.StatusOK, nextState)
}

func (s *Server) getFaucetState(ctx context.Context, address string) (faucetState, *appError) {
	state := faucetState{
		CanClaim:      false,
		ClaimAmount:   s.cfg.FaucetClaimAmount,
		CooldownHours: s.cfg.FaucetCooldownHours,
		Enabled:       s.cfg.FaucetClaimAmount > 0 && s.cfg.FaucetCooldownHours >= 0,
		NativeSymbol:  s.cfg.RollupNativeSymbol,
	}

	if !state.Enabled {
		return state, nil
	}

	action, err := s.getLatestOperatorAction(ctx, address, "faucet_claim", "wallet")
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			state.CanClaim = true
			return state, nil
		}

		return faucetState{}, &appError{
			Code:       "DATABASE_ERROR",
			Message:    "Faucet status could not be loaded.",
			StatusCode: http.StatusInternalServerError,
		}
	}

	lastClaimAt := isoTime(action.CreatedAt)
	nextClaimMoment := action.CreatedAt.Add(time.Duration(s.cfg.FaucetCooldownHours) * time.Hour)
	nextClaimAt := isoTime(nextClaimMoment)
	state.LastClaimAt = &lastClaimAt
	state.NextClaimAt = &nextClaimAt
	state.TxHash = action.TxHash
	state.CanClaim = !time.Now().UTC().Before(nextClaimMoment)

	return state, nil
}

func (s *Server) handleGetReferral(w http.ResponseWriter, r *http.Request) {
	user, appErr := s.currentUser(r)
	if appErr != nil {
		writeAppError(w, appErr)
		return
	}

	state, appErr := s.getReferralState(r.Context(), user)
	if appErr != nil {
		writeAppError(w, appErr)
		return
	}

	writeJSON(w, http.StatusOK, state)
}

func (s *Server) handleApplyReferral(w http.ResponseWriter, r *http.Request) {
	user, appErr := s.currentUser(r)
	if appErr != nil {
		writeAppError(w, appErr)
		return
	}

	body := referralApplyInput{}
	if err := decodeJSON(r, &body); err != nil {
		writeAppError(w, err)
		return
	}

	state, appErr := s.applyReferralCode(r.Context(), user, body.Code)
	if appErr != nil {
		writeAppError(w, appErr)
		return
	}

	writeJSON(w, http.StatusOK, state)
}

func (s *Server) handleGetLeaderboard(w http.ResponseWriter, r *http.Request) {
	if _, appErr := s.currentUser(r); appErr != nil {
		writeAppError(w, appErr)
		return
	}

	writeJSON(w, http.StatusOK, leaderboardState{
		MyRank:       map[string]int{},
		RisingStars:  []leaderboardEntry{},
		TopBorrowers: []leaderboardEntry{},
		TopReferrers: []leaderboardEntry{},
		TopRepayers:  []leaderboardEntry{},
	})
}

func (s *Server) handleGetScore(w http.ResponseWriter, r *http.Request) {
	user, appErr := s.currentUser(r)
	if appErr != nil {
		writeAppError(w, appErr)
		return
	}

	score, appErr := s.getLatestScore(r.Context(), user)
	if appErr != nil {
		writeAppError(w, appErr)
		return
	}

	writeJSON(w, http.StatusOK, score)
}

func (s *Server) handleAnalyzeScore(w http.ResponseWriter, r *http.Request) {
	user, appErr := s.currentUser(r)
	if appErr != nil {
		writeAppError(w, appErr)
		return
	}

	score, appErr := s.analyzeScore(r.Context(), user)
	if appErr != nil {
		writeAppError(w, appErr)
		return
	}

	writeJSON(w, http.StatusOK, score)
}

func (s *Server) handleScoreHistory(w http.ResponseWriter, r *http.Request) {
	user, appErr := s.currentUser(r)
	if appErr != nil {
		writeAppError(w, appErr)
		return
	}

	history, appErr := s.scoreHistory(r.Context(), user.InitiaAddress)
	if appErr != nil {
		writeAppError(w, appErr)
		return
	}

	writeJSON(w, http.StatusOK, history)
}

func (s *Server) handleListLoanRequests(w http.ResponseWriter, r *http.Request) {
	user, appErr := s.currentUser(r)
	if appErr != nil {
		writeAppError(w, appErr)
		return
	}

	requests, appErr := s.listLoanRequests(r.Context(), user.InitiaAddress)
	if appErr != nil {
		writeAppError(w, appErr)
		return
	}

	writeJSON(w, http.StatusOK, requests)
}

func (s *Server) handleCreateLoanRequest(w http.ResponseWriter, r *http.Request) {
	user, appErr := s.currentUser(r)
	if appErr != nil {
		writeAppError(w, appErr)
		return
	}

	body := loanRequestInput{}
	if err := decodeJSON(r, &body); err != nil {
		writeAppError(w, err)
		return
	}

	request, appErr := s.createLoanRequest(r.Context(), user, body)
	if appErr != nil {
		writeAppError(w, appErr)
		return
	}

	writeJSON(w, http.StatusOK, request)
}

func (s *Server) handleGetLoanRequest(w http.ResponseWriter, r *http.Request) {
	user, appErr := s.currentUser(r)
	if appErr != nil {
		writeAppError(w, appErr)
		return
	}

	requests, appErr := s.listLoanRequests(r.Context(), user.InitiaAddress)
	if appErr != nil {
		writeAppError(w, appErr)
		return
	}

	id := chi.URLParam(r, "id")
	for _, request := range requests {
		if request.ID == id {
			writeJSON(w, http.StatusOK, request)
			return
		}
	}

	writeJSON(w, http.StatusOK, nil)
}

func (s *Server) handleApproveLoanRequest(w http.ResponseWriter, r *http.Request) {
	operatorAddress, appErr := s.requireOperator(r)
	if appErr != nil {
		writeAppError(w, appErr)
		return
	}

	body := approveInput{}
	if err := decodeJSON(r, &body); err != nil {
		writeAppError(w, err)
		return
	}

	response, appErr := s.approveLoanRequest(r.Context(), chi.URLParam(r, "id"), operatorAddress, body.Reason, "")
	if appErr != nil {
		writeAppError(w, appErr)
		return
	}

	writeJSON(w, http.StatusOK, response)
}

func (s *Server) handleReviewDemoLoanRequest(w http.ResponseWriter, r *http.Request) {
	user, appErr := s.currentUser(r)
	if appErr != nil {
		writeAppError(w, appErr)
		return
	}

	body := approveInput{}
	if err := decodeJSON(r, &body); err != nil {
		writeAppError(w, err)
		return
	}

	response, appErr := s.reviewDemoLoanRequest(r.Context(), user, chi.URLParam(r, "id"), body.Reason)
	if appErr != nil {
		writeAppError(w, appErr)
		return
	}

	writeJSON(w, http.StatusOK, response)
}

func (s *Server) handleListLoans(w http.ResponseWriter, r *http.Request) {
	user, appErr := s.currentUser(r)
	if appErr != nil {
		writeAppError(w, appErr)
		return
	}

	loans, appErr := s.listLoans(r.Context(), user.InitiaAddress)
	if appErr != nil {
		writeAppError(w, appErr)
		return
	}

	writeJSON(w, http.StatusOK, loans)
}

func (s *Server) handleGetLoan(w http.ResponseWriter, r *http.Request) {
	loan, appErr := s.requireLoan(r)
	if appErr != nil {
		writeAppError(w, appErr)
		return
	}

	writeJSON(w, http.StatusOK, loan)
}

func (s *Server) handleGetLoanSchedule(w http.ResponseWriter, r *http.Request) {
	loan, appErr := s.requireLoan(r)
	if appErr != nil {
		writeAppError(w, appErr)
		return
	}

	writeJSON(w, http.StatusOK, loan.Schedule)
}

func (s *Server) handleGetLoanFees(w http.ResponseWriter, r *http.Request) {
	user, appErr := s.currentUser(r)
	if appErr != nil {
		writeAppError(w, appErr)
		return
	}

	loan, appErr := s.requireLoan(r)
	if appErr != nil {
		writeAppError(w, appErr)
		return
	}

	fees, appErr := s.resolveLoanFeeState(r.Context(), loan, user.InitiaAddress)
	if appErr != nil {
		writeAppError(w, appErr)
		return
	}

	writeJSON(w, http.StatusOK, fees)
}

func (s *Server) handleRepayLoan(w http.ResponseWriter, r *http.Request) {
	user, appErr := s.currentUser(r)
	if appErr != nil {
		writeAppError(w, appErr)
		return
	}

	body := repayInput{}
	if err := decodeJSON(r, &body); err != nil {
		writeAppError(w, err)
		return
	}

	response, appErr := s.repayLoan(r.Context(), user, chi.URLParam(r, "id"), body.TxHash)
	if appErr != nil {
		writeAppError(w, appErr)
		return
	}

	writeJSON(w, http.StatusOK, response)
}

func (s *Server) resolveLoanFeeState(ctx context.Context, loan loanState, borrower string) (loanFeeState, *appError) {
	fees := loanFeeState{
		Borrower:            borrower,
		LoanID:              loan.ID,
		LateFeeDue:          0,
		OriginationFeeDue:   0,
		TotalFeesPaid:       0,
		TotalFeesPaidInLend: 0,
	}
	onchainLoanID := trimStringPtr(loan.OnchainLoanID)
	if !strings.EqualFold(loan.RouteMode, "live") || onchainLoanID == "" {
		return fees, nil
	}
	if s.rollup == nil {
		return loanFeeState{}, &appError{
			Code:       "LOAN_FEES_UNAVAILABLE",
			Message:    "Live loan fees could not be loaded from the rollup right now.",
			StatusCode: http.StatusServiceUnavailable,
		}
	}

	feeView, err := s.rollup.GetFeeState(ctx, onchainLoanID)
	if err != nil || feeView == nil {
		return loanFeeState{}, &appError{
			Code:       "LOAN_FEES_UNAVAILABLE",
			Message:    "Live loan fees could not be loaded from the rollup right now.",
			StatusCode: http.StatusServiceUnavailable,
		}
	}
	if strings.TrimSpace(feeView.LoanID) != "" && strings.TrimSpace(feeView.LoanID) != onchainLoanID {
		return loanFeeState{}, &appError{
			Code:       "LOAN_FEES_MISMATCH",
			Message:    "Live fee data did not match the requested loan.",
			StatusCode: http.StatusBadGateway,
		}
	}

	return loanFeeState{
		Borrower:            borrower,
		LoanID:              loan.ID,
		LateFeeDue:          feeView.LateFeeDue,
		OriginationFeeDue:   feeView.OriginationFeeDue,
		TotalFeesPaid:       feeView.TotalFeesPaid,
		TotalFeesPaidInLend: feeView.TotalFeesPaidInLend,
	}, nil
}

func (s *Server) handleListProfiles(w http.ResponseWriter, r *http.Request) {
	user, appErr := s.currentUser(r)
	if appErr != nil {
		writeAppError(w, appErr)
		return
	}

	score, appErr := s.getLatestScore(r.Context(), user)
	if appErr != nil {
		writeAppError(w, appErr)
		return
	}

	writeJSON(w, http.StatusOK, s.profileQuotes(user, score))
}

func (s *Server) handleGetLendLiquidityRoute(w http.ResponseWriter, r *http.Request) {
	if _, appErr := s.currentUser(r); appErr != nil {
		writeAppError(w, appErr)
		return
	}

	lookupDenom := strings.TrimSpace(s.cfg.MinievmLookupDenom)
	if lookupDenom == "" {
		lookupDenom = s.cfg.RollupNativeDenom
	}

	requestedPair := fmt.Sprintf("%s/%s", s.cfg.RollupNativeSymbol, s.cfg.ConnectQuoteCurrency)
	supportedFeeds := s.oracle.GetSupportedFeeds(r.Context())
	pairSupported := false
	for _, feed := range supportedFeeds {
		if feed == requestedPair {
			pairSupported = true
			break
		}
	}
	resolvedBase := s.cfg.RollupNativeSymbol
	if !pairSupported {
		resolvedBase = s.cfg.ConnectBaseCurrency
	}
	var pairReason *string
	if !pairSupported {
		reason := fmt.Sprintf(
			"Connect does not currently expose %s, so this route uses %s/%s as the official reference quote.",
			requestedPair,
			resolvedBase,
			s.cfg.ConnectQuoteCurrency,
		)
		pairReason = &reason
	}
	oracleQuote := s.oracle.GetPrice(r.Context(), resolvedBase, s.cfg.ConnectQuoteCurrency)
	erc20FactoryAddress := s.minievm.GetErc20FactoryAddress(r.Context())
	erc20Address := s.minievm.GetContractByDenom(r.Context(), lookupDenom)
	routeMode := "preview"
	routeStatus := "mapping_required"
	if erc20Address != nil {
		routeMode = "live"
		routeStatus = "mapped"
	}

	writeJSON(w, http.StatusOK, lendLiquidityRouteState{
		AssetDenom:                s.cfg.RollupNativeDenom,
		AssetSymbol:               s.cfg.RollupNativeSymbol,
		DestinationChainID:        s.cfg.MinievmChainID,
		DestinationChainName:      s.cfg.MinievmChainName,
		DestinationRestURL:        s.cfg.MinievmRestURL,
		DestinationAssetReference: erc20Address,
		Erc20FactoryAddress:       erc20FactoryAddress,
		Erc20Address:              erc20Address,
		LiquidityStatus:           ternaryString(erc20Address != nil, "live", "coming_soon"),
		OracleQuote: liquidityOracleQuoteState{
			BlockHeight:    oracleQuote.BlockHeight,
			BlockTimestamp: oracleQuote.BlockTimestamp,
			Decimals:       oracleQuote.Decimals,
			FetchedAt:      oracleQuote.FetchedAt,
			PairMode:       ternaryString(pairSupported, "direct", "reference"),
			PairReason:     pairReason,
			PairSupported:  pairSupported,
			Price:          oracleQuote.Price,
			RawPrice:       oracleQuote.RawPrice,
			RequestedPair:  requestedPair,
			ResolvedPair:   fmt.Sprintf("%s/%s", resolvedBase, s.cfg.ConnectQuoteCurrency),
			SourcePath:     oracleQuote.SourcePath,
		},
		RouteMode:       routeMode,
		RouteRegistry:   "derived",
		RouteStatus:     routeStatus,
		SellReady:       erc20Address != nil,
		SourceChainID:   s.cfg.RollupChainID,
		SourceChainName: "LendPay Move Rollup",
		SwapEnabled:     erc20Address != nil,
		SwapSummary:     ternaryString(erc20Address != nil, "LEND already has a MiniEVM mapping and can be treated as a live preview route.", "The Go backend exposes a preview liquidity route until live bridge metadata is ported."),
		TransferMethod:  "ibc_hooks",
		WalletHandler:   "interwovenkit",
	})
}

func (s *Server) handleGetMetrics(w http.ResponseWriter, r *http.Request) {
	if _, appErr := s.requireOperator(r); appErr != nil {
		writeAppError(w, appErr)
		return
	}

	expvar.Handler().ServeHTTP(w, r)
}

func (s *Server) handlePreviewProtocolAction(action string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		operatorAddress, appErr := s.requireOperator(r)
		if appErr != nil {
			writeAppError(w, appErr)
			return
		}

		writeJSON(w, http.StatusOK, map[string]any{
			"mode":   "preview",
			"txHash": previewTxHash("operator", action, chi.URLParam(r, "id"), operatorAddress),
		})
	}
}

func (s *Server) handleAdminPreviewAction(action string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if _, appErr := s.requireOperator(r); appErr != nil {
			writeAppError(w, appErr)
			return
		}

		stage := strings.TrimSpace(chi.URLParam(r, "stage"))
		if stage == "" {
			stage = strings.TrimSpace(chi.URLParam(r, "id"))
		}

		message := "Preview operator flow is not wired to a live chain writer yet."
		switch action {
		case "vip_publish":
			message = fmt.Sprintf("VIP publish flow for stage %s is not wired in the Go backend yet.", stage)
		case "vip_finalize":
			message = fmt.Sprintf("VIP finalize flow for stage %s is not wired in the Go backend yet.", stage)
		case "dex_simulate":
			message = "DEX treasury simulation is reserved for a later integration pass."
		case "dex_rebalance":
			message = "DEX treasury rebalancing is reserved for a later integration pass."
		}

		writeJSON(w, http.StatusOK, map[string]any{
			"enabled": false,
			"message": message,
		})
	}
}

func (s *Server) requireOperator(r *http.Request) (string, *appError) {
	operatorToken := strings.TrimSpace(r.Header.Get("X-Operator-Token"))
	if operatorToken == "" {
		return "", &appError{
			Code:       "OPERATOR_TOKEN_REQUIRED",
			Message:    "X-Operator-Token header is required for preview operator actions.",
			StatusCode: http.StatusUnauthorized,
		}
	}

	if operatorToken != s.cfg.PreviewOperatorToken {
		return "", &appError{
			Code:       "OPERATOR_UNAUTHORIZED",
			Message:    "Missing or invalid operator token.",
			StatusCode: http.StatusUnauthorized,
		}
	}

	return "preview-operator", nil
}

func (s *Server) currentUser(r *http.Request) (userRow, *appError) {
	session, appErr := s.requireSession(r)
	if appErr != nil {
		return userRow{}, appErr
	}

	return s.ensureUser(r.Context(), session.InitiaAddress)
}

func (s *Server) requireLoan(r *http.Request) (loanState, *appError) {
	user, appErr := s.currentUser(r)
	if appErr != nil {
		return loanState{}, appErr
	}

	loans, appErr := s.listLoans(r.Context(), user.InitiaAddress)
	if appErr != nil {
		return loanState{}, appErr
	}

	id := chi.URLParam(r, "id")
	for _, loan := range loans {
		if loan.ID == id {
			return loan, nil
		}
	}

	return loanState{}, &appError{
		Code:       "LOAN_NOT_FOUND",
		Message:    "Loan was not found.",
		StatusCode: http.StatusNotFound,
	}
}

func decodeJSON(r *http.Request, target any) *appError {
	if r.Body == nil {
		return nil
	}

	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(target); err != nil && !errors.Is(err, context.Canceled) {
		if errors.Is(err, http.ErrBodyReadAfterClose) {
			return &appError{
				Code:       "VALIDATION_ERROR",
				Message:    "Request body could not be read.",
				StatusCode: http.StatusBadRequest,
			}
		}

		if err.Error() == "EOF" {
			return nil
		}

		return &appError{
			Code:       "VALIDATION_ERROR",
			Message:    "Request validation failed.",
			StatusCode: http.StatusBadRequest,
		}
	}

	return nil
}

func defaultMerchants() []merchantState {
	fashionName := "Initia Atelier"
	fashionDescription := "Preview merchant for apparel and creator drops."
	gamingName := "Arcade Mile"
	gamingDescription := "Preview merchant for gaming, tickets, and digital items."

	return []merchantState{
		{
			Active:          true,
			Actions:         []string{"loan_request"},
			Category:        "fashion",
			Description:     &fashionDescription,
			ID:              "merchant-fashion",
			ListingFeeBps:   150,
			MerchantAddress: "init1previewfashionmerchant0000000000000000000",
			Name:            &fashionName,
			PartnerFeeBps:   250,
			PartnerFeeQuote: 25,
			Source:          "mock",
		},
		{
			Active:          true,
			Actions:         []string{"loan_request"},
			Category:        "gaming",
			Description:     &gamingDescription,
			ID:              "merchant-gaming",
			ListingFeeBps:   100,
			MerchantAddress: "init1previewgamingmerchant0000000000000000000",
			Name:            &gamingName,
			PartnerFeeBps:   200,
			PartnerFeeQuote: 20,
			Source:          "mock",
		},
	}
}

func (s *Server) presentUserProfile(ctx context.Context, row userRow) userProfile {
	resolution, err := s.usernames.ResolveNameWithSource(ctx, row.InitiaAddress, s.cfg)
	if err != nil {
		return mapUserProfileWithResolution(row, &usernameResolution{Source: "rollup"})
	}

	return mapUserProfileWithResolution(row, &resolution)
}

func (s *Server) ensureUser(ctx context.Context, address string) (userRow, *appError) {
	user, err := s.findUserByAddress(ctx, address)
	if err == nil {
		if user.ReferralCode == nil || *user.ReferralCode == "" {
			code, appErr := s.ensureReferralCode(ctx, address, nil)
			if appErr != nil {
				return userRow{}, appErr
			}
			updated, appErr := s.updateUserReferralCode(ctx, address, code)
			if appErr != nil {
				return userRow{}, appErr
			}
			return updated, nil
		}

		return s.syncUsername(ctx, user)
	}

	if !errors.Is(err, pgx.ErrNoRows) {
		return userRow{}, &appError{
			Code:       "DATABASE_ERROR",
			Message:    "User profile could not be loaded.",
			StatusCode: http.StatusInternalServerError,
		}
	}

	referralCode, appErr := s.ensureReferralCode(ctx, address, nil)
	if appErr != nil {
		return userRow{}, appErr
	}

	resolution, _ := s.usernames.ResolveNameWithSource(ctx, address, s.cfg)
	now := time.Now().UTC()
	inserted, err := scanUser(s.db.pool.QueryRow(
		ctx,
		fmt.Sprintf(
			`INSERT INTO %s ("id","initiaAddress","username","referralCode","points","tier","createdAt","updatedAt")
			 VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
			 RETURNING %s`,
			s.db.table("User"),
			userColumns(),
		),
		fmt.Sprintf("user-%s", tail(address, 8)),
		address,
		resolution.Username,
		referralCode,
		0,
		"Bronze",
		now,
		now,
	))
	if err != nil {
		return userRow{}, &appError{
			Code:       "DATABASE_ERROR",
			Message:    "User profile could not be created.",
			StatusCode: http.StatusInternalServerError,
		}
	}

	return inserted, nil
}

func (s *Server) syncUsername(ctx context.Context, user userRow) (userRow, *appError) {
	resolution, err := s.usernames.ResolveNameWithSource(ctx, user.InitiaAddress, s.cfg)
	if err != nil {
		return user, nil
	}

	resolvedUsername := ""
	if resolution.Username != nil {
		resolvedUsername = strings.TrimSpace(*resolution.Username)
	}
	currentUsername := ""
	if user.Username != nil {
		currentUsername = strings.TrimSpace(*user.Username)
	}
	if resolvedUsername == currentUsername {
		return user, nil
	}

	row, err := scanUser(s.db.pool.QueryRow(
		ctx,
		fmt.Sprintf(
			`UPDATE %s
			 SET "username" = $2, "updatedAt" = $3
			 WHERE "initiaAddress" = $1
			 RETURNING %s`,
			s.db.table("User"),
			userColumns(),
		),
		user.InitiaAddress,
		resolution.Username,
		time.Now().UTC(),
	))
	if err != nil {
		return userRow{}, &appError{
			Code:       "DATABASE_ERROR",
			Message:    "Username could not be synchronized.",
			StatusCode: http.StatusInternalServerError,
		}
	}

	return row, nil
}

func (s *Server) findUserByAddress(ctx context.Context, address string) (userRow, error) {
	return scanUser(s.db.pool.QueryRow(
		ctx,
		fmt.Sprintf(`SELECT %s FROM %s WHERE "initiaAddress" = $1`, userColumns(), s.db.table("User")),
		address,
	))
}

func (s *Server) updateUserReferralCode(ctx context.Context, address, referralCode string) (userRow, *appError) {
	row, err := scanUser(s.db.pool.QueryRow(
		ctx,
		fmt.Sprintf(
			`UPDATE %s
			 SET "referralCode" = $2, "updatedAt" = $3
			 WHERE "initiaAddress" = $1
			 RETURNING %s`,
			s.db.table("User"),
			userColumns(),
		),
		address,
		referralCode,
		time.Now().UTC(),
	))
	if err != nil {
		return userRow{}, &appError{
			Code:       "DATABASE_ERROR",
			Message:    "Referral code could not be saved.",
			StatusCode: http.StatusInternalServerError,
		}
	}

	return row, nil
}

func (s *Server) ensureReferralCode(ctx context.Context, address string, current *string) (string, *appError) {
	if current != nil && *current != "" {
		return *current, nil
	}

	baseCode := buildReferralCode(address)
	candidate := baseCode
	suffix := 1

	for {
		var existing string
		err := s.db.pool.QueryRow(
			ctx,
			fmt.Sprintf(
				`SELECT "initiaAddress" FROM %s
				 WHERE "referralCode" = $1 AND "initiaAddress" <> $2
				 LIMIT 1`,
				s.db.table("User"),
			),
			candidate,
			address,
		).Scan(&existing)
		if errors.Is(err, pgx.ErrNoRows) {
			return candidate, nil
		}
		if err != nil {
			return "", &appError{
				Code:       "DATABASE_ERROR",
				Message:    "Referral code could not be resolved.",
				StatusCode: http.StatusInternalServerError,
			}
		}

		candidate = fmt.Sprintf("%s%d", baseCode, suffix)
		suffix++
	}
}

func buildReferralCode(address string) string {
	sum := sha256.Sum256([]byte(address))
	return "LEND" + strings.ToUpper(hex.EncodeToString(sum[:])[:8])
}

func tail(value string, size int) string {
	if len(value) <= size {
		return value
	}

	return value[len(value)-size:]
}

func (s *Server) listActivity(ctx context.Context, address string) ([]activityItem, *appError) {
	rows, err := s.db.pool.Query(
		ctx,
		fmt.Sprintf(
			`SELECT "id","initiaAddress","kind","label","detail","timestamp"
			 FROM %s
			 WHERE "initiaAddress" = $1
			 ORDER BY "timestamp" DESC
			 LIMIT 20`,
			s.db.table("Activity"),
		),
		address,
	)
	if err != nil {
		return nil, &appError{
			Code:       "DATABASE_ERROR",
			Message:    "Recent activity could not be loaded.",
			StatusCode: http.StatusInternalServerError,
		}
	}
	defer rows.Close()

	items := []activityItem{}
	for rows.Next() {
		row, err := scanActivity(rows)
		if err != nil {
			return nil, &appError{
				Code:       "DATABASE_ERROR",
				Message:    "Recent activity could not be loaded.",
				StatusCode: http.StatusInternalServerError,
			}
		}
		items = append(items, mapActivity(row))
	}

	return items, nil
}

func (s *Server) pushActivity(ctx context.Context, address string, item activityItem) *appError {
	timestamp, err := time.Parse(time.RFC3339Nano, item.Timestamp)
	if err != nil {
		timestamp = time.Now().UTC()
	}

	_, err = s.db.pool.Exec(
		ctx,
		fmt.Sprintf(
			`INSERT INTO %s ("id","initiaAddress","kind","label","detail","timestamp")
			 VALUES ($1,$2,$3,$4,$5,$6)`,
			s.db.table("Activity"),
		),
		item.ID,
		address,
		item.Kind,
		item.Label,
		item.Detail,
		timestamp,
	)
	if err != nil {
		return &appError{
			Code:       "DATABASE_ERROR",
			Message:    "Activity could not be recorded.",
			StatusCode: http.StatusInternalServerError,
		}
	}

	return nil
}

func (s *Server) getLatestScore(ctx context.Context, user userRow) (creditScoreState, *appError) {
	row, err := scanScore(s.db.pool.QueryRow(
		ctx,
		fmt.Sprintf(
			`SELECT "score","limitUsd","risk","apr","provider","model","summary","scannedAt","breakdownJson","initiaAddress"
			 FROM %s
			 WHERE "initiaAddress" = $1
			 ORDER BY "scannedAt" DESC
			 LIMIT 1`,
			s.db.table("CreditScore"),
		),
		user.InitiaAddress,
	))
	if err == nil {
		score, mapErr := mapScore(row)
		if mapErr == nil {
			return score, nil
		}
	}

	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return creditScoreState{}, &appError{
			Code:       "DATABASE_ERROR",
			Message:    "Score could not be loaded.",
			StatusCode: http.StatusInternalServerError,
		}
	}

	return s.analyzeScore(ctx, user)
}

func (s *Server) analyzeScore(ctx context.Context, user userRow) (creditScoreState, *appError) {
	score := computeScore(user)
	breakdownJSON, _ := json.Marshal(score.Breakdown)
	now := time.Now().UTC()

	row, err := scanScore(s.db.pool.QueryRow(
		ctx,
		fmt.Sprintf(
			`INSERT INTO %s ("id","initiaAddress","score","limitUsd","risk","apr","provider","model","summary","scannedAt","breakdownJson")
			 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
			 RETURNING "score","limitUsd","risk","apr","provider","model","summary","scannedAt","breakdownJson","initiaAddress"`,
			s.db.table("CreditScore"),
		),
		createID("score"),
		user.InitiaAddress,
		score.Score,
		score.LimitUSD,
		score.Risk,
		score.APR,
		"heuristic",
		"go-preview-v1",
		score.Summary,
		now,
		string(breakdownJSON),
	))
	if err != nil {
		return creditScoreState{}, &appError{
			Code:       "DATABASE_ERROR",
			Message:    "Score could not be analyzed.",
			StatusCode: http.StatusInternalServerError,
		}
	}

	mapped, err := mapScore(row)
	if err != nil {
		return creditScoreState{}, &appError{
			Code:       "DATABASE_ERROR",
			Message:    "Score could not be analyzed.",
			StatusCode: http.StatusInternalServerError,
		}
	}

	_ = s.pushActivity(ctx, user.InitiaAddress, activityItem{
		ID:        createID("activity"),
		Kind:      "score",
		Label:     "Score refreshed",
		Detail:    "The Go backend recalculated your preview credit score.",
		Timestamp: isoTime(now),
	})

	return mapped, nil
}

func computeScore(user userRow) creditScoreState {
	identityBonus := 0
	if user.Username != nil && strings.TrimSpace(*user.Username) != "" {
		identityBonus = 25
	}

	pointsBonus := minInt(120, user.Points/40)
	referralBonus := minInt(40, user.ReferralPointsEarned/10)
	streakBonus := minInt(20, user.Streak*2)
	holdingsBonus := minInt(60, user.HeldLend/250)
	scoreValue := minInt(850, 620+identityBonus+pointsBonus+referralBonus+streakBonus+holdingsBonus)

	risk := "High"
	apr := 18.5
	limitUSD := 350
	switch {
	case scoreValue >= 780:
		risk = "Low"
		apr = 8.5
		limitUSD = 1600
	case scoreValue >= 720:
		risk = "Low"
		apr = 10.5
		limitUSD = 1100
	case scoreValue >= 660:
		risk = "Medium"
		apr = 14.5
		limitUSD = 700
	}

	provider := "heuristic"
	model := "go-preview-v1"
	summary := fmt.Sprintf("Preview score based on rewards, referrals, streaks, and holdings. Current risk band: %s.", risk)
	return creditScoreState{
		APR: apr,
		Breakdown: []scoreBreakdownItem{
			{Label: "Base profile", Points: 620, Detail: "Default preview borrower baseline."},
			{Label: "Identity", Points: identityBonus, Detail: "Username-linked wallets receive a small trust bonus."},
			{Label: "Rewards", Points: pointsBonus, Detail: "Platform points improve the preview limit."},
			{Label: "Referrals", Points: referralBonus, Detail: "Healthy referral activity increases trust."},
			{Label: "Repayment streak", Points: streakBonus, Detail: "Consistent repayment streaks reduce risk."},
			{Label: "LEND holdings", Points: holdingsBonus, Detail: "Higher LEND holdings increase capacity."},
		},
		LimitUSD:  limitUSD,
		Model:     &model,
		Provider:  &provider,
		Risk:      risk,
		ScannedAt: isoTime(time.Now().UTC()),
		Score:     scoreValue,
		Source:    scoreSourcePreview,
		Summary:   &summary,
	}
}

func minInt(left, right int) int {
	if left < right {
		return left
	}

	return right
}

func recordRepayConfirmed() {
	repayMetrics.Add("confirmed_total", 1)
}

func recordRepayPending() {
	repayMetrics.Add("pending_total", 1)
}

func (s *Server) scoreHistory(ctx context.Context, address string) ([]creditScoreState, *appError) {
	rows, err := s.db.pool.Query(
		ctx,
		fmt.Sprintf(
			`SELECT "score","limitUsd","risk","apr","provider","model","summary","scannedAt","breakdownJson","initiaAddress"
			 FROM %s
			 WHERE "initiaAddress" = $1
			 ORDER BY "scannedAt" DESC
			 LIMIT 12`,
			s.db.table("CreditScore"),
		),
		address,
	)
	if err != nil {
		return nil, &appError{
			Code:       "DATABASE_ERROR",
			Message:    "Score history could not be loaded.",
			StatusCode: http.StatusInternalServerError,
		}
	}
	defer rows.Close()

	history := []creditScoreState{}
	for rows.Next() {
		row, err := scanScore(rows)
		if err != nil {
			return nil, &appError{
				Code:       "DATABASE_ERROR",
				Message:    "Score history could not be loaded.",
				StatusCode: http.StatusInternalServerError,
			}
		}
		mapped, err := mapScore(row)
		if err != nil {
			return nil, &appError{
				Code:       "DATABASE_ERROR",
				Message:    "Score history could not be loaded.",
				StatusCode: http.StatusInternalServerError,
			}
		}
		history = append(history, mapped)
	}

	return history, nil
}

func (s *Server) listLoanRequests(ctx context.Context, address string) ([]loanRequestState, *appError) {
	s.syncOnchainBorrowerCredit(ctx, address)
	return s.listLoanRequestsFromDB(ctx, address)
}

func (s *Server) listLoanRequestsFromDB(ctx context.Context, address string) ([]loanRequestState, *appError) {
	rows, err := s.db.pool.Query(
		ctx,
		fmt.Sprintf(
			`SELECT "id","initiaAddress","amount","collateralAmount","merchantId","merchantCategory","merchantAddress","assetSymbol","tenorMonths","submittedAt","status","txHash","onchainRequestId"
			 FROM %s
			 WHERE "initiaAddress" = $1
			 ORDER BY "submittedAt" DESC`,
			s.db.table("LoanRequest"),
		),
		address,
	)
	if err != nil {
		return nil, &appError{
			Code:       "DATABASE_ERROR",
			Message:    "Loan requests could not be loaded.",
			StatusCode: http.StatusInternalServerError,
		}
	}
	defer rows.Close()

	requests := []loanRequestState{}
	seenOnchainRequestIDs := map[string]struct{}{}
	for rows.Next() {
		row, err := scanLoanRequest(rows)
		if err != nil {
			return nil, &appError{
				Code:       "DATABASE_ERROR",
				Message:    "Loan requests could not be loaded.",
				StatusCode: http.StatusInternalServerError,
			}
		}
		row = s.hydrateLoanRequestOnchainID(ctx, row)
		row = s.refreshLoanRequestRowFromOnchainView(ctx, row)
		onchainRequestID := trimStringPtr(row.OnchainRequestID)
		if onchainRequestID != "" {
			if _, exists := seenOnchainRequestIDs[onchainRequestID]; exists {
				continue
			}
			seenOnchainRequestIDs[onchainRequestID] = struct{}{}
		}
		requests = append(requests, mapLoanRequest(row))
	}

	return requests, nil
}

func (s *Server) listLoans(ctx context.Context, address string) ([]loanState, *appError) {
	s.syncOnchainBorrowerCredit(ctx, address)
	return s.listLoansFromDB(ctx, address)
}

func (s *Server) listLoansFromDB(ctx context.Context, address string) ([]loanState, *appError) {
	rows, err := s.db.pool.Query(
		ctx,
		fmt.Sprintf(
			`SELECT "id","initiaAddress","requestId","principal","collateralAmount","merchantId","merchantCategory","merchantAddress","collateralStatus","apr","tenorMonths","installmentsPaid","status","scheduleJson","txHashApprove","routeMode","onchainLoanId"
			 FROM %s
			 WHERE "initiaAddress" = $1
			 ORDER BY "id" DESC`,
			s.db.table("Loan"),
		),
		address,
	)
	if err != nil {
		return nil, &appError{
			Code:       "DATABASE_ERROR",
			Message:    "Loans could not be loaded.",
			StatusCode: http.StatusInternalServerError,
		}
	}
	defer rows.Close()

	loans := []loanState{}
	for rows.Next() {
		row, err := scanLoan(rows)
		if err != nil {
			return nil, &appError{
				Code:       "DATABASE_ERROR",
				Message:    "Loans could not be loaded.",
				StatusCode: http.StatusInternalServerError,
			}
		}
		if s.shouldHidePreviewLoan(ctx, row) {
			continue
		}
		mapped, err := mapLoan(row)
		if err != nil {
			return nil, &appError{
				Code:       "DATABASE_ERROR",
				Message:    "Loans could not be loaded.",
				StatusCode: http.StatusInternalServerError,
			}
		}
		loans = append(loans, mapped)
	}

	return loans, nil
}

func (s *Server) findLoanRequestByID(ctx context.Context, requestID string) (loanRequestRow, error) {
	return scanLoanRequest(s.db.pool.QueryRow(
		ctx,
		fmt.Sprintf(
			`SELECT "id","initiaAddress","amount","collateralAmount","merchantId","merchantCategory","merchantAddress","assetSymbol","tenorMonths","submittedAt","status","txHash","onchainRequestId"
			 FROM %s
			 WHERE "id" = $1`,
			s.db.table("LoanRequest"),
		),
		requestID,
	))
}

func (s *Server) shouldHidePreviewLoan(ctx context.Context, row loanRow) bool {
	if !strings.EqualFold(strings.TrimSpace(row.RouteMode), "preview") {
		return false
	}
	if strings.TrimSpace(row.Status) != "active" || strings.TrimSpace(row.RequestID) == "" {
		return false
	}

	requestRow, err := s.findLoanRequestByID(ctx, row.RequestID)
	if err != nil {
		return false
	}
	requestRow = s.hydrateLoanRequestOnchainID(ctx, requestRow)

	return trimStringPtr(requestRow.OnchainRequestID) != ""
}

func (s *Server) syncOnchainBorrowerCredit(ctx context.Context, address string) {
	if s.rollup == nil || strings.TrimSpace(address) == "" {
		return
	}

	hasActiveLoan, err := s.rollup.HasActiveLoanOf(ctx, address)
	if err == nil && hasActiveLoan {
		activeLoanID, err := s.rollup.ActiveLoanIDOf(ctx, address)
		if err != nil || activeLoanID == nil {
			return
		}

		loanView, err := s.rollup.GetLoan(ctx, *activeLoanID)
		if err != nil || loanView == nil {
			return
		}
		if !addressesMatch(loanView.Borrower, address) {
			return
		}

		requestRow, err := s.ensureOnchainRequestRow(ctx, address, *loanView)
		if err != nil {
			return
		}

		s.clearStalePendingRequests(ctx, address, trimStringPtr(requestRow.OnchainRequestID))
		_ = s.upsertOnchainLoanRow(ctx, address, requestRow, *loanView)
		return
	}

	pendingRequestView, err := s.rollup.FindPendingRequestOf(ctx, address, 512)
	if err == nil && pendingRequestView != nil {
		if row, upsertErr := s.upsertOnchainPendingRequestRow(ctx, address, *pendingRequestView); upsertErr == nil {
			log.Printf(
				"[loan-request] synced pending onchain request borrower=%s request_id=%s status=%s",
				address,
				trimStringPtr(row.OnchainRequestID),
				row.Status,
			)
		}
	} else if err == nil {
		s.clearStalePendingRequests(ctx, address, "")
	}

	rows, err := s.listLiveLoanRowsFromDB(ctx, address, "active")
	if err != nil {
		return
	}
	for _, row := range rows {
		onchainLoanID := trimStringPtr(row.OnchainLoanID)
		if onchainLoanID == "" {
			continue
		}

		loanView, err := s.rollup.GetLoan(ctx, onchainLoanID)
		if err != nil || loanView == nil {
			continue
		}
		if !addressesMatch(loanView.Borrower, address) {
			continue
		}

		_, _ = s.updateLoanRowFromOnchainView(ctx, row, *loanView)
	}
}

func (s *Server) clearStalePendingRequests(ctx context.Context, address, keepOnchainRequestID string) {
	trimmedAddress := strings.TrimSpace(address)
	if trimmedAddress == "" {
		return
	}

	query := fmt.Sprintf(
		`UPDATE %s
		 SET "status" = $2
		 WHERE "initiaAddress" = $1
		   AND "status" = 'pending'`,
		s.db.table("LoanRequest"),
	)
	args := []any{trimmedAddress, "cancelled"}

	if strings.TrimSpace(keepOnchainRequestID) != "" {
		query += ` AND COALESCE("onchainRequestId", '') <> $3`
		args = append(args, strings.TrimSpace(keepOnchainRequestID))
	}

	if _, err := s.db.pool.Exec(ctx, query, args...); err != nil {
		log.Printf("[loan-request] stale pending cleanup failed borrower=%s keep=%s err=%v", trimmedAddress, strings.TrimSpace(keepOnchainRequestID), err)
	}
}

func (s *Server) syncUserOnchainState(ctx context.Context, user userRow) (userRow, error) {
	if s.rollup == nil || strings.TrimSpace(user.InitiaAddress) == "" {
		return user, nil
	}

	synced := user
	hasOnchainData := false

	if account, err := s.rollup.GetRewardAccount(ctx, user.InitiaAddress); err == nil && account != nil {
		synced.BadgeCount = account.BadgeCount
		synced.ClaimableLend = account.ClaimableLend
		synced.CreditLimitBoostBps = account.CreditLimitBoostBps
		synced.InterestDiscountBps = account.InterestDiscountBps
		synced.Points = account.Points
		synced.PremiumChecksAvailable = account.PremiumChecksAvailable
		synced.Streak = account.Streak
		hasOnchainData = true
	}
	if heldLend, err := s.rollup.GetHeldLendBalance(ctx, user.InitiaAddress); err == nil {
		synced.HeldLend = heldLend
		hasOnchainData = true
	}
	if liquidLend, err := s.rollup.GetLendBalance(ctx, user.InitiaAddress); err == nil {
		synced.LiquidLend = liquidLend
		hasOnchainData = true
	}
	if stakedLend, err := s.rollup.GetStakedLendBalance(ctx, user.InitiaAddress); err == nil {
		synced.StakedLend = stakedLend
		hasOnchainData = true
	}
	if claimableStaking, err := s.rollup.GetClaimableStakingRewards(ctx, user.InitiaAddress); err == nil {
		synced.ClaimableStakingRewards = claimableStaking
		hasOnchainData = true
	}
	if lockedCollateral, err := s.rollup.GetLockedCollateral(ctx, user.InitiaAddress); err == nil {
		synced.LockedCollateralLend = lockedCollateral
		hasOnchainData = true
	}
	if referralStats, err := s.rollup.GetReferralStats(ctx, user.InitiaAddress); err == nil && referralStats != nil {
		synced.ReferralPointsEarned = referralStats.PointsEarned
		hasOnchainData = true
	}

	if !hasOnchainData {
		return user, nil
	}

	synced.Tier = deriveTier(synced.Points)
	row, err := scanUser(s.db.pool.QueryRow(
		ctx,
		fmt.Sprintf(
			`UPDATE %s
			 SET "referralPointsEarned" = $2,
			     "lockedCollateralLend" = $3,
			     "points" = $4,
			     "tier" = $5,
			     "heldLend" = $6,
			     "liquidLend" = $7,
			     "stakedLend" = $8,
			     "claimableLend" = $9,
			     "claimableStakingRewards" = $10,
			     "streak" = $11,
			     "creditLimitBoostBps" = $12,
			     "interestDiscountBps" = $13,
			     "premiumChecksAvailable" = $14,
			     "badgeCount" = $15,
			     "updatedAt" = $16
			 WHERE "initiaAddress" = $1
			 RETURNING %s`,
			s.db.table("User"),
			userColumns(),
		),
		user.InitiaAddress,
		synced.ReferralPointsEarned,
		synced.LockedCollateralLend,
		synced.Points,
		synced.Tier,
		synced.HeldLend,
		synced.LiquidLend,
		synced.StakedLend,
		synced.ClaimableLend,
		synced.ClaimableStakingRewards,
		synced.Streak,
		synced.CreditLimitBoostBps,
		synced.InterestDiscountBps,
		synced.PremiumChecksAvailable,
		synced.BadgeCount,
		time.Now().UTC(),
	))
	if err != nil {
		return userRow{}, err
	}

	return row, nil
}

func (s *Server) updateLoanRowFromOnchainView(ctx context.Context, row loanRow, loanView rollupLoanView) (loanRow, error) {
	scheduleJSON, err := json.Marshal(buildOnchainInstallmentSchedule(loanView))
	if err != nil {
		return loanRow{}, err
	}

	return scanLoan(s.db.pool.QueryRow(
		ctx,
		fmt.Sprintf(
			`UPDATE %s
			 SET "principal" = $2,
			     "collateralAmount" = $3,
			     "collateralStatus" = $4,
			     "apr" = $5,
			     "tenorMonths" = $6,
			     "installmentsPaid" = $7,
			     "status" = $8,
			     "scheduleJson" = $9,
			     "routeMode" = $10,
			     "onchainLoanId" = $11
			 WHERE "id" = $1
			 RETURNING "id","initiaAddress","requestId","principal","collateralAmount","merchantId","merchantCategory","merchantAddress","collateralStatus","apr","tenorMonths","installmentsPaid","status","scheduleJson","txHashApprove","routeMode","onchainLoanId"`,
			s.db.table("Loan"),
		),
		row.ID,
		loanView.Amount,
		loanView.CollateralAmount,
		mapOnchainCollateralStatus(loanView.CollateralState),
		float64(loanView.APRBps)/100,
		maxInt(loanView.TenorMonths, loanView.InstallmentsTotal),
		loanView.InstallmentsPaid,
		mapOnchainLoanStatus(loanView.Status),
		string(scheduleJSON),
		"live",
		loanView.ID,
	))
}

func (s *Server) listLiveLoanRowsFromDB(ctx context.Context, address string, status string) ([]loanRow, error) {
	rows, err := s.db.pool.Query(
		ctx,
		fmt.Sprintf(
			`SELECT "id","initiaAddress","requestId","principal","collateralAmount","merchantId","merchantCategory","merchantAddress","collateralStatus","apr","tenorMonths","installmentsPaid","status","scheduleJson","txHashApprove","routeMode","onchainLoanId"
			 FROM %s
			 WHERE "initiaAddress" = $1 AND "routeMode" = 'live' AND "status" = $2 AND "onchainLoanId" IS NOT NULL`,
			s.db.table("Loan"),
		),
		address,
		status,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	loans := []loanRow{}
	for rows.Next() {
		row, err := scanLoan(rows)
		if err != nil {
			return nil, err
		}
		loans = append(loans, row)
	}

	return loans, rows.Err()
}

func trimStringPtr(value *string) string {
	if value == nil {
		return ""
	}

	return strings.TrimSpace(*value)
}

func normalizedStringPtr(value string) *string {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return nil
	}

	return &trimmed
}

func (s *Server) ensureOnchainRequestRow(ctx context.Context, address string, loanView rollupLoanView) (loanRequestRow, error) {
	onchainRequestID := strings.TrimSpace(loanView.RequestID)
	if onchainRequestID == "" {
		return loanRequestRow{}, pgx.ErrNoRows
	}

	row, err := s.findLoanRequestByOnchainID(ctx, address, onchainRequestID)
	if err == nil {
		if row.Status != "approved" {
			updatedRow, updateErr := scanLoanRequest(s.db.pool.QueryRow(
				ctx,
				fmt.Sprintf(
					`UPDATE %s
					 SET "status" = $2
					 WHERE "id" = $1
					 RETURNING "id","initiaAddress","amount","collateralAmount","merchantId","merchantCategory","merchantAddress","assetSymbol","tenorMonths","submittedAt","status","txHash","onchainRequestId"`,
					s.db.table("LoanRequest"),
				),
				row.ID,
				"approved",
			))
			if updateErr == nil {
				return updatedRow, nil
			}
		}

		return row, nil
	}

	requestView, requestErr := s.rollup.GetRequest(ctx, onchainRequestID)
	if requestErr != nil || requestView == nil {
		requestView = &rollupRequestView{
			Amount:           loanView.Amount,
			Borrower:         address,
			CollateralAmount: loanView.CollateralAmount,
			ID:               onchainRequestID,
			Status:           onchainRequestStatusApproved,
			TenorMonths:      loanView.TenorMonths,
		}
	}

	submittedAt := time.Now().UTC()
	if requestView.CreatedAt > 0 {
		submittedAt = time.Unix(requestView.CreatedAt, 0).UTC()
	}

	insertedRow, insertErr := scanLoanRequest(s.db.pool.QueryRow(
		ctx,
		fmt.Sprintf(
			`INSERT INTO %s ("id","initiaAddress","amount","collateralAmount","merchantId","merchantCategory","merchantAddress","assetSymbol","tenorMonths","submittedAt","status","txHash","onchainRequestId")
			 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
			 RETURNING "id","initiaAddress","amount","collateralAmount","merchantId","merchantCategory","merchantAddress","assetSymbol","tenorMonths","submittedAt","status","txHash","onchainRequestId"`,
			s.db.table("LoanRequest"),
		),
		createID("request"),
		address,
		requestView.Amount,
		requestView.CollateralAmount,
		nil,
		nil,
		nil,
		s.cfg.RollupNativeSymbol,
		maxInt(requestView.TenorMonths, loanView.TenorMonths),
		submittedAt,
		mapOnchainRequestStatus(requestView.Status),
		nil,
		onchainRequestID,
	))
	if insertErr == nil {
		return insertedRow, nil
	}

	return s.findLoanRequestByOnchainID(ctx, address, onchainRequestID)
}

func (s *Server) upsertOnchainLoanRow(ctx context.Context, address string, requestRow loanRequestRow, loanView rollupLoanView) error {
	loanID := createID("loan")
	if existingRow, err := s.findLoanByRequestIDFromDB(ctx, requestRow.ID); err == nil {
		loanID = existingRow.ID
	} else if existingRow, err := s.findLoanByOnchainIDFromDB(ctx, address, loanView.ID); err == nil {
		loanID = existingRow.ID
	}

	scheduleJSON, err := json.Marshal(buildOnchainInstallmentSchedule(loanView))
	if err != nil {
		return err
	}

	_, err = scanLoan(s.db.pool.QueryRow(
		ctx,
		fmt.Sprintf(
			`INSERT INTO %s ("id","initiaAddress","requestId","principal","collateralAmount","merchantId","merchantCategory","merchantAddress","collateralStatus","apr","tenorMonths","installmentsPaid","status","scheduleJson","txHashApprove","routeMode","onchainLoanId")
			 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
			 ON CONFLICT ("requestId") DO UPDATE SET
			   "principal" = EXCLUDED."principal",
			   "collateralAmount" = EXCLUDED."collateralAmount",
			   "merchantId" = EXCLUDED."merchantId",
			   "merchantCategory" = EXCLUDED."merchantCategory",
			   "merchantAddress" = EXCLUDED."merchantAddress",
			   "collateralStatus" = EXCLUDED."collateralStatus",
			   "apr" = EXCLUDED."apr",
			   "tenorMonths" = EXCLUDED."tenorMonths",
			   "installmentsPaid" = EXCLUDED."installmentsPaid",
			   "status" = EXCLUDED."status",
			   "scheduleJson" = EXCLUDED."scheduleJson",
			   "routeMode" = EXCLUDED."routeMode",
			   "onchainLoanId" = EXCLUDED."onchainLoanId"
			 RETURNING "id","initiaAddress","requestId","principal","collateralAmount","merchantId","merchantCategory","merchantAddress","collateralStatus","apr","tenorMonths","installmentsPaid","status","scheduleJson","txHashApprove","routeMode","onchainLoanId"`,
			s.db.table("Loan"),
		),
		loanID,
		address,
		requestRow.ID,
		loanView.Amount,
		loanView.CollateralAmount,
		requestRow.MerchantID,
		requestRow.MerchantCategory,
		requestRow.MerchantAddress,
		mapOnchainCollateralStatus(loanView.CollateralState),
		float64(loanView.APRBps)/100,
		maxInt(loanView.TenorMonths, loanView.InstallmentsTotal),
		loanView.InstallmentsPaid,
		mapOnchainLoanStatus(loanView.Status),
		string(scheduleJSON),
		nil,
		"live",
		loanView.ID,
	))

	return err
}

func (s *Server) upsertOnchainPendingRequestRow(ctx context.Context, address string, requestView rollupRequestView) (loanRequestRow, error) {
	onchainRequestID := strings.TrimSpace(requestView.ID)
	if onchainRequestID == "" || !addressesMatch(requestView.Borrower, address) {
		return loanRequestRow{}, pgx.ErrNoRows
	}

	submittedAt := time.Now().UTC()
	if requestView.CreatedAt > 0 {
		submittedAt = time.Unix(requestView.CreatedAt, 0).UTC()
	}

	if row, err := s.findLoanRequestByOnchainID(ctx, address, onchainRequestID); err == nil {
		updatedRow, updateErr := scanLoanRequest(s.db.pool.QueryRow(
			ctx,
			fmt.Sprintf(
				`UPDATE %s
				 SET "amount" = $2,
				     "collateralAmount" = $3,
				     "tenorMonths" = $4,
				     "submittedAt" = $5,
				     "status" = $6
				 WHERE "id" = $1
				 RETURNING "id","initiaAddress","amount","collateralAmount","merchantId","merchantCategory","merchantAddress","assetSymbol","tenorMonths","submittedAt","status","txHash","onchainRequestId"`,
				s.db.table("LoanRequest"),
			),
			row.ID,
			requestView.Amount,
			requestView.CollateralAmount,
			requestView.TenorMonths,
			submittedAt,
			mapOnchainRequestStatus(requestView.Status),
		))
		if updateErr == nil {
			return updatedRow, nil
		}

		return row, nil
	}

	insertedRow, insertErr := scanLoanRequest(s.db.pool.QueryRow(
		ctx,
		fmt.Sprintf(
			`INSERT INTO %s ("id","initiaAddress","amount","collateralAmount","merchantId","merchantCategory","merchantAddress","assetSymbol","tenorMonths","submittedAt","status","txHash","onchainRequestId")
			 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
			 RETURNING "id","initiaAddress","amount","collateralAmount","merchantId","merchantCategory","merchantAddress","assetSymbol","tenorMonths","submittedAt","status","txHash","onchainRequestId"`,
			s.db.table("LoanRequest"),
		),
		createID("request"),
		address,
		requestView.Amount,
		requestView.CollateralAmount,
		nil,
		nil,
		nil,
		s.cfg.RollupNativeSymbol,
		requestView.TenorMonths,
		submittedAt,
		mapOnchainRequestStatus(requestView.Status),
		nil,
		onchainRequestID,
	))
	if insertErr == nil {
		return insertedRow, nil
	}

	return s.findLoanRequestByOnchainID(ctx, address, onchainRequestID)
}

func (s *Server) findLoanRequestByOnchainID(ctx context.Context, address, onchainRequestID string) (loanRequestRow, error) {
	return scanLoanRequest(s.db.pool.QueryRow(
		ctx,
		fmt.Sprintf(
			`SELECT "id","initiaAddress","amount","collateralAmount","merchantId","merchantCategory","merchantAddress","assetSymbol","tenorMonths","submittedAt","status","txHash","onchainRequestId"
			 FROM %s
			 WHERE "initiaAddress" = $1 AND "onchainRequestId" = $2
			 ORDER BY "submittedAt" DESC
			 LIMIT 1`,
			s.db.table("LoanRequest"),
		),
		address,
		onchainRequestID,
	))
}

func (s *Server) updateLoanRequestClientContext(ctx context.Context, row loanRequestRow, txHash string, merchant *merchantState) (loanRequestRow, error) {
	nextMerchantID := row.MerchantID
	nextMerchantCategory := row.MerchantCategory
	nextMerchantAddress := row.MerchantAddress
	nextTxHash := row.TxHash

	if merchant != nil {
		if merchantID := normalizedStringPtr(merchant.ID); merchantID != nil {
			nextMerchantID = merchantID
		}
		if merchantCategory := normalizedStringPtr(merchant.Category); merchantCategory != nil {
			nextMerchantCategory = merchantCategory
		}
		if merchantAddress := normalizedStringPtr(merchant.MerchantAddress); merchantAddress != nil {
			nextMerchantAddress = merchantAddress
		}
	}

	if normalizedTxHash := normalizedStringPtr(txHash); normalizedTxHash != nil {
		nextTxHash = normalizedTxHash
	}

	if trimStringPtr(nextMerchantID) == trimStringPtr(row.MerchantID) &&
		trimStringPtr(nextMerchantCategory) == trimStringPtr(row.MerchantCategory) &&
		trimStringPtr(nextMerchantAddress) == trimStringPtr(row.MerchantAddress) &&
		trimStringPtr(nextTxHash) == trimStringPtr(row.TxHash) {
		return row, nil
	}

	return scanLoanRequest(s.db.pool.QueryRow(
		ctx,
		fmt.Sprintf(
			`UPDATE %s
			 SET "merchantId" = $2,
			     "merchantCategory" = $3,
			     "merchantAddress" = $4,
			     "txHash" = $5
			 WHERE "id" = $1
			 RETURNING "id","initiaAddress","amount","collateralAmount","merchantId","merchantCategory","merchantAddress","assetSymbol","tenorMonths","submittedAt","status","txHash","onchainRequestId"`,
			s.db.table("LoanRequest"),
		),
		row.ID,
		nextMerchantID,
		nextMerchantCategory,
		nextMerchantAddress,
		nextTxHash,
	))
}

func (s *Server) findLoanByRequestIDFromDB(ctx context.Context, requestID string) (loanRow, error) {
	return scanLoan(s.db.pool.QueryRow(
		ctx,
		fmt.Sprintf(
			`SELECT "id","initiaAddress","requestId","principal","collateralAmount","merchantId","merchantCategory","merchantAddress","collateralStatus","apr","tenorMonths","installmentsPaid","status","scheduleJson","txHashApprove","routeMode","onchainLoanId"
			 FROM %s
			 WHERE "requestId" = $1`,
			s.db.table("Loan"),
		),
		requestID,
	))
}

func (s *Server) findLoanByOnchainIDFromDB(ctx context.Context, address, onchainLoanID string) (loanRow, error) {
	return scanLoan(s.db.pool.QueryRow(
		ctx,
		fmt.Sprintf(
			`SELECT "id","initiaAddress","requestId","principal","collateralAmount","merchantId","merchantCategory","merchantAddress","collateralStatus","apr","tenorMonths","installmentsPaid","status","scheduleJson","txHashApprove","routeMode","onchainLoanId"
			 FROM %s
			 WHERE "initiaAddress" = $1 AND "onchainLoanId" = $2
			 LIMIT 1`,
			s.db.table("Loan"),
		),
		address,
		onchainLoanID,
	))
}

func (s *Server) createLoanRequest(ctx context.Context, user userRow, input loanRequestInput) (loanRequestState, *appError) {
	log.Printf(
		"[loan-request] create start borrower=%s amount=%.2f tenor=%d profile_id=%d merchant_id=%s tx=%s",
		user.InitiaAddress,
		input.Amount,
		input.TenorMonths,
		input.ProfileID,
		strings.TrimSpace(input.MerchantID),
		strings.TrimSpace(input.TxHash),
	)

	if input.Amount <= 0 || input.TenorMonths <= 0 {
		return loanRequestState{}, &appError{
			Code:       "VALIDATION_ERROR",
			Message:    "Amount and tenorMonths must be positive.",
			StatusCode: http.StatusBadRequest,
		}
	}

	score, appErr := s.getLatestScore(ctx, user)
	if appErr != nil {
		return loanRequestState{}, appErr
	}

	profile, appErr := s.findProfileQuote(user, score, input.ProfileID)
	if appErr != nil {
		return loanRequestState{}, appErr
	}

	if !profile.Qualified {
		return loanRequestState{}, &appError{
			Code:       "PROFILE_NOT_QUALIFIED",
			Message:    "The wallet does not qualify for the selected credit profile yet.",
			StatusCode: http.StatusBadRequest,
		}
	}

	if input.Amount > float64(profile.MaxPrincipal) {
		return loanRequestState{}, &appError{
			Code:       "LIMIT_EXCEEDED",
			Message:    "Requested amount exceeds the approved limit.",
			StatusCode: http.StatusBadRequest,
		}
	}

	if input.TenorMonths > profile.MaxTenorMonths {
		return loanRequestState{}, &appError{
			Code:       "TENOR_NOT_ALLOWED",
			Message:    "Requested tenor is above the selected profile allowance.",
			StatusCode: http.StatusBadRequest,
		}
	}

	if profile.RequiresCollateral {
		minimumCollateral := requiredCollateralFor(input.Amount, profile.CollateralRatioBps)
		if input.CollateralAmount < minimumCollateral {
			return loanRequestState{}, &appError{
				Code:       "INSUFFICIENT_COLLATERAL",
				Message:    fmt.Sprintf("Collateralized requests need at least %.0f LEND locked.", minimumCollateral),
				StatusCode: http.StatusBadRequest,
			}
		}
	} else if input.CollateralAmount > 0 {
		return loanRequestState{}, &appError{
			Code:       "COLLATERAL_NOT_ALLOWED",
			Message:    "This profile does not accept collateral input.",
			StatusCode: http.StatusBadRequest,
		}
	}

	var merchant *merchantState
	if input.MerchantID != "" {
		for _, item := range s.merchants {
			if item.ID == input.MerchantID {
				copyItem := item
				merchant = &copyItem
				break
			}
		}
		if merchant == nil {
			return loanRequestState{}, &appError{
				Code:       "APP_NOT_FOUND",
				Message:    "The selected app was not found.",
				StatusCode: http.StatusBadRequest,
			}
		}
	}

	txHash := strings.TrimSpace(input.TxHash)
	onchainRequestID := ""
	if s.rollup != nil {
		if txHash == "" {
			return loanRequestState{}, &appError{
				Code:       "REQUEST_TX_REQUIRED",
				Message:    "Live credit requests must include the wallet transaction hash so LendPay can confirm it onchain.",
				StatusCode: http.StatusBadRequest,
			}
		}
		confirmedID, appErr := s.confirmLiveRequest(ctx, user.InitiaAddress, txHash)
		if appErr != nil {
			log.Printf(
				"[loan-request] create failed during live confirmation borrower=%s tx=%s code=%s message=%s",
				user.InitiaAddress,
				txHash,
				appErr.Code,
				appErr.Message,
			)
			return loanRequestState{}, appErr
		}
		onchainRequestID = confirmedID

		requestView, err := s.rollup.GetRequest(ctx, confirmedID)
		if err != nil || requestView == nil || !addressesMatch(requestView.Borrower, user.InitiaAddress) {
			log.Printf("[loan-request] create failed during request sync borrower=%s tx=%s request_id=%s err=%v", user.InitiaAddress, txHash, confirmedID, err)
			return loanRequestState{}, &appError{
				Code:       "REQUEST_TX_MISMATCH",
				Message:    "The confirmed transaction could not be matched to a live credit request onchain.",
				StatusCode: http.StatusBadRequest,
			}
		}

		row, err := s.upsertOnchainPendingRequestRow(ctx, user.InitiaAddress, *requestView)
		if err != nil {
			log.Printf("[loan-request] create failed during onchain upsert borrower=%s tx=%s request_id=%s err=%v", user.InitiaAddress, txHash, confirmedID, err)
			return loanRequestState{}, &appError{
				Code:       "DATABASE_ERROR",
				Message:    "Loan request could not be synchronized.",
				StatusCode: http.StatusInternalServerError,
			}
		}

		s.clearStalePendingRequests(ctx, user.InitiaAddress, confirmedID)

		row, err = s.updateLoanRequestClientContext(ctx, row, txHash, merchant)
		if err != nil {
			log.Printf("[loan-request] create failed during client context update borrower=%s tx=%s request_id=%s err=%v", user.InitiaAddress, txHash, confirmedID, err)
			return loanRequestState{}, &appError{
				Code:       "DATABASE_ERROR",
				Message:    "Loan request could not be synchronized.",
				StatusCode: http.StatusInternalServerError,
			}
		}

		log.Printf(
			"[loan-request] create success borrower=%s request_id=%s onchain_request_id=%s status=%s tx=%s",
			user.InitiaAddress,
			row.ID,
			trimStringPtr(row.OnchainRequestID),
			row.Status,
			strings.TrimSpace(txHash),
		)
		return mapLoanRequest(row), nil
	}

	requests, appErr := s.listLoanRequests(ctx, user.InitiaAddress)
	if appErr != nil {
		return loanRequestState{}, appErr
	}
	for _, request := range requests {
		if request.Status == "pending" {
			return loanRequestState{}, &appError{
				Code:       "PENDING_REQUEST_EXISTS",
				Message:    "A credit request is already pending.",
				StatusCode: http.StatusConflict,
			}
		}
	}

	loans, appErr := s.listLoans(ctx, user.InitiaAddress)
	if appErr != nil {
		return loanRequestState{}, appErr
	}
	for _, loan := range loans {
		if loan.Status == "active" {
			return loanRequestState{}, &appError{
				Code:       "ACTIVE_LOAN_EXISTS",
				Message:    "Finish the current active credit before requesting a new one.",
				StatusCode: http.StatusConflict,
			}
		}
	}

	now := time.Now().UTC()
	if txHash == "" {
		txHash = previewTxHash("request", user.InitiaAddress)
	}

	row, err := scanLoanRequest(s.db.pool.QueryRow(
		ctx,
		fmt.Sprintf(
			`INSERT INTO %s ("id","initiaAddress","amount","collateralAmount","merchantId","merchantCategory","merchantAddress","assetSymbol","tenorMonths","submittedAt","status","txHash","onchainRequestId")
			 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
			 RETURNING "id","initiaAddress","amount","collateralAmount","merchantId","merchantCategory","merchantAddress","assetSymbol","tenorMonths","submittedAt","status","txHash","onchainRequestId"`,
			s.db.table("LoanRequest"),
		),
		createID("request"),
		user.InitiaAddress,
		input.Amount,
		input.CollateralAmount,
		stringPtrValue(merchant, func(item merchantState) *string { value := item.ID; return &value }),
		stringPtrValue(merchant, func(item merchantState) *string { value := item.Category; return &value }),
		stringPtrValue(merchant, func(item merchantState) *string { value := item.MerchantAddress; return &value }),
		s.cfg.RollupNativeSymbol,
		input.TenorMonths,
		now,
		"pending",
		txHash,
		stringPtrValue(&onchainRequestID, func(value string) *string {
			trimmed := strings.TrimSpace(value)
			if trimmed == "" {
				return nil
			}
			return &trimmed
		}),
	))
	if err != nil {
		log.Printf("[loan-request] create failed during insert borrower=%s err=%v", user.InitiaAddress, err)
		return loanRequestState{}, &appError{
			Code:       "DATABASE_ERROR",
			Message:    "Loan request could not be created.",
			StatusCode: http.StatusInternalServerError,
		}
	}

	_ = s.pushActivity(ctx, user.InitiaAddress, activityItem{
		ID:        createID("activity"),
		Kind:      "loan",
		Label:     "Credit requested",
		Detail:    fmt.Sprintf("%.2f USD requested over %d month(s).", input.Amount, input.TenorMonths),
		Timestamp: isoTime(now),
	})

	row = s.hydrateLoanRequestOnchainID(ctx, row)
	log.Printf(
		"[loan-request] create success borrower=%s request_id=%s onchain_request_id=%s status=%s tx=%s",
		user.InitiaAddress,
		row.ID,
		trimStringPtr(row.OnchainRequestID),
		row.Status,
		strings.TrimSpace(txHash),
	)
	return mapLoanRequest(row), nil
}

func (s *Server) confirmLiveRequest(ctx context.Context, borrowerAddress, txHash string) (string, *appError) {
	log.Printf("[loan-request] confirm live request borrower=%s tx=%s", borrowerAddress, txHash)

	if s.rollup == nil {
		return "", &appError{
			Code:       "ROLLUP_CONFIRMATION_UNAVAILABLE",
			Message:    "Rollup confirmation is unavailable right now.",
			StatusCode: http.StatusServiceUnavailable,
		}
	}

	if _, appErr := s.waitForTxConfirmation(ctx, txHash); appErr != nil {
		return "", appErr
	}

	requestID := s.rollup.GetLoanRequestIDByTxHash(ctx, txHash)
	if requestID == nil || strings.TrimSpace(*requestID) == "" {
		log.Printf("[loan-request] no request event found borrower=%s tx=%s", borrowerAddress, txHash)
		return "", &appError{
			Code:       "REQUEST_TX_MISMATCH",
			Message:    "The confirmed transaction does not expose a loan request event. If your wallet just enabled auto-sign, retry the credit request so LendPay receives the actual request transaction hash.",
			StatusCode: http.StatusBadRequest,
		}
	}

	requestView, err := s.rollup.GetRequest(ctx, strings.TrimSpace(*requestID))
	if err != nil || requestView == nil {
		log.Printf("[loan-request] request lookup failed borrower=%s tx=%s request_id=%s err=%v", borrowerAddress, txHash, strings.TrimSpace(*requestID), err)
		return "", &appError{
			Code:       "REQUEST_TX_MISMATCH",
			Message:    "The confirmed transaction could not be matched to a live credit request onchain.",
			StatusCode: http.StatusBadRequest,
		}
	}
	if !addressesMatch(requestView.Borrower, borrowerAddress) {
		log.Printf("[loan-request] request borrower mismatch tx=%s expected=%s actual=%s", txHash, borrowerAddress, strings.TrimSpace(requestView.Borrower))
		return "", &appError{
			Code:       "REQUEST_TX_MISMATCH",
			Message:    "The confirmed request belongs to a different borrower.",
			StatusCode: http.StatusBadRequest,
		}
	}

	log.Printf("[loan-request] confirm success borrower=%s tx=%s request_id=%s", borrowerAddress, txHash, strings.TrimSpace(*requestID))
	return strings.TrimSpace(*requestID), nil
}

func requiredCollateralFor(amount float64, ratioBps int) float64 {
	return math.Ceil(amount * float64(ratioBps) / 10000)
}

func stringPtrValue[T any](item *T, getter func(T) *string) *string {
	if item == nil {
		return nil
	}

	return getter(*item)
}

func (s *Server) findProfileQuote(user userRow, score creditScoreState, profileID int) (creditProfileQuote, *appError) {
	quotes := s.profileQuotes(user, score)
	selectedID := profileID
	if selectedID == 0 {
		selectedID = 1
	}

	for _, quote := range quotes {
		if quote.ProfileID == selectedID {
			return quote, nil
		}
	}

	return creditProfileQuote{}, &appError{
		Code:       "PROFILE_UNAVAILABLE",
		Message:    "The selected profile could not be loaded.",
		StatusCode: http.StatusBadRequest,
	}
}

func (s *Server) profileQuotes(user userRow, score creditScoreState) []creditProfileQuote {
	if onchainQuotes := s.profileQuotesFromRollup(user); len(onchainQuotes) > 0 {
		return onchainQuotes
	}

	return []creditProfileQuote{
		{
			CollateralRatioBps:     0,
			CreditLimitBoostBps:    user.CreditLimitBoostBps,
			CurrentLendHoldings:    user.HeldLend,
			Label:                  "micro_loan",
			MaxPrincipal:           minInt(score.LimitUSD, 500),
			MaxTenorMonths:         3,
			MinLendHoldings:        0,
			ProfileID:              1,
			Qualified:              true,
			RequiresCollateral:     false,
			Revolving:              false,
			Source:                 profileQuoteSourcePreview,
			TierLimitMultiplierBps: 10000,
		},
		{
			CollateralRatioBps:     0,
			CreditLimitBoostBps:    user.CreditLimitBoostBps,
			CurrentLendHoldings:    user.HeldLend,
			Label:                  "standard_bnpl",
			MaxPrincipal:           minInt(score.LimitUSD+250, 2500),
			MaxTenorMonths:         6,
			MinLendHoldings:        100,
			ProfileID:              2,
			Qualified:              user.HeldLend >= 100,
			RequiresCollateral:     false,
			Revolving:              false,
			Source:                 profileQuoteSourcePreview,
			TierLimitMultiplierBps: 10000,
		},
		{
			CollateralRatioBps:     0,
			CreditLimitBoostBps:    user.CreditLimitBoostBps,
			CurrentLendHoldings:    user.HeldLend,
			Label:                  "credit_line",
			MaxPrincipal:           maxInt(500, minInt(score.LimitUSD+500, 5000)),
			MaxTenorMonths:         12,
			MinLendHoldings:        500,
			ProfileID:              3,
			Qualified:              user.HeldLend >= 500,
			RequiresCollateral:     false,
			Revolving:              true,
			Source:                 profileQuoteSourcePreview,
			TierLimitMultiplierBps: 10000,
		},
		{
			CollateralRatioBps:     15000,
			CreditLimitBoostBps:    user.CreditLimitBoostBps,
			CurrentLendHoldings:    user.HeldLend,
			Label:                  "collateralized",
			MaxPrincipal:           maxInt(300, maxInt(score.LimitUSD, 1500)),
			MaxTenorMonths:         18,
			MinLendHoldings:        0,
			ProfileID:              4,
			Qualified:              true,
			RequiresCollateral:     true,
			Revolving:              false,
			Source:                 profileQuoteSourcePreview,
			TierLimitMultiplierBps: 10000,
		},
	}
}

func (s *Server) profileQuotesFromRollup(user userRow) []creditProfileQuote {
	if s.rollup == nil || strings.TrimSpace(user.InitiaAddress) == "" {
		return nil
	}

	profileIDs := []int{1, 2, 3, 4}
	quotes := make([]creditProfileQuote, 0, len(profileIDs))
	for _, profileID := range profileIDs {
		quote, err := s.rollup.QuoteProfile(context.Background(), user.InitiaAddress, profileID)
		if err != nil || quote == nil {
			return nil
		}

		quotes = append(quotes, creditProfileQuote{
			CollateralRatioBps:     quote.CollateralRatioBps,
			CreditLimitBoostBps:    quote.CreditLimitBoostBps,
			CurrentLendHoldings:    quote.CurrentLendHoldings,
			Label:                  profileLabelForID(profileID),
			MaxPrincipal:           quote.MaxPrincipal,
			MaxTenorMonths:         quote.MaxTenorMonths,
			MinLendHoldings:        quote.MinLendHoldings,
			ProfileID:              quote.ProfileID,
			Qualified:              quote.Qualified,
			RequiresCollateral:     quote.RequiresCollateral,
			Revolving:              quote.Revolving,
			Source:                 profileQuoteSourceRollup,
			TierLimitMultiplierBps: quote.TierLimitMultiplierBps,
		})
	}

	return quotes
}

func profileLabelForID(profileID int) string {
	switch profileID {
	case 1:
		return "micro_loan"
	case 2:
		return "standard_bnpl"
	case 3:
		return "credit_line"
	case 4:
		return "collateralized"
	default:
		return fmt.Sprintf("profile_%d", profileID)
	}
}

func maxInt(left, right int) int {
	if left > right {
		return left
	}

	return right
}

func (s *Server) reviewDemoLoanRequest(ctx context.Context, user userRow, requestID, reason string) (map[string]any, *appError) {
	return s.approveLoanRequest(ctx, requestID, "preview-operator", reason, user.InitiaAddress)
}

func (s *Server) runtimeMode() string {
	if s.liveRollupWritesEnabled() {
		return "live"
	}

	return "preview"
}

func (s *Server) liveRollupWritesEnabled() bool {
	return s.cfg.EnableLiveRollupWrites &&
		strings.TrimSpace(s.cfg.MinitiadBin) != "" &&
		strings.TrimSpace(s.cfg.RollupChainID) != "" &&
		strings.TrimSpace(s.cfg.RollupRPCURL) != "" &&
		strings.TrimSpace(s.cfg.RollupKeyName) != "" &&
		strings.TrimSpace(s.cfg.LendpayPackageAddress) != "" &&
		strings.TrimSpace(s.cfg.ApproveFunctionName) != ""
}

func fixedApprovalInstallmentAmount(principal float64, apr float64, tenorMonths int) int {
	if tenorMonths <= 0 {
		return 0
	}

	total := principal * (1 + (apr/100)*float64(tenorMonths)/12)
	return maxInt(1, int(math.Round(total/float64(tenorMonths))))
}

func approvalAPRbps(apr float64) int {
	return maxInt(0, int(math.Round(apr*100)))
}

func (s *Server) runMinitiadTx(ctx context.Context, args ...string) (minitiadTxResponse, error) {
	runCommand := func(commandArgs []string) ([]byte, error) {
		cmd := exec.CommandContext(ctx, s.cfg.MinitiadBin, commandArgs...)
		cmd.Env = os.Environ()

		if strings.Contains(s.cfg.MinitiadBin, "/") {
			minitiadDir := filepath.Dir(s.cfg.MinitiadBin)
			moveVMLib := filepath.Join(minitiadDir, "libmovevm.x86_64.so")
			if _, err := os.Stat(moveVMLib); err == nil {
				currentLD := ""
				for _, envVar := range cmd.Env {
					if strings.HasPrefix(envVar, "LD_LIBRARY_PATH=") {
						currentLD = strings.TrimPrefix(envVar, "LD_LIBRARY_PATH=")
						break
					}
				}

				nextLD := minitiadDir
				if currentLD != "" {
					nextLD = fmt.Sprintf("%s:%s", minitiadDir, currentLD)
				}
				cmd.Env = append(cmd.Env, fmt.Sprintf("LD_LIBRARY_PATH=%s", nextLD))
			}
		}

		return cmd.CombinedOutput()
	}

	output, err := runCommand(args)
	result, parseErr := parseMinitiadTxResponse(output)
	if parseErr != nil {
		if estimate, ok := extractGasEstimate(output); ok && usesAutoGas(args) {
			retryArgs := argsWithFixedGas(args, adjustedGasLimit(estimate, s.cfg.RollupGasAdjustment))
			retryOutput, retryErr := runCommand(retryArgs)
			retryResult, retryParseErr := parseMinitiadTxResponse(retryOutput)
			if retryParseErr == nil {
				if retryErr != nil {
					return retryResult, fmt.Errorf("%w: %s", retryErr, strings.TrimSpace(retryResult.RawLog))
				}

				return retryResult, nil
			}
			if retryErr != nil {
				return retryResult, fmt.Errorf("%w: %s", retryErr, strings.TrimSpace(string(retryOutput)))
			}

			return retryResult, retryParseErr
		}

		if err != nil {
			return result, fmt.Errorf("%w: %s", err, strings.TrimSpace(string(output)))
		}

		return result, parseErr
	}
	if err != nil {
		return result, fmt.Errorf("%w: %s", err, strings.TrimSpace(result.RawLog))
	}

	return result, nil
}

func (s *Server) broadcastLiveApproveRequest(
	ctx context.Context,
	requestRow loanRequestRow,
	score creditScoreState,
) (string, *appError) {
	if !s.liveRollupWritesEnabled() {
		return "", &appError{
			Code:       "LIVE_OPERATOR_UNAVAILABLE",
			Message:    "Live operator writes are not enabled on this backend.",
			StatusCode: http.StatusConflict,
		}
	}

	onchainRequestID := trimStringPtr(requestRow.OnchainRequestID)
	if onchainRequestID == "" {
		return "", &appError{
			Code:       "REQUEST_NOT_ONCHAIN",
			Message:    "The request is not linked to an onchain request id yet.",
			StatusCode: http.StatusBadRequest,
		}
	}
	if _, err := strconv.Atoi(onchainRequestID); err != nil {
		return "", &appError{
			Code:       "REQUEST_ID_INVALID",
			Message:    "The onchain request id is invalid.",
			StatusCode: http.StatusBadRequest,
		}
	}

	installmentAmount := fixedApprovalInstallmentAmount(requestRow.Amount, score.APR, requestRow.TenorMonths)
	if installmentAmount <= 0 {
		return "", &appError{
			Code:       "APPROVAL_PLAN_INVALID",
			Message:    "The approval plan could not be computed.",
			StatusCode: http.StatusBadRequest,
		}
	}

	args := []string{
		"tx", "move", "execute",
		s.cfg.LendpayPackageAddress,
		s.cfg.LoanModuleName,
		s.cfg.ApproveFunctionName,
		"--args",
		fmt.Sprintf(
			"[\"u64:%s\", \"u64:%d\", \"u64:%d\", \"u64:%d\", \"u64:%d\"]",
			onchainRequestID,
			approvalAPRbps(score.APR),
			installmentAmount,
			requestRow.TenorMonths,
			86_400,
		),
	}

	if home := strings.TrimSpace(s.cfg.RollupHome); home != "" {
		args = append(args, "--home", home)
	}

	args = append(
		args,
		"--from", s.cfg.RollupKeyName,
		"--keyring-backend", s.cfg.RollupKeyringBackend,
		"--node", s.cfg.RollupRPCURL,
		"--chain-id", s.cfg.RollupChainID,
		"--gas", "auto",
		"--gas-adjustment", s.cfg.RollupGasAdjustment,
		"--gas-prices", s.cfg.RollupGasPrices,
		"--yes",
		"--output", "json",
	)

	result, err := s.runMinitiadTx(ctx, args...)
	if err != nil {
		log.Printf("[loan-request] live approve broadcast failed request_id=%s err=%v", onchainRequestID, err)
		return "", &appError{
			Code:       "LIVE_APPROVAL_FAILED",
			Message:    "The operator approval transaction could not be broadcast.",
			StatusCode: http.StatusServiceUnavailable,
		}
	}
	if strings.TrimSpace(result.TxHash) == "" {
		return "", &appError{
			Code:       "LIVE_APPROVAL_FAILED",
			Message:    "The operator approval transaction did not return a tx hash.",
			StatusCode: http.StatusServiceUnavailable,
		}
	}
	if result.Code != 0 {
		return "", &appError{
			Code:       "LIVE_APPROVAL_FAILED",
			Message:    "The operator approval transaction was rejected by the rollup.",
			StatusCode: http.StatusBadRequest,
		}
	}

	return strings.TrimSpace(result.TxHash), nil
}

func (s *Server) setLoanApprovalTxHash(ctx context.Context, requestID, txHash string) (loanRow, error) {
	return scanLoan(s.db.pool.QueryRow(
		ctx,
		fmt.Sprintf(
			`UPDATE %s
			 SET "txHashApprove" = $2
			 WHERE "requestId" = $1
			 RETURNING "id","initiaAddress","requestId","principal","collateralAmount","merchantId","merchantCategory","merchantAddress","collateralStatus","apr","tenorMonths","installmentsPaid","status","scheduleJson","txHashApprove","routeMode","onchainLoanId"`,
			s.db.table("Loan"),
		),
		requestID,
		txHash,
	))
}

func (s *Server) approveLiveLoanRequest(
	ctx context.Context,
	requestRow loanRequestRow,
	borrower userRow,
	score creditScoreState,
	operatorAddress string,
	reason string,
) (map[string]any, *appError) {
	txHash, appErr := s.broadcastLiveApproveRequest(ctx, requestRow, score)
	if appErr != nil {
		return nil, appErr
	}

	if _, appErr := s.waitForTxConfirmation(ctx, txHash); appErr != nil {
		return nil, appErr
	}

	s.syncOnchainBorrowerCredit(ctx, borrower.InitiaAddress)
	_, _ = s.syncUserOnchainState(ctx, borrower)

	approvedRequestRow, err := s.findLoanRequestByOnchainID(ctx, borrower.InitiaAddress, trimStringPtr(requestRow.OnchainRequestID))
	if err != nil {
		return nil, &appError{
			Code:       "DATABASE_ERROR",
			Message:    "The approved request could not be loaded.",
			StatusCode: http.StatusInternalServerError,
		}
	}
	approvedRequestRow = s.refreshLoanRequestRowFromOnchainView(ctx, approvedRequestRow)

	loanRow, err := s.setLoanApprovalTxHash(ctx, approvedRequestRow.ID, txHash)
	if err != nil {
		return nil, &appError{
			Code:       "DATABASE_ERROR",
			Message:    "The approved loan could not be loaded.",
			StatusCode: http.StatusInternalServerError,
		}
	}

	_, err = s.db.pool.Exec(
		ctx,
		fmt.Sprintf(
			`INSERT INTO %s ("id","actorAddress","actionType","targetType","targetId","reason","txHash","status","createdAt")
			 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
			s.db.table("OperatorAction"),
		),
		createID("operator"),
		operatorAddress,
		"approve_request",
		"loan_request",
		approvedRequestRow.ID,
		strings.TrimSpace(reason),
		txHash,
		"live",
		time.Now().UTC(),
	)
	if err != nil {
		return nil, &appError{
			Code:       "DATABASE_ERROR",
			Message:    "Approval audit trail could not be stored.",
			StatusCode: http.StatusInternalServerError,
		}
	}

	loan, err := mapLoan(loanRow)
	if err != nil {
		return nil, &appError{
			Code:       "DATABASE_ERROR",
			Message:    "Loan could not be materialized.",
			StatusCode: http.StatusInternalServerError,
		}
	}

	return map[string]any{
		"loan":    loan,
		"mode":    "live",
		"request": mapLoanRequest(approvedRequestRow),
		"txHash":  txHash,
	}, nil
}

func (s *Server) hydrateLoanRequestOnchainID(ctx context.Context, row loanRequestRow) loanRequestRow {
	if row.OnchainRequestID != nil || row.TxHash == nil {
		return row
	}

	onchainRequestID := s.rollup.GetLoanRequestIDByTxHash(ctx, *row.TxHash)
	if onchainRequestID == nil {
		return row
	}

	updatedRow, err := scanLoanRequest(s.db.pool.QueryRow(
		ctx,
		fmt.Sprintf(
			`UPDATE %s
			 SET "onchainRequestId" = $2
			 WHERE "id" = $1
			 RETURNING "id","initiaAddress","amount","collateralAmount","merchantId","merchantCategory","merchantAddress","assetSymbol","tenorMonths","submittedAt","status","txHash","onchainRequestId"`,
			s.db.table("LoanRequest"),
		),
		row.ID,
		*onchainRequestID,
	))
	if err == nil {
		return updatedRow
	}

	row.OnchainRequestID = onchainRequestID
	return row
}

func (s *Server) refreshLoanRequestRowFromOnchainView(ctx context.Context, row loanRequestRow) loanRequestRow {
	if s.rollup == nil {
		return row
	}

	onchainRequestID := trimStringPtr(row.OnchainRequestID)
	if onchainRequestID == "" {
		return row
	}

	requestView, err := s.rollup.GetRequest(ctx, onchainRequestID)
	if err != nil || requestView == nil {
		return row
	}
	if !addressesMatch(requestView.Borrower, row.InitiaAddress) {
		return row
	}

	submittedAt := row.SubmittedAt
	if requestView.CreatedAt > 0 {
		submittedAt = time.Unix(requestView.CreatedAt, 0).UTC()
	} else if submittedAt.IsZero() {
		submittedAt = time.Now().UTC()
	}

	updatedRow, err := scanLoanRequest(s.db.pool.QueryRow(
		ctx,
		fmt.Sprintf(
			`UPDATE %s
			 SET "amount" = $2,
			     "collateralAmount" = $3,
			     "tenorMonths" = $4,
			     "submittedAt" = $5,
			     "status" = $6
			 WHERE "id" = $1
			 RETURNING "id","initiaAddress","amount","collateralAmount","merchantId","merchantCategory","merchantAddress","assetSymbol","tenorMonths","submittedAt","status","txHash","onchainRequestId"`,
			s.db.table("LoanRequest"),
		),
		row.ID,
		requestView.Amount,
		requestView.CollateralAmount,
		requestView.TenorMonths,
		submittedAt,
		mapOnchainRequestStatus(requestView.Status),
	))
	if err == nil {
		return updatedRow
	}

	return row
}

func (s *Server) approveLoanRequest(
	ctx context.Context,
	requestID string,
	operatorAddress string,
	reason string,
	requiredBorrowerAddress string,
) (map[string]any, *appError) {
	if !s.cfg.PreviewApprovalEnabled {
		return nil, &appError{
			Code:       "DEMO_REVIEW_DISABLED",
			Message:    "Demo approval is disabled on this backend.",
			StatusCode: http.StatusForbidden,
		}
	}

	requestRow, err := scanLoanRequest(s.db.pool.QueryRow(
		ctx,
		fmt.Sprintf(
			`SELECT "id","initiaAddress","amount","collateralAmount","merchantId","merchantCategory","merchantAddress","assetSymbol","tenorMonths","submittedAt","status","txHash","onchainRequestId"
			 FROM %s
			 WHERE "id" = $1`,
			s.db.table("LoanRequest"),
		),
		requestID,
	))
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, &appError{
			Code:       "REQUEST_NOT_FOUND",
			Message:    "Loan request was not found.",
			StatusCode: http.StatusNotFound,
		}
	}
	if err != nil {
		return nil, &appError{
			Code:       "DATABASE_ERROR",
			Message:    "Loan request could not be loaded.",
			StatusCode: http.StatusInternalServerError,
		}
	}
	requestRow = s.hydrateLoanRequestOnchainID(ctx, requestRow)
	if requiredBorrowerAddress != "" && requestRow.InitiaAddress != requiredBorrowerAddress {
		return nil, &appError{
			Code:       "REQUEST_FORBIDDEN",
			Message:    "You can only review your own pending requests.",
			StatusCode: http.StatusForbidden,
		}
	}
	if requestRow.Status != "pending" {
		return nil, &appError{
			Code:       "REQUEST_NOT_PENDING",
			Message:    "Only pending requests can be approved.",
			StatusCode: http.StatusBadRequest,
		}
	}

	borrower, err := s.findUserByAddress(ctx, requestRow.InitiaAddress)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, &appError{
			Code:       "BORROWER_NOT_FOUND",
			Message:    "Borrower profile was not found.",
			StatusCode: http.StatusNotFound,
		}
	}
	if err != nil {
		return nil, &appError{
			Code:       "DATABASE_ERROR",
			Message:    "Borrower profile could not be loaded.",
			StatusCode: http.StatusInternalServerError,
		}
	}

	score, appErr := s.getLatestScore(ctx, borrower)
	if appErr != nil {
		return nil, appErr
	}

	if trimStringPtr(requestRow.OnchainRequestID) != "" {
		if s.liveRollupWritesEnabled() {
			return s.approveLiveLoanRequest(ctx, requestRow, borrower, score, operatorAddress, reason)
		}

		return nil, &appError{
			Code:       "LIVE_REQUEST_REVIEW_UNAVAILABLE",
			Message:    "This request already exists onchain, but live operator writes are not enabled on this backend.",
			StatusCode: http.StatusConflict,
		}
	}

	approvedRequestRow, err := scanLoanRequest(s.db.pool.QueryRow(
		ctx,
		fmt.Sprintf(
			`UPDATE %s
			 SET "status" = $2
			 WHERE "id" = $1
			 RETURNING "id","initiaAddress","amount","collateralAmount","merchantId","merchantCategory","merchantAddress","assetSymbol","tenorMonths","submittedAt","status","txHash","onchainRequestId"`,
			s.db.table("LoanRequest"),
		),
		requestID,
		"approved",
	))
	if err != nil {
		return nil, &appError{
			Code:       "DATABASE_ERROR",
			Message:    "Loan request could not be approved.",
			StatusCode: http.StatusInternalServerError,
		}
	}

	txHash := previewTxHash("approve", requestID)
	schedule := buildInstallmentSchedule(requestRow.Amount, score.APR, requestRow.TenorMonths)
	scheduleJSON, _ := json.Marshal(schedule)
	loanID := createID("loan")
	if existingID, existingErr := s.findLoanIDByRequestID(ctx, requestID); existingErr == nil {
		loanID = existingID
	}

	loanRow, err := scanLoan(s.db.pool.QueryRow(
		ctx,
		fmt.Sprintf(
			`INSERT INTO %s ("id","initiaAddress","requestId","principal","collateralAmount","merchantId","merchantCategory","merchantAddress","collateralStatus","apr","tenorMonths","installmentsPaid","status","scheduleJson","txHashApprove","routeMode","onchainLoanId")
			 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
			 ON CONFLICT ("requestId") DO UPDATE SET
			   "principal" = EXCLUDED."principal",
			   "collateralAmount" = EXCLUDED."collateralAmount",
			   "merchantId" = EXCLUDED."merchantId",
			   "merchantCategory" = EXCLUDED."merchantCategory",
			   "merchantAddress" = EXCLUDED."merchantAddress",
			   "collateralStatus" = EXCLUDED."collateralStatus",
			   "apr" = EXCLUDED."apr",
			   "tenorMonths" = EXCLUDED."tenorMonths",
			   "installmentsPaid" = EXCLUDED."installmentsPaid",
			   "status" = EXCLUDED."status",
			   "scheduleJson" = EXCLUDED."scheduleJson",
			   "txHashApprove" = EXCLUDED."txHashApprove",
			   "routeMode" = EXCLUDED."routeMode",
			   "onchainLoanId" = EXCLUDED."onchainLoanId"
			 RETURNING "id","initiaAddress","requestId","principal","collateralAmount","merchantId","merchantCategory","merchantAddress","collateralStatus","apr","tenorMonths","installmentsPaid","status","scheduleJson","txHashApprove","routeMode","onchainLoanId"`,
			s.db.table("Loan"),
		),
		loanID,
		borrower.InitiaAddress,
		requestID,
		requestRow.Amount,
		requestRow.CollateralAmount,
		requestRow.MerchantID,
		requestRow.MerchantCategory,
		requestRow.MerchantAddress,
		collateralStatusFromAmount(requestRow.CollateralAmount),
		score.APR,
		requestRow.TenorMonths,
		0,
		"active",
		string(scheduleJSON),
		txHash,
		"preview",
		nil,
	))
	if err != nil {
		return nil, &appError{
			Code:       "DATABASE_ERROR",
			Message:    "Loan could not be materialized.",
			StatusCode: http.StatusInternalServerError,
		}
	}

	_, err = s.db.pool.Exec(
		ctx,
		fmt.Sprintf(
			`INSERT INTO %s ("id","actorAddress","actionType","targetType","targetId","reason","txHash","status","createdAt")
			 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
			s.db.table("OperatorAction"),
		),
		createID("operator"),
		operatorAddress,
		"approve_request",
		"loan_request",
		requestID,
		strings.TrimSpace(reason),
		txHash,
		"preview",
		time.Now().UTC(),
	)
	if err != nil {
		return nil, &appError{
			Code:       "DATABASE_ERROR",
			Message:    "Approval audit trail could not be stored.",
			StatusCode: http.StatusInternalServerError,
		}
	}

	loan, err := mapLoan(loanRow)
	if err != nil {
		return nil, &appError{
			Code:       "DATABASE_ERROR",
			Message:    "Loan could not be materialized.",
			StatusCode: http.StatusInternalServerError,
		}
	}

	approvedRequest := mapLoanRequest(approvedRequestRow)
	detail := fmt.Sprintf("%.2f USD is now available to use.", requestRow.Amount)
	if requestRow.MerchantCategory != nil && strings.TrimSpace(*requestRow.MerchantCategory) != "" {
		detail = fmt.Sprintf("%.2f USD is now available to use in the selected app.", requestRow.Amount)
	}

	_ = s.pushActivity(ctx, borrower.InitiaAddress, activityItem{
		ID:        createID("activity"),
		Kind:      "loan",
		Label:     "Request approved",
		Detail:    detail,
		Timestamp: isoTime(time.Now().UTC()),
	})
	_ = s.rewardReferrerForFirstLoan(ctx, borrower.InitiaAddress)

	return map[string]any{
		"loan":    loan,
		"mode":    "preview",
		"request": approvedRequest,
		"txHash":  txHash,
	}, nil
}

func collateralStatusFromAmount(amount float64) string {
	if amount > 0 {
		return "locked"
	}

	return "none"
}

const (
	onchainRequestStatusPending   = 0
	onchainRequestStatusApproved  = 1
	onchainRequestStatusRejected  = 2
	onchainRequestStatusCancelled = 3
	onchainLoanStatusActive       = 10
	onchainLoanStatusRepaid       = 11
	onchainLoanStatusDefaulted    = 12
)

func mapOnchainRequestStatus(status int) string {
	switch status {
	case onchainRequestStatusApproved:
		return "approved"
	case onchainRequestStatusRejected:
		return "rejected"
	case onchainRequestStatusCancelled:
		return "cancelled"
	default:
		return "pending"
	}
}

func mapOnchainLoanStatus(status int) string {
	switch status {
	case onchainLoanStatusRepaid:
		return "repaid"
	case onchainLoanStatusDefaulted:
		return "defaulted"
	default:
		return "active"
	}
}

func mapOnchainCollateralStatus(state int) string {
	switch state {
	case 1:
		return "locked"
	case 2:
		return "returned"
	case 3:
		return "liquidated"
	default:
		return "none"
	}
}

func buildOnchainInstallmentSchedule(loan rollupLoanView) []installmentState {
	installmentsTotal := maxInt(loan.InstallmentsTotal, loan.TenorMonths)
	if installmentsTotal <= 0 {
		installmentsTotal = 1
	}

	installmentAmount := loan.InstallmentAmount
	if installmentAmount <= 0 {
		installmentAmount = loan.Amount / float64(installmentsTotal)
	}

	installmentsPaid := loan.InstallmentsPaid
	if installmentsPaid < 0 {
		installmentsPaid = 0
	}
	if installmentsPaid > installmentsTotal {
		installmentsPaid = installmentsTotal
	}

	baseDueAt := time.Now().UTC()
	if loan.NextDueAt > 0 {
		baseDueAt = time.Unix(loan.NextDueAt, 0).UTC()
	} else if loan.IssuedAt > 0 {
		baseDueAt = time.Unix(loan.IssuedAt, 0).UTC().AddDate(0, installmentsPaid+1, 0)
	}

	schedule := make([]installmentState, 0, installmentsTotal)
	for index := 0; index < installmentsTotal; index++ {
		status := "upcoming"
		switch {
		case loan.Status == onchainLoanStatusRepaid:
			status = "paid"
		case index < installmentsPaid:
			status = "paid"
		case index == installmentsPaid:
			status = "due"
		}

		schedule = append(schedule, installmentState{
			Amount:            installmentAmount,
			DueAt:             isoTime(baseDueAt.AddDate(0, index-installmentsPaid, 0)),
			InstallmentNumber: index + 1,
			Status:            status,
		})
	}

	return schedule
}

func buildInstallmentSchedule(principal float64, apr float64, tenorMonths int) []installmentState {
	total := principal * (1 + (apr/100)*float64(tenorMonths)/12)
	perInstallment := math.Round((total/float64(tenorMonths))*100) / 100
	schedule := make([]installmentState, 0, tenorMonths)
	now := time.Now().UTC()

	for index := 0; index < tenorMonths; index++ {
		amount := perInstallment
		if index == tenorMonths-1 {
			paidSoFar := perInstallment * float64(tenorMonths-1)
			amount = math.Round((total-paidSoFar)*100) / 100
		}
		status := "upcoming"
		if index == 0 {
			status = "due"
		}

		schedule = append(schedule, installmentState{
			Amount:            amount,
			DueAt:             isoTime(now.AddDate(0, index+1, 0)),
			InstallmentNumber: index + 1,
			Status:            status,
		})
	}

	return schedule
}

func (s *Server) findLoanIDByRequestID(ctx context.Context, requestID string) (string, error) {
	var id string
	err := s.db.pool.QueryRow(
		ctx,
		fmt.Sprintf(`SELECT "id" FROM %s WHERE "requestId" = $1`, s.db.table("Loan")),
		requestID,
	).Scan(&id)
	return id, err
}

func (s *Server) repayLoan(ctx context.Context, user userRow, loanID, txHash string) (map[string]any, *appError) {
	row, err := scanLoan(s.db.pool.QueryRow(
		ctx,
		fmt.Sprintf(
			`SELECT "id","initiaAddress","requestId","principal","collateralAmount","merchantId","merchantCategory","merchantAddress","collateralStatus","apr","tenorMonths","installmentsPaid","status","scheduleJson","txHashApprove","routeMode","onchainLoanId"
			 FROM %s WHERE "id" = $1`,
			s.db.table("Loan"),
		),
		loanID,
	))
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, &appError{
			Code:       "LOAN_NOT_FOUND",
			Message:    "Loan was not found.",
			StatusCode: http.StatusNotFound,
		}
	}
	if err != nil {
		return nil, &appError{
			Code:       "DATABASE_ERROR",
			Message:    "Loan could not be loaded.",
			StatusCode: http.StatusInternalServerError,
		}
	}
	if row.InitiaAddress != user.InitiaAddress {
		return nil, &appError{
			Code:       "LOAN_NOT_FOUND",
			Message:    "Loan was not found.",
			StatusCode: http.StatusNotFound,
		}
	}
	if s.shouldHidePreviewLoan(ctx, row) {
		return nil, &appError{
			Code:       "LOAN_SUPERSEDED_BY_LIVE_REQUEST",
			Message:    "This preview loan was superseded by the live onchain request. Refresh the request status instead of repaying the preview mirror.",
			StatusCode: http.StatusConflict,
		}
	}
	if row.Status != "active" {
		return nil, &appError{
			Code:       "LOAN_NOT_ACTIVE",
			Message:    "Only active loans can be repaid.",
			StatusCode: http.StatusBadRequest,
		}
	}

	loan, err := mapLoan(row)
	if err != nil {
		return nil, &appError{
			Code:       "DATABASE_ERROR",
			Message:    "Loan could not be loaded.",
			StatusCode: http.StatusInternalServerError,
		}
	}

	nextInstallment := -1
	for index, entry := range loan.Schedule {
		if entry.Status != "paid" {
			nextInstallment = index
			break
		}
	}
	if nextInstallment == -1 {
		return nil, &appError{
			Code:       "LOAN_ALREADY_REPAID",
			Message:    "This loan has already been settled.",
			StatusCode: http.StatusBadRequest,
		}
	}

	isLiveLoan := strings.EqualFold(row.RouteMode, "live") || trimStringPtr(row.OnchainLoanID) != ""
	if isLiveLoan {
		repaymentHash := strings.TrimSpace(txHash)
		if repaymentHash == "" {
			return nil, &appError{
				Code:       "REPAYMENT_TX_REQUIRED",
				Message:    "Live repayment must include the wallet transaction hash so LendPay can confirm it onchain.",
				StatusCode: http.StatusBadRequest,
			}
		}

		updatedRow, appErr := s.confirmLiveRepayment(ctx, row, user.InitiaAddress, repaymentHash)
		if appErr != nil {
			if isPendingRepaymentError(appErr) {
				currentLoan, mapErr := mapLoan(row)
				if mapErr != nil {
					return nil, &appError{
						Code:       "DATABASE_ERROR",
						Message:    "Loan could not be loaded.",
						StatusCode: http.StatusInternalServerError,
					}
				}

				return map[string]any{
					"loan":    currentLoan,
					"message": appErr.Message,
					"mode":    currentLoan.RouteMode,
					"pending": true,
					"txHash":  repaymentHash,
				}, nil
			}
			return nil, appErr
		}

		updatedLoan, err := mapLoan(updatedRow)
		if err != nil {
			return nil, &appError{
				Code:       "DATABASE_ERROR",
				Message:    "Loan could not be updated.",
				StatusCode: http.StatusInternalServerError,
			}
		}

		_, _ = s.syncUserOnchainState(ctx, user)
		_ = s.pushActivity(ctx, user.InitiaAddress, activityItem{
			ID:        createID("activity"),
			Kind:      "repayment",
			Label:     "Installment paid",
			Detail:    fmt.Sprintf("Payment %d was confirmed onchain.", updatedLoan.InstallmentsPaid),
			Timestamp: isoTime(time.Now().UTC()),
		})

		return map[string]any{
			"loan":   updatedLoan,
			"mode":   updatedLoan.RouteMode,
			"txHash": repaymentHash,
		}, nil
	}

	repaymentHash := txHash
	if strings.TrimSpace(repaymentHash) == "" {
		repaymentHash = previewTxHash("repay", loanID)
	}

	for index := range loan.Schedule {
		if index < nextInstallment {
			continue
		}
		if index == nextInstallment {
			loan.Schedule[index].Status = "paid"
			loan.Schedule[index].TxHash = &repaymentHash
			continue
		}
		if index == nextInstallment+1 && loan.Schedule[index].Status == "upcoming" {
			loan.Schedule[index].Status = "due"
		}
	}

	installmentsPaid := 0
	for _, entry := range loan.Schedule {
		if entry.Status == "paid" {
			installmentsPaid++
		}
	}
	loan.InstallmentsPaid = installmentsPaid
	if installmentsPaid == len(loan.Schedule) {
		loan.Status = "repaid"
		if loan.CollateralAmount > 0 && loan.CollateralStatus == "locked" {
			loan.CollateralStatus = "returned"
		}
	}

	scheduleJSON, _ := json.Marshal(loan.Schedule)
	_, err = s.db.pool.Exec(
		ctx,
		fmt.Sprintf(
			`UPDATE %s
			 SET "installmentsPaid" = $2, "status" = $3, "scheduleJson" = $4, "collateralStatus" = $5
			 WHERE "id" = $1`,
			s.db.table("Loan"),
		),
		loan.ID,
		loan.InstallmentsPaid,
		loan.Status,
		string(scheduleJSON),
		loan.CollateralStatus,
	)
	if err != nil {
		return nil, &appError{
			Code:       "DATABASE_ERROR",
			Message:    "Loan could not be updated.",
			StatusCode: http.StatusInternalServerError,
		}
	}

	updatedRow, err := scanLoan(s.db.pool.QueryRow(
		ctx,
		fmt.Sprintf(
			`SELECT "id","initiaAddress","requestId","principal","collateralAmount","merchantId","merchantCategory","merchantAddress","collateralStatus","apr","tenorMonths","installmentsPaid","status","scheduleJson","txHashApprove","routeMode","onchainLoanId"
			 FROM %s WHERE "id" = $1`,
			s.db.table("Loan"),
		),
		loan.ID,
	))
	if err != nil {
		return nil, &appError{
			Code:       "DATABASE_ERROR",
			Message:    "Loan could not be updated.",
			StatusCode: http.StatusInternalServerError,
		}
	}

	updatedLoan, err := mapLoan(updatedRow)
	if err != nil {
		return nil, &appError{
			Code:       "DATABASE_ERROR",
			Message:    "Loan could not be updated.",
			StatusCode: http.StatusInternalServerError,
		}
	}

	_, _ = s.addPoints(ctx, user.InitiaAddress, 50)
	_ = s.rewardReferrerForRepayment(ctx, user.InitiaAddress)
	_ = s.pushActivity(ctx, user.InitiaAddress, activityItem{
		ID:        createID("activity"),
		Kind:      "repayment",
		Label:     "Installment paid",
		Detail:    fmt.Sprintf("Payment %d was received in preview mode.", nextInstallment+1),
		Timestamp: isoTime(time.Now().UTC()),
	})

	return map[string]any{
		"loan":   updatedLoan,
		"mode":   updatedLoan.RouteMode,
		"txHash": repaymentHash,
	}, nil
}

func isPendingRepaymentError(err *appError) bool {
	if err == nil {
		return false
	}

	return err.Code == "TX_CONFIRMATION_PENDING" || err.Code == "REPAYMENT_TX_PENDING"
}

func (s *Server) confirmLiveRepayment(ctx context.Context, row loanRow, borrowerAddress, txHash string) (loanRow, *appError) {
	txLookup, appErr := s.waitForTxConfirmation(ctx, txHash)
	if appErr != nil {
		return loanRow{}, appErr
	}

	onchainLoanID := trimStringPtr(row.OnchainLoanID)
	eventLoanID := findMoveEventField(txLookup.Events, "::loan_book::InstallmentPaidEvent", "loan_id")
	if onchainLoanID == "" && eventLoanID != nil {
		onchainLoanID = strings.TrimSpace(*eventLoanID)
	}
	if onchainLoanID == "" {
		log.Printf("[repay] tx mismatch: no loan id in events; tx=%s borrower=%s loan=%s", txHash, borrowerAddress, row.ID)
		return loanRow{}, &appError{
			Code:       "REPAYMENT_TX_MISMATCH",
			Message:    "The confirmed transaction does not expose a repay event for this loan.",
			StatusCode: http.StatusBadRequest,
		}
	}
	if eventLoanID != nil && trimStringPtr(row.OnchainLoanID) != "" && strings.TrimSpace(*eventLoanID) != trimStringPtr(row.OnchainLoanID) {
		log.Printf("[repay] tx mismatch: event loan id %s != %s; tx=%s borrower=%s", strings.TrimSpace(*eventLoanID), trimStringPtr(row.OnchainLoanID), txHash, borrowerAddress)
		return loanRow{}, &appError{
			Code:       "REPAYMENT_TX_MISMATCH",
			Message:    "The confirmed transaction belongs to a different loan.",
			StatusCode: http.StatusBadRequest,
		}
	}

	waitCtx, cancel := context.WithTimeout(ctx, 4*time.Second)
	defer cancel()

	for {
		loanView, err := s.rollup.GetLoan(waitCtx, onchainLoanID)
		if err == nil && loanView != nil {
			nextStatus := mapOnchainLoanStatus(loanView.Status)
			if addressesMatch(loanView.Borrower, borrowerAddress) &&
				(loanView.InstallmentsPaid > row.InstallmentsPaid || nextStatus != row.Status) {
				updatedRow, updateErr := s.updateLoanRowFromOnchainView(ctx, row, *loanView)
				if updateErr != nil {
					return loanRow{}, &appError{
						Code:       "DATABASE_ERROR",
						Message:    "Loan could not be updated.",
						StatusCode: http.StatusInternalServerError,
					}
				}
				recordRepayConfirmed()
				log.Printf("[repay] confirmed: tx=%s borrower=%s loan=%s installmentsPaid=%d status=%s", txHash, borrowerAddress, updatedRow.ID, updatedRow.InstallmentsPaid, updatedRow.Status)
				return updatedRow, nil
			}
		}

		select {
		case <-waitCtx.Done():
			recordRepayPending()
			log.Printf("[repay] pending confirmation: tx=%s borrower=%s loan=%s", txHash, borrowerAddress, row.ID)
			return loanRow{}, &appError{
				Code:       "REPAYMENT_TX_PENDING",
				Message:    "The repayment transaction was broadcast, but LendPay is still waiting for the updated onchain loan state. Refresh again in a moment.",
				StatusCode: http.StatusConflict,
			}
		case <-time.After(350 * time.Millisecond):
		}
	}
}

func (s *Server) waitForTxConfirmation(ctx context.Context, txHash string) (*rollupTxLookup, *appError) {
	normalizedHash := strings.TrimSpace(txHash)
	if normalizedHash == "" {
		return nil, nil
	}
	if s.rollup == nil {
		log.Printf("[rollup-tx] confirmation unavailable: rollup client missing; tx=%s", normalizedHash)
		return nil, &appError{
			Code:       "ROLLUP_CONFIRMATION_UNAVAILABLE",
			Message:    "Rollup confirmation is unavailable right now.",
			StatusCode: http.StatusServiceUnavailable,
		}
	}

	waitCtx, cancel := context.WithTimeout(ctx, 4*time.Second)
	defer cancel()

	for {
		lookup, err := s.rollup.GetTxLookup(waitCtx, normalizedHash)
		if err == nil && lookup != nil && lookup.Found {
			if lookup.Code != 0 {
				log.Printf("[rollup-tx] confirmation failed: tx=%s code=%d", normalizedHash, lookup.Code)
				return nil, &appError{
					Code:       "TX_CONFIRMATION_FAILED",
					Message:    "The transaction reached the rollup but did not execute successfully.",
					StatusCode: http.StatusBadRequest,
				}
			}
			return lookup, nil
		}
		if err != nil && !errors.Is(err, context.DeadlineExceeded) && !errors.Is(err, context.Canceled) {
			log.Printf("[rollup-tx] confirmation lookup error: tx=%s err=%v", normalizedHash, err)
			return nil, &appError{
				Code:       "ROLLUP_CONFIRMATION_UNAVAILABLE",
				Message:    "LendPay could not verify the rollup transaction right now.",
				StatusCode: http.StatusServiceUnavailable,
			}
		}

		select {
		case <-waitCtx.Done():
			recordRepayPending()
			log.Printf("[rollup-tx] confirmation pending: tx=%s", normalizedHash)
			return nil, &appError{
				Code:       "TX_CONFIRMATION_PENDING",
				Message:    "The transaction was broadcast, but LendPay could not confirm it onchain yet. Refresh again in a moment.",
				StatusCode: http.StatusConflict,
			}
		case <-time.After(350 * time.Millisecond):
		}
	}
}

func (s *Server) addPoints(ctx context.Context, address string, delta int) (userRow, *appError) {
	user, appErr := s.ensureUser(ctx, address)
	if appErr != nil {
		return userRow{}, appErr
	}

	points := maxInt(0, user.Points+delta)
	streak := user.Streak
	if delta > 0 {
		streak++
	}

	row, err := scanUser(s.db.pool.QueryRow(
		ctx,
		fmt.Sprintf(
			`UPDATE %s
			 SET "points" = $2, "streak" = $3, "tier" = $4, "updatedAt" = $5
			 WHERE "initiaAddress" = $1
			 RETURNING %s`,
			s.db.table("User"),
			userColumns(),
		),
		address,
		points,
		streak,
		deriveTier(points),
		time.Now().UTC(),
	))
	if err != nil {
		return userRow{}, &appError{
			Code:       "DATABASE_ERROR",
			Message:    "User points could not be updated.",
			StatusCode: http.StatusInternalServerError,
		}
	}

	return row, nil
}

func (s *Server) rewardReferrerForFirstLoan(ctx context.Context, refereeAddress string) *appError {
	referrerAddress, hasReferrer, appErr := s.referrerAddress(ctx, refereeAddress)
	if appErr != nil || !hasReferrer {
		return appErr
	}

	link, err := s.getReferralLink(ctx, refereeAddress)
	if errors.Is(err, pgx.ErrNoRows) || link.FirstLoanRewarded {
		return nil
	}
	if err != nil {
		return &appError{
			Code:       "DATABASE_ERROR",
			Message:    "Referral reward could not be applied.",
			StatusCode: http.StatusInternalServerError,
		}
	}

	if err := s.updateReferralReward(ctx, refereeAddress, link.PointsGenerated+50, true); err != nil {
		return err
	}
	return s.incrementReferralPoints(ctx, referrerAddress, 50)
}

func (s *Server) rewardReferrerForRepayment(ctx context.Context, refereeAddress string) *appError {
	referrerAddress, hasReferrer, appErr := s.referrerAddress(ctx, refereeAddress)
	if appErr != nil || !hasReferrer {
		return appErr
	}

	link, err := s.getReferralLink(ctx, refereeAddress)
	if errors.Is(err, pgx.ErrNoRows) || !link.FirstLoanRewarded {
		return nil
	}
	if err != nil {
		return &appError{
			Code:       "DATABASE_ERROR",
			Message:    "Referral reward could not be applied.",
			StatusCode: http.StatusInternalServerError,
		}
	}

	if err := s.updateReferralReward(ctx, refereeAddress, link.PointsGenerated+20, true); err != nil {
		return err
	}
	return s.incrementReferralPoints(ctx, referrerAddress, 20)
}

type referralLinkRow struct {
	FirstLoanRewarded bool
	PointsGenerated   int
	RefereeAddress    string
}

func (s *Server) referrerAddress(ctx context.Context, refereeAddress string) (string, bool, *appError) {
	var referredBy *string
	err := s.db.pool.QueryRow(
		ctx,
		fmt.Sprintf(`SELECT "referredBy" FROM %s WHERE "initiaAddress" = $1`, s.db.table("User")),
		refereeAddress,
	).Scan(&referredBy)
	if errors.Is(err, pgx.ErrNoRows) || referredBy == nil || *referredBy == "" {
		return "", false, nil
	}
	if err != nil {
		return "", false, &appError{
			Code:       "DATABASE_ERROR",
			Message:    "Referral data could not be loaded.",
			StatusCode: http.StatusInternalServerError,
		}
	}

	return *referredBy, true, nil
}

func (s *Server) getReferralLink(ctx context.Context, refereeAddress string) (referralLinkRow, error) {
	row := referralLinkRow{}
	err := s.db.pool.QueryRow(
		ctx,
		fmt.Sprintf(
			`SELECT "refereeAddress","pointsGenerated","firstLoanRewarded"
			 FROM %s
			 WHERE "refereeAddress" = $1`,
			s.db.table("ReferralLink"),
		),
		refereeAddress,
	).Scan(&row.RefereeAddress, &row.PointsGenerated, &row.FirstLoanRewarded)
	return row, err
}

func (s *Server) updateReferralReward(ctx context.Context, refereeAddress string, points int, firstLoanRewarded bool) *appError {
	_, err := s.db.pool.Exec(
		ctx,
		fmt.Sprintf(
			`UPDATE %s
			 SET "pointsGenerated" = $2, "firstLoanRewarded" = $3, "status" = $4, "updatedAt" = $5
			 WHERE "refereeAddress" = $1`,
			s.db.table("ReferralLink"),
		),
		refereeAddress,
		points,
		firstLoanRewarded,
		"active",
		time.Now().UTC(),
	)
	if err != nil {
		return &appError{
			Code:       "DATABASE_ERROR",
			Message:    "Referral reward could not be applied.",
			StatusCode: http.StatusInternalServerError,
		}
	}

	return nil
}

func (s *Server) incrementReferralPoints(ctx context.Context, address string, delta int) *appError {
	user, appErr := s.ensureUser(ctx, address)
	if appErr != nil {
		return appErr
	}

	_, err := s.db.pool.Exec(
		ctx,
		fmt.Sprintf(
			`UPDATE %s
			 SET "referralPointsEarned" = $2, "updatedAt" = $3
			 WHERE "initiaAddress" = $1`,
			s.db.table("User"),
		),
		address,
		user.ReferralPointsEarned+delta,
		time.Now().UTC(),
	)
	if err != nil {
		return &appError{
			Code:       "DATABASE_ERROR",
			Message:    "Referral reward could not be applied.",
			StatusCode: http.StatusInternalServerError,
		}
	}

	return nil
}

func (s *Server) getReferralState(ctx context.Context, user userRow) (referralState, *appError) {
	rows, err := s.db.pool.Query(
		ctx,
		fmt.Sprintf(
			`SELECT rl."refereeAddress", rl."joinedAt", rl."pointsGenerated", rl."status", u."username"
			 FROM %s rl
			 LEFT JOIN %s u ON u."initiaAddress" = rl."refereeAddress"
			 WHERE rl."referrerAddress" = $1
			 ORDER BY rl."joinedAt" DESC`,
			s.db.table("ReferralLink"),
			s.db.table("User"),
		),
		user.InitiaAddress,
	)
	if err != nil {
		return referralState{}, &appError{
			Code:       "DATABASE_ERROR",
			Message:    "Referral data could not be loaded.",
			StatusCode: http.StatusInternalServerError,
		}
	}
	defer rows.Close()

	entries := []referralEntry{}
	activeCount := 0
	for rows.Next() {
		var address string
		var joinedAt time.Time
		var pointsGenerated int
		var status string
		var username *string
		if err := rows.Scan(&address, &joinedAt, &pointsGenerated, &status, &username); err != nil {
			return referralState{}, &appError{
				Code:       "DATABASE_ERROR",
				Message:    "Referral data could not be loaded.",
				StatusCode: http.StatusInternalServerError,
			}
		}
		if status == "active" {
			activeCount++
		}
		entries = append(entries, referralEntry{
			Address:         address,
			JoinedAt:        isoTime(joinedAt),
			PointsGenerated: pointsGenerated,
			Status:          status,
			Username:        username,
		})
	}

	referralCode := buildReferralCode(user.InitiaAddress)
	if user.ReferralCode != nil && *user.ReferralCode != "" {
		referralCode = *user.ReferralCode
	}

	return referralState{
		ActiveReferrals: activeCount,
		PointsEarned:    user.ReferralPointsEarned,
		ReferralCode:    referralCode,
		ReferralList:    entries,
		ReferredBy:      user.ReferredBy,
		TotalReferrals:  len(entries),
	}, nil
}

func (s *Server) applyReferralCode(ctx context.Context, user userRow, code string) (referralState, *appError) {
	normalizedCode := strings.ToUpper(strings.TrimSpace(code))
	if normalizedCode == "" {
		return referralState{}, &appError{
			Code:       "INVALID_REFERRAL_CODE",
			Message:    "Referral code is required.",
			StatusCode: http.StatusBadRequest,
		}
	}
	if user.ReferredBy != nil && *user.ReferredBy != "" {
		return referralState{}, &appError{
			Code:       "REFERRAL_ALREADY_SET",
			Message:    "This wallet already has a referral applied.",
			StatusCode: http.StatusBadRequest,
		}
	}

	var requestsCount int
	if err := s.db.pool.QueryRow(
		ctx,
		fmt.Sprintf(`SELECT COUNT(*) FROM %s WHERE "initiaAddress" = $1`, s.db.table("LoanRequest")),
		user.InitiaAddress,
	).Scan(&requestsCount); err != nil {
		return referralState{}, &appError{
			Code:       "DATABASE_ERROR",
			Message:    "Referral code could not be applied.",
			StatusCode: http.StatusInternalServerError,
		}
	}

	var loansCount int
	if err := s.db.pool.QueryRow(
		ctx,
		fmt.Sprintf(`SELECT COUNT(*) FROM %s WHERE "initiaAddress" = $1`, s.db.table("Loan")),
		user.InitiaAddress,
	).Scan(&loansCount); err != nil {
		return referralState{}, &appError{
			Code:       "DATABASE_ERROR",
			Message:    "Referral code could not be applied.",
			StatusCode: http.StatusInternalServerError,
		}
	}

	if requestsCount > 0 || loansCount > 0 {
		return referralState{}, &appError{
			Code:       "REFERRAL_WINDOW_CLOSED",
			Message:    "Referral codes can only be applied before the first loan request.",
			StatusCode: http.StatusBadRequest,
		}
	}

	var referrerAddress string
	if err := s.db.pool.QueryRow(
		ctx,
		fmt.Sprintf(`SELECT "initiaAddress" FROM %s WHERE "referralCode" = $1`, s.db.table("User")),
		normalizedCode,
	).Scan(&referrerAddress); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return referralState{}, &appError{
				Code:       "REFERRAL_NOT_FOUND",
				Message:    "Referral code was not found.",
				StatusCode: http.StatusNotFound,
			}
		}
		return referralState{}, &appError{
			Code:       "DATABASE_ERROR",
			Message:    "Referral code could not be applied.",
			StatusCode: http.StatusInternalServerError,
		}
	}
	if referrerAddress == user.InitiaAddress {
		return referralState{}, &appError{
			Code:       "REFERRAL_SELF",
			Message:    "You cannot apply your own referral code.",
			StatusCode: http.StatusBadRequest,
		}
	}

	tx, err := s.db.pool.Begin(ctx)
	if err != nil {
		return referralState{}, &appError{
			Code:       "DATABASE_ERROR",
			Message:    "Referral code could not be applied.",
			StatusCode: http.StatusInternalServerError,
		}
	}
	defer tx.Rollback(ctx)

	if _, err := tx.Exec(
		ctx,
		fmt.Sprintf(`UPDATE %s SET "referredBy" = $2, "updatedAt" = $3 WHERE "initiaAddress" = $1`, s.db.table("User")),
		user.InitiaAddress,
		referrerAddress,
		time.Now().UTC(),
	); err != nil {
		return referralState{}, &appError{
			Code:       "DATABASE_ERROR",
			Message:    "Referral code could not be applied.",
			StatusCode: http.StatusInternalServerError,
		}
	}

	if _, err := tx.Exec(
		ctx,
		fmt.Sprintf(
			`INSERT INTO %s ("id","referrerAddress","refereeAddress","status","pointsGenerated","firstLoanRewarded","joinedAt","updatedAt")
			 VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
			 ON CONFLICT ("refereeAddress") DO UPDATE SET
			   "referrerAddress" = EXCLUDED."referrerAddress",
			   "status" = EXCLUDED."status",
			   "updatedAt" = EXCLUDED."updatedAt"`,
			s.db.table("ReferralLink"),
		),
		createID("ref"),
		referrerAddress,
		user.InitiaAddress,
		"pending",
		0,
		false,
		time.Now().UTC(),
		time.Now().UTC(),
	); err != nil {
		return referralState{}, &appError{
			Code:       "DATABASE_ERROR",
			Message:    "Referral code could not be applied.",
			StatusCode: http.StatusInternalServerError,
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return referralState{}, &appError{
			Code:       "DATABASE_ERROR",
			Message:    "Referral code could not be applied.",
			StatusCode: http.StatusInternalServerError,
		}
	}

	nextUser, appErr := s.ensureUser(ctx, user.InitiaAddress)
	if appErr != nil {
		return referralState{}, appErr
	}

	return s.getReferralState(ctx, nextUser)
}

type operatorActionRow struct {
	ActionType string
	CreatedAt  time.Time
	Status     string
	TxHash     *string
}

func (s *Server) getLatestOperatorAction(ctx context.Context, address, actionType, targetType string) (*operatorActionRow, error) {
	row := operatorActionRow{}
	err := s.db.pool.QueryRow(
		ctx,
		fmt.Sprintf(
			`SELECT "actionType","createdAt","status","txHash"
			 FROM %s
			 WHERE "actionType" = $1 AND "targetType" = $2 AND "targetId" = $3
			 ORDER BY "createdAt" DESC
			 LIMIT 1`,
			s.db.table("OperatorAction"),
		),
		actionType,
		targetType,
		address,
	).Scan(&row.ActionType, &row.CreatedAt, &row.Status, &row.TxHash)
	if err != nil {
		return nil, err
	}

	return &row, nil
}

func userColumns() string {
	return `"id","initiaAddress","username","referralCode","referredBy","referralPointsEarned","nativeBalance","lockedCollateralLend","points","tier","heldLend","liquidLend","stakedLend","claimableLend","claimableStakingRewards","streak","creditLimitBoostBps","interestDiscountBps","premiumChecksAvailable","badgeCount","createdAt","updatedAt"`
}

func scanUser(scanner rowScanner) (userRow, error) {
	row := userRow{}
	err := scanner.Scan(
		&row.ID,
		&row.InitiaAddress,
		&row.Username,
		&row.ReferralCode,
		&row.ReferredBy,
		&row.ReferralPointsEarned,
		&row.NativeBalance,
		&row.LockedCollateralLend,
		&row.Points,
		&row.Tier,
		&row.HeldLend,
		&row.LiquidLend,
		&row.StakedLend,
		&row.ClaimableLend,
		&row.ClaimableStakingRewards,
		&row.Streak,
		&row.CreditLimitBoostBps,
		&row.InterestDiscountBps,
		&row.PremiumChecksAvailable,
		&row.BadgeCount,
		&row.CreatedAt,
		&row.UpdatedAt,
	)
	return row, err
}

func scanActivity(scanner rowScanner) (activityRow, error) {
	row := activityRow{}
	err := scanner.Scan(&row.ID, &row.InitiaAddress, &row.Kind, &row.Label, &row.Detail, &row.Timestamp)
	return row, err
}

func scanScore(scanner rowScanner) (scoreRow, error) {
	row := scoreRow{}
	err := scanner.Scan(
		&row.Score,
		&row.LimitUSD,
		&row.Risk,
		&row.APR,
		&row.Provider,
		&row.Model,
		&row.Summary,
		&row.ScannedAt,
		&row.BreakdownJSON,
		&row.InitiaAddress,
	)
	return row, err
}

func scanLoanRequest(scanner rowScanner) (loanRequestRow, error) {
	row := loanRequestRow{}
	err := scanner.Scan(
		&row.ID,
		&row.InitiaAddress,
		&row.Amount,
		&row.CollateralAmount,
		&row.MerchantID,
		&row.MerchantCategory,
		&row.MerchantAddress,
		&row.AssetSymbol,
		&row.TenorMonths,
		&row.SubmittedAt,
		&row.Status,
		&row.TxHash,
		&row.OnchainRequestID,
	)
	return row, err
}

func scanLoan(scanner rowScanner) (loanRow, error) {
	row := loanRow{}
	err := scanner.Scan(
		&row.ID,
		&row.InitiaAddress,
		&row.RequestID,
		&row.Principal,
		&row.CollateralAmount,
		&row.MerchantID,
		&row.MerchantCategory,
		&row.MerchantAddress,
		&row.CollateralStatus,
		&row.APR,
		&row.TenorMonths,
		&row.InstallmentsPaid,
		&row.Status,
		&row.ScheduleJSON,
		&row.TxHashApprove,
		&row.RouteMode,
		&row.OnchainLoanID,
	)
	return row, err
}
