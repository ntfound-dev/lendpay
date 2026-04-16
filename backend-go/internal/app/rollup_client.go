package app

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"encoding/hex"
	"net/http"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"
)

type RollupTxClient struct {
	cfg  Config
	http *http.Client
}

type rollupTxEnvelope struct {
	TxResponse rollupTxResponse `json:"tx_response"`
}

type rollupTxResponse struct {
	Code   int             `json:"code"`
	Events []rollupTxEvent `json:"events"`
}

type rollupTxEvent struct {
	Type       string                `json:"type"`
	Attributes []rollupTxEventRecord `json:"attributes"`
}

type rollupTxEventRecord struct {
	Key   string `json:"key"`
	Value string `json:"value"`
}

type rollupViewEnvelope struct {
	Data string `json:"data"`
}

type rollupViewRequest struct {
	Address      string   `json:"address"`
	Args         []string `json:"args"`
	FunctionName string   `json:"function_name"`
	ModuleName   string   `json:"module_name"`
	TypeArgs     []string `json:"type_args"`
}

type rollupLoanView struct {
	Amount             float64
	APRBps             int
	Borrower           string
	CollateralAmount   float64
	CollateralState    int
	GracePeriodSeconds int64
	ID                 string
	InstallmentAmount  float64
	InstallmentsPaid   int
	InstallmentsTotal  int
	IssuedAt           int64
	NextDueAt          int64
	ProfileID          int
	RequestID          string
	Status             int
	TenorMonths        int
	TotalRepaid        float64
}

type rollupRewardAccountView struct {
	BadgeCount             int
	ClaimableLend          int
	CreditLimitBoostBps    int
	InterestDiscountBps    int
	Points                 int
	PremiumChecksAvailable int
	Streak                 int
}

type rollupFeeStateView struct {
	Borrower            string
	LoanID              string
	LateFeeDue          float64
	OriginationFeeDue   float64
	TotalFeesPaid       float64
	TotalFeesPaidInLend float64
}

type rollupReferralStatsView struct {
	ActiveReferrals int
	PointsEarned    int
	TotalReferrals  int
}

type rollupTxLookup struct {
	Code   int
	Events []rollupTxEvent
	Found  bool
}

type rollupRequestView struct {
	Amount           float64
	Borrower         string
	CollateralAmount float64
	CreatedAt        int64
	ID               string
	ProfileID        int
	Status           int
	TenorMonths      int
}

type rollupProfileQuoteView struct {
	CollateralRatioBps     int
	CreditLimitBoostBps    int
	CurrentLendHoldings    int
	MaxPrincipal           int
	MaxTenorMonths         int
	MinLendHoldings        int
	ProfileID              int
	Qualified              bool
	RequiresCollateral     bool
	Revolving              bool
	TierLimitMultiplierBps int
}

type rollupReputationView struct {
	LatePayments     int
	LastUpdated      int64
	LoansApproved    int
	LoansDefaulted   int
	LoansRepaid      int
	LoansRequested   int
	OnTimePayments   int
	User             string
	Username         string
	UsernameVerified bool
}

func NewRollupTxClient(cfg Config) *RollupTxClient {
	return &RollupTxClient{
		cfg: cfg,
		http: &http.Client{
			Timeout: 3500 * time.Millisecond,
		},
	}
}

func (c *RollupTxClient) GetLoanRequestIDByTxHash(ctx context.Context, txHash string) *string {
	events := c.getTxEvents(ctx, txHash)
	if len(events) == 0 {
		return nil
	}

	return findMoveEventField(events, "::loan_book::LoanRequestedEvent", "request_id")
}

func (c *RollupTxClient) HasActiveLoanOf(ctx context.Context, borrower string) (bool, error) {
	encodedBorrower, err := encodeMoveViewAddressArg(borrower)
	if err != nil {
		return false, err
	}

	raw, err := c.viewJSON(ctx, c.cfg.LoanModuleName, "has_active_loan_of", []string{encodedBorrower})
	if err != nil {
		return false, err
	}

	return scalarBool(raw)
}

func (c *RollupTxClient) ActiveLoanIDOf(ctx context.Context, borrower string) (*string, error) {
	encodedBorrower, err := encodeMoveViewAddressArg(borrower)
	if err != nil {
		return nil, err
	}

	raw, err := c.viewJSON(ctx, c.cfg.LoanModuleName, "active_loan_id_of", []string{encodedBorrower})
	if err != nil {
		return nil, err
	}

	value, err := scalarString(raw)
	if err != nil || strings.TrimSpace(value) == "" || value == "0" {
		return nil, err
	}

	return &value, nil
}

func (c *RollupTxClient) HasPendingRequestOf(ctx context.Context, borrower string) (bool, error) {
	encodedBorrower, err := encodeMoveViewAddressArg(borrower)
	if err != nil {
		return false, err
	}

	raw, err := c.viewJSON(ctx, c.cfg.LoanModuleName, "has_pending_request_of", []string{encodedBorrower})
	if err != nil {
		return false, err
	}

	return scalarBool(raw)
}

func (c *RollupTxClient) NextRequestID(ctx context.Context) (int, error) {
	raw, err := c.viewJSON(ctx, c.cfg.LoanModuleName, "next_request_id", nil)
	if err != nil {
		return 0, err
	}

	return scalarInt(raw)
}

func (c *RollupTxClient) FindPendingRequestOf(ctx context.Context, borrower string, maxScan int) (*rollupRequestView, error) {
	normalizedBorrower := strings.TrimSpace(borrower)
	if normalizedBorrower == "" {
		return nil, nil
	}

	hasPendingRequest, err := c.HasPendingRequestOf(ctx, normalizedBorrower)
	if err != nil || !hasPendingRequest {
		return nil, err
	}

	nextRequestID, err := c.NextRequestID(ctx)
	if err != nil {
		return nil, err
	}
	if nextRequestID <= 1 {
		return nil, nil
	}

	if maxScan <= 0 {
		maxScan = 512
	}

	scanned := 0
	for requestID := nextRequestID - 1; requestID > 0 && scanned < maxScan; requestID-- {
		scanned++

		requestView, err := c.GetRequest(ctx, strconv.Itoa(requestID))
		if err != nil || requestView == nil {
			continue
		}
		if requestView.Status != onchainRequestStatusPending {
			continue
		}
		if !addressesMatch(requestView.Borrower, normalizedBorrower) {
			continue
		}

		return requestView, nil
	}

	return nil, nil
}

func (c *RollupTxClient) GetLoan(ctx context.Context, loanID string) (*rollupLoanView, error) {
	encodedLoanID, err := encodeMoveViewU64Arg(loanID)
	if err != nil {
		return nil, err
	}

	raw, err := c.viewJSON(ctx, c.cfg.LoanModuleName, "get_loan", []string{encodedLoanID})
	if err != nil {
		return nil, err
	}

	record, err := objectValue(raw)
	if err != nil {
		return nil, err
	}

	return &rollupLoanView{
		Amount:             numberValue(record["amount"]),
		APRBps:             int(numberValue(record["apr_bps"])),
		Borrower:           stringValue(record["borrower"]),
		CollateralAmount:   numberValue(record["collateral_amount"]),
		CollateralState:    int(numberValue(record["collateral_state"])),
		GracePeriodSeconds: int64(numberValue(record["grace_period_seconds"])),
		ID:                 stringValue(record["id"]),
		InstallmentAmount:  numberValue(record["installment_amount"]),
		InstallmentsPaid:   int(numberValue(record["installments_paid"])),
		InstallmentsTotal:  int(numberValue(record["installments_total"])),
		IssuedAt:           int64(numberValue(record["issued_at"])),
		NextDueAt:          int64(numberValue(record["next_due_at"])),
		ProfileID:          int(numberValue(record["profile_id"])),
		RequestID:          stringValue(record["request_id"]),
		Status:             int(numberValue(record["status"])),
		TenorMonths:        int(numberValue(record["tenor_months"])),
		TotalRepaid:        numberValue(record["total_repaid"]),
	}, nil
}

func (c *RollupTxClient) GetRewardAccount(ctx context.Context, user string) (*rollupRewardAccountView, error) {
	encodedUser, err := encodeMoveViewAddressArg(user)
	if err != nil {
		return nil, err
	}

	raw, err := c.viewJSON(ctx, "rewards", "get_account", []string{encodedUser})
	if err != nil {
		return nil, err
	}

	record, err := objectValue(raw)
	if err != nil {
		return nil, err
	}

	return &rollupRewardAccountView{
		BadgeCount:             int(numberValue(record["badge_count"])),
		ClaimableLend:          int(numberValue(record["claimable_lend"])),
		CreditLimitBoostBps:    int(numberValue(record["credit_limit_boost_bps"])),
		InterestDiscountBps:    int(numberValue(record["interest_discount_bps"])),
		Points:                 int(numberValue(record["points"])),
		PremiumChecksAvailable: int(numberValue(record["premium_checks_available"])),
		Streak:                 int(numberValue(record["current_streak"])),
	}, nil
}

func (c *RollupTxClient) GetFeeState(ctx context.Context, loanID string) (*rollupFeeStateView, error) {
	encodedLoanID, err := encodeMoveViewU64Arg(loanID)
	if err != nil {
		return nil, err
	}

	raw, err := c.viewJSON(ctx, "fee_engine", "get_fee_state", []string{encodedLoanID})
	if err != nil {
		return nil, err
	}

	record, err := objectValue(raw)
	if err != nil {
		return nil, err
	}

	return &rollupFeeStateView{
		Borrower:            stringValue(record["borrower"]),
		LoanID:              stringValue(record["loan_id"]),
		LateFeeDue:          numberValue(record["late_fee_due"]),
		OriginationFeeDue:   numberValue(record["origination_fee_due"]),
		TotalFeesPaid:       numberValue(record["total_fees_paid"]),
		TotalFeesPaidInLend: numberValue(record["total_fees_paid_in_lend"]),
	}, nil
}

func (c *RollupTxClient) GetLockedCollateral(ctx context.Context, user string) (int, error) {
	encodedUser, err := encodeMoveViewAddressArg(user)
	if err != nil {
		return 0, err
	}

	raw, err := c.viewJSON(ctx, c.cfg.LoanModuleName, "locked_collateral_of", []string{encodedUser})
	if err != nil {
		return 0, err
	}

	return scalarInt(raw)
}

func (c *RollupTxClient) GetLendBalance(ctx context.Context, user string) (int, error) {
	encodedUser, err := encodeMoveViewAddressArg(user)
	if err != nil {
		return 0, err
	}

	raw, err := c.viewJSON(ctx, "lend_token", "balance_of", []string{encodedUser})
	if err != nil {
		return 0, err
	}

	return scalarInt(raw)
}

func (c *RollupTxClient) GetStakedLendBalance(ctx context.Context, user string) (int, error) {
	encodedUser, err := encodeMoveViewAddressArg(user)
	if err != nil {
		return 0, err
	}

	raw, err := c.viewJSON(ctx, "lend_token", "staked_balance_of", []string{encodedUser})
	if err != nil {
		return 0, err
	}

	return scalarInt(raw)
}

func (c *RollupTxClient) GetHeldLendBalance(ctx context.Context, user string) (int, error) {
	encodedUser, err := encodeMoveViewAddressArg(user)
	if err != nil {
		return 0, err
	}

	raw, err := c.viewJSON(ctx, "lend_token", "total_balance_of", []string{encodedUser})
	if err != nil {
		return 0, err
	}

	return scalarInt(raw)
}

func (c *RollupTxClient) GetClaimableStakingRewards(ctx context.Context, user string) (int, error) {
	encodedUser, err := encodeMoveViewAddressArg(user)
	if err != nil {
		return 0, err
	}

	raw, err := c.viewJSON(ctx, "staking", "quote_claimable", []string{encodedUser})
	if err != nil {
		return 0, err
	}

	return scalarInt(raw)
}

func (c *RollupTxClient) GetReferralStats(ctx context.Context, user string) (*rollupReferralStatsView, error) {
	encodedUser, err := encodeMoveViewAddressArg(user)
	if err != nil {
		return nil, err
	}

	raw, err := c.viewJSON(ctx, "referral", "get_referral_stats", []string{encodedUser})
	if err != nil {
		return nil, err
	}

	values, err := arrayValue(raw)
	if err != nil {
		return nil, err
	}
	if len(values) < 3 {
		return nil, errRollupViewUnavailable
	}

	return &rollupReferralStatsView{
		TotalReferrals:  int(numberValue(values[0])),
		ActiveReferrals: int(numberValue(values[1])),
		PointsEarned:    int(numberValue(values[2])),
	}, nil
}

func (c *RollupTxClient) GetTxLookup(ctx context.Context, txHash string) (*rollupTxLookup, error) {
	normalizedHash := normalizeRollupTxHash(txHash)
	if normalizedHash == "" {
		return nil, errRollupViewUnavailable
	}

	request, err := http.NewRequestWithContext(
		ctx,
		http.MethodGet,
		strings.TrimRight(c.cfg.RollupRESTURL, "/")+"/cosmos/tx/v1beta1/txs/"+normalizedHash,
		nil,
	)
	if err != nil {
		return nil, err
	}

	response, err := c.http.Do(request)
	if err != nil {
		return nil, err
	}
	defer response.Body.Close()

	if response.StatusCode == http.StatusNotFound {
		return &rollupTxLookup{Found: false}, nil
	}
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return nil, errRollupViewUnavailable
	}

	payload := rollupTxEnvelope{}
	if err := json.NewDecoder(response.Body).Decode(&payload); err != nil {
		return nil, err
	}

	return &rollupTxLookup{
		Code:   payload.TxResponse.Code,
		Events: payload.TxResponse.Events,
		Found:  true,
	}, nil
}

func (c *RollupTxClient) GetRequest(ctx context.Context, requestID string) (*rollupRequestView, error) {
	encodedRequestID, err := encodeMoveViewU64Arg(requestID)
	if err != nil {
		return nil, err
	}

	raw, err := c.viewJSON(ctx, c.cfg.LoanModuleName, "get_request", []string{encodedRequestID})
	if err != nil {
		return nil, err
	}

	record, err := objectValue(raw)
	if err != nil {
		return nil, err
	}

	return &rollupRequestView{
		Amount:           numberValue(record["amount"]),
		Borrower:         stringValue(record["borrower"]),
		CollateralAmount: numberValue(record["collateral_amount"]),
		CreatedAt:        int64(numberValue(record["created_at"])),
		ID:               stringValue(record["id"]),
		ProfileID:        int(numberValue(record["profile_id"])),
		Status:           int(numberValue(record["status"])),
		TenorMonths:      int(numberValue(record["tenor_months"])),
	}, nil
}

func (c *RollupTxClient) QuoteProfile(ctx context.Context, borrower string, profileID int) (*rollupProfileQuoteView, error) {
	encodedBorrower, err := encodeMoveViewAddressArg(borrower)
	if err != nil {
		return nil, err
	}

	encodedProfileID, err := encodeMoveViewU8Arg(profileID)
	if err != nil {
		return nil, err
	}

	raw, err := c.viewJSON(ctx, "profiles", "quote_profile", []string{encodedBorrower, encodedProfileID})
	if err != nil {
		return nil, err
	}

	record, err := objectValue(raw)
	if err != nil {
		return nil, err
	}

	return &rollupProfileQuoteView{
		CollateralRatioBps:     int(numberValue(record["collateral_ratio_bps"])),
		CreditLimitBoostBps:    int(numberValue(record["credit_limit_boost_bps"])),
		CurrentLendHoldings:    int(numberValue(record["current_lend_holdings"])),
		MaxPrincipal:           int(numberValue(record["max_principal"])),
		MaxTenorMonths:         int(numberValue(record["max_tenor_months"])),
		MinLendHoldings:        int(numberValue(record["min_lend_holdings"])),
		ProfileID:              int(numberValue(record["profile_id"])),
		Qualified:              boolValue(record["qualified"]),
		RequiresCollateral:     boolValue(record["requires_collateral"]),
		Revolving:              boolValue(record["revolving"]),
		TierLimitMultiplierBps: int(numberValue(record["tier_limit_multiplier_bps"])),
	}, nil
}

func (c *RollupTxClient) GetReputation(ctx context.Context, user string) (*rollupReputationView, error) {
	encodedUser, err := encodeMoveViewAddressArg(user)
	if err != nil {
		return nil, err
	}

	raw, err := c.viewJSON(ctx, "reputation", "get_entry", []string{encodedUser})
	if err != nil {
		return nil, err
	}

	record, err := objectValue(raw)
	if err != nil {
		return nil, err
	}

	return &rollupReputationView{
		LatePayments:     int(numberValue(record["late_payments"])),
		LastUpdated:      int64(numberValue(record["last_updated"])),
		LoansApproved:    int(numberValue(record["loans_approved"])),
		LoansDefaulted:   int(numberValue(record["loans_defaulted"])),
		LoansRepaid:      int(numberValue(record["loans_repaid"])),
		LoansRequested:   int(numberValue(record["loans_requested"])),
		OnTimePayments:   int(numberValue(record["on_time_payments"])),
		User:             stringValue(record["user"]),
		Username:         decodeUsernameHash(record["username_hash"]),
		UsernameVerified: boolValue(record["username_verified"]),
	}, nil
}

func (c *RollupTxClient) viewJSON(ctx context.Context, moduleName, functionName string, args []string) (json.RawMessage, error) {
	if strings.TrimSpace(c.cfg.RollupRESTURL) == "" ||
		strings.TrimSpace(c.cfg.LendpayPackageAddress) == "" ||
		strings.TrimSpace(moduleName) == "" ||
		strings.TrimSpace(functionName) == "" {
		return nil, errRollupViewUnavailable
	}

	payload, err := json.Marshal(rollupViewRequest{
		Address:      c.cfg.LendpayPackageAddress,
		Args:         args,
		FunctionName: functionName,
		ModuleName:   moduleName,
		TypeArgs:     []string{},
	})
	if err != nil {
		return nil, err
	}

	request, err := http.NewRequestWithContext(
		ctx,
		http.MethodPost,
		strings.TrimRight(c.cfg.RollupRESTURL, "/")+"/initia/move/v1/view",
		bytes.NewReader(payload),
	)
	if err != nil {
		return nil, err
	}
	request.Header.Set("content-type", "application/json")

	response, err := c.http.Do(request)
	if err != nil {
		return nil, err
	}
	defer response.Body.Close()

	if response.StatusCode == http.StatusNotFound || response.StatusCode < 200 || response.StatusCode >= 300 {
		return nil, errRollupViewUnavailable
	}

	envelope := rollupViewEnvelope{}
	if err := json.NewDecoder(response.Body).Decode(&envelope); err != nil {
		return nil, err
	}

	if strings.TrimSpace(envelope.Data) == "" {
		return nil, errRollupViewUnavailable
	}

	return json.RawMessage(envelope.Data), nil
}

func (c *RollupTxClient) getTxEvents(ctx context.Context, txHash string) []rollupTxEvent {
	lookup, err := c.GetTxLookup(ctx, txHash)
	if err != nil || lookup == nil || !lookup.Found || lookup.Code != 0 {
		return nil
	}

	return lookup.Events
}

func normalizeRollupTxHash(value string) string {
	normalized := strings.TrimSpace(value)
	normalized = strings.TrimPrefix(normalized, "0x")
	normalized = strings.TrimPrefix(normalized, "0X")
	return strings.ToUpper(normalized)
}

func findMoveEventField(events []rollupTxEvent, typeTagSuffix, field string) *string {
	expectedSuffix := strings.ToLower(strings.TrimSpace(typeTagSuffix))
	field = strings.TrimSpace(field)
	if expectedSuffix == "" || field == "" {
		return nil
	}

	for _, event := range events {
		if event.Type != "move" {
			continue
		}

		attributes := map[string]string{}
		for _, attribute := range event.Attributes {
			key := strings.TrimSpace(attribute.Key)
			if key == "" {
				continue
			}
			if _, exists := attributes[key]; exists {
				continue
			}
			attributes[key] = strings.TrimSpace(attribute.Value)
		}

		if !strings.HasSuffix(strings.ToLower(attributes["type_tag"]), expectedSuffix) {
			continue
		}

		if value := strings.TrimSpace(attributes[field]); value != "" {
			return &value
		}

		data := strings.TrimSpace(attributes["data"])
		if data == "" {
			continue
		}

		record := map[string]any{}
		if err := json.Unmarshal([]byte(data), &record); err != nil {
			continue
		}

		if value := strings.TrimSpace(firstString(record[field])); value != "" {
			return &value
		}
	}

	return nil
}

var errRollupViewUnavailable = errors.New("rollup view unavailable")

func objectValue(raw json.RawMessage) (map[string]any, error) {
	record := map[string]any{}
	if err := json.Unmarshal(raw, &record); err != nil {
		return nil, err
	}

	return record, nil
}

func scalarString(raw json.RawMessage) (string, error) {
	var stringValue string
	if err := json.Unmarshal(raw, &stringValue); err == nil {
		return strings.TrimSpace(stringValue), nil
	}

	var numberValue json.Number
	if err := json.Unmarshal(raw, &numberValue); err == nil {
		return strings.TrimSpace(numberValue.String()), nil
	}

	var floatValue float64
	if err := json.Unmarshal(raw, &floatValue); err == nil {
		return strconv.FormatInt(int64(floatValue), 10), nil
	}

	return "", errRollupViewUnavailable
}

func scalarBool(raw json.RawMessage) (bool, error) {
	var value bool
	if err := json.Unmarshal(raw, &value); err == nil {
		return value, nil
	}

	var stringValue string
	if err := json.Unmarshal(raw, &stringValue); err == nil {
		normalized := strings.TrimSpace(strings.ToLower(stringValue))
		return normalized == "true" || normalized == "1", nil
	}

	return false, errRollupViewUnavailable
}

func scalarInt(raw json.RawMessage) (int, error) {
	value, err := scalarString(raw)
	if err != nil {
		return 0, err
	}

	if value == "" {
		return 0, nil
	}

	if parsed, err := strconv.Atoi(value); err == nil {
		return parsed, nil
	}

	floatValue, err := strconv.ParseFloat(value, 64)
	if err != nil {
		return 0, errRollupViewUnavailable
	}

	return int(floatValue), nil
}

func arrayValue(raw json.RawMessage) ([]any, error) {
	values := []any{}
	if err := json.Unmarshal(raw, &values); err != nil {
		return nil, err
	}

	return values, nil
}

func stringValue(value any) string {
	switch typed := value.(type) {
	case string:
		return strings.TrimSpace(typed)
	case json.Number:
		return strings.TrimSpace(typed.String())
	case float64:
		return strconv.FormatInt(int64(typed), 10)
	default:
		return strings.TrimSpace(firstString(value))
	}
}

func numberValue(value any) float64 {
	switch typed := value.(type) {
	case float64:
		return typed
	case int:
		return float64(typed)
	case int64:
		return float64(typed)
	case json.Number:
		if parsed, err := typed.Float64(); err == nil {
			return parsed
		}
	case string:
		parsed, err := strconv.ParseFloat(strings.TrimSpace(typed), 64)
		if err == nil {
			return parsed
		}
	}

	return 0
}

func decodeUsernameHash(value any) string {
	raw := bytesValue(value)
	if len(raw) == 0 || !utf8.Valid(raw) {
		return ""
	}

	return strings.TrimSpace(string(raw))
}

func bytesValue(value any) []byte {
	switch typed := value.(type) {
	case string:
		trimmed := strings.TrimSpace(typed)
		if trimmed == "" {
			return nil
		}

		trimmed = strings.TrimPrefix(strings.TrimPrefix(trimmed, "0x"), "0X")
		if decoded, err := hex.DecodeString(trimmed); err == nil {
			return decoded
		}

		return []byte(trimmed)
	case []byte:
		return typed
	case []any:
		buffer := make([]byte, 0, len(typed))
		for _, item := range typed {
			switch child := item.(type) {
			case float64:
				if child < 0 || child > 255 {
					return nil
				}
				buffer = append(buffer, byte(child))
			case int:
				if child < 0 || child > 255 {
					return nil
				}
				buffer = append(buffer, byte(child))
			case json.Number:
				parsed, err := child.Int64()
				if err != nil || parsed < 0 || parsed > 255 {
					return nil
				}
				buffer = append(buffer, byte(parsed))
			case string:
				parsed, err := strconv.Atoi(strings.TrimSpace(child))
				if err != nil || parsed < 0 || parsed > 255 {
					return nil
				}
				buffer = append(buffer, byte(parsed))
			default:
				return nil
			}
		}

		return buffer
	default:
		return nil
	}
}

func boolValue(value any) bool {
	switch typed := value.(type) {
	case bool:
		return typed
	case string:
		normalized := strings.TrimSpace(strings.ToLower(typed))
		return normalized == "true" || normalized == "1"
	case json.Number:
		return typed.String() == "1"
	case float64:
		return typed != 0
	default:
		return false
	}
}
