package app

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"time"
)

type rewardsState struct {
	BadgeCount              int    `json:"badgeCount"`
	ClaimableLend           int    `json:"claimableLend"`
	ClaimableStakingRewards int    `json:"claimableStakingRewards"`
	CreditLimitBoostBps     int    `json:"creditLimitBoostBps"`
	HeldLend                int    `json:"heldLend"`
	InterestDiscountBps     int    `json:"interestDiscountBps"`
	LiquidLend              int    `json:"liquidLend"`
	Points                  int    `json:"points"`
	PremiumChecksAvailable  int    `json:"premiumChecksAvailable"`
	StakedLend              int    `json:"stakedLend"`
	Streak                  int    `json:"streak"`
	Tier                    string `json:"tier"`
}

type userProfile struct {
	CreatedAt                string        `json:"createdAt"`
	ID                       string        `json:"id"`
	InitiaAddress            string        `json:"initiaAddress"`
	ReferralCode             *string       `json:"referralCode,omitempty"`
	ReferralPointsEarned     int           `json:"referralPointsEarned"`
	ReferredBy               *string       `json:"referredBy,omitempty"`
	Rewards                  rewardsState  `json:"rewards"`
	UpdatedAt                string        `json:"updatedAt"`
	Username                 *string       `json:"username,omitempty"`
	UsernameAttestedOnRollup bool          `json:"usernameAttestedOnRollup"`
	UsernameSource           *string       `json:"usernameSource,omitempty"`
	UsernameVerified         bool          `json:"usernameVerified"`
	UsernameVerifiedOnL1     bool          `json:"usernameVerifiedOnL1"`
	Wallet                   profileWallet `json:"wallet"`
}

type profileWallet struct {
	LockedCollateralLend int `json:"lockedCollateralLend"`
	NativeBalance        int `json:"nativeBalance"`
}

type authResponse struct {
	Token string      `json:"token"`
	User  userProfile `json:"user"`
}

type activityItem struct {
	Detail    string `json:"detail"`
	ID        string `json:"id"`
	Kind      string `json:"kind"`
	Label     string `json:"label"`
	Timestamp string `json:"timestamp"`
}

type faucetState struct {
	CanClaim      bool    `json:"canClaim"`
	ClaimAmount   int     `json:"claimAmount"`
	CooldownHours int     `json:"cooldownHours"`
	Enabled       bool    `json:"enabled"`
	LastClaimAt   *string `json:"lastClaimAt,omitempty"`
	NativeSymbol  string  `json:"nativeSymbol"`
	NextClaimAt   *string `json:"nextClaimAt,omitempty"`
	TxHash        *string `json:"txHash,omitempty"`
}

type referralEntry struct {
	Address         string  `json:"address"`
	JoinedAt        string  `json:"joinedAt"`
	PointsGenerated int     `json:"pointsGenerated"`
	Status          string  `json:"status"`
	Username        *string `json:"username,omitempty"`
}

type referralState struct {
	ActiveReferrals int             `json:"activeReferrals"`
	PointsEarned    int             `json:"pointsEarned"`
	ReferralCode    string          `json:"referralCode"`
	ReferralList    []referralEntry `json:"referralList"`
	ReferredBy      *string         `json:"referredBy,omitempty"`
	TotalReferrals  int             `json:"totalReferrals"`
}

type leaderboardEntry struct {
	Address  string  `json:"address"`
	Badge    *string `json:"badge,omitempty"`
	Metric   string  `json:"metric"`
	Rank     int     `json:"rank"`
	Tier     string  `json:"tier"`
	Username *string `json:"username,omitempty"`
	Value    string  `json:"value"`
}

type leaderboardState struct {
	MyRank       map[string]int     `json:"myRank,omitempty"`
	RisingStars  []leaderboardEntry `json:"risingStars"`
	TopBorrowers []leaderboardEntry `json:"topBorrowers"`
	TopReferrers []leaderboardEntry `json:"topReferrers"`
	TopRepayers  []leaderboardEntry `json:"topRepayers"`
}

type scoreBreakdownItem struct {
	Detail string `json:"detail"`
	Label  string `json:"label"`
	Points int    `json:"points"`
}

type creditScoreState struct {
	APR       float64              `json:"apr"`
	Breakdown []scoreBreakdownItem `json:"breakdown"`
	LimitUSD  int                  `json:"limitUsd"`
	Model     *string              `json:"model,omitempty"`
	Provider  *string              `json:"provider,omitempty"`
	Risk      string               `json:"risk"`
	ScannedAt string               `json:"scannedAt"`
	Score     int                  `json:"score"`
	Summary   *string              `json:"summary,omitempty"`
}

type loanRequestState struct {
	Amount           float64 `json:"amount"`
	AssetSymbol      string  `json:"assetSymbol"`
	CollateralAmount float64 `json:"collateralAmount"`
	ID               string  `json:"id"`
	MerchantAddress  *string `json:"merchantAddress,omitempty"`
	MerchantCategory *string `json:"merchantCategory,omitempty"`
	MerchantID       *string `json:"merchantId,omitempty"`
	OnchainRequestID *string `json:"onchainRequestId,omitempty"`
	Status           string  `json:"status"`
	SubmittedAt      string  `json:"submittedAt"`
	TenorMonths      int     `json:"tenorMonths"`
	TxHash           *string `json:"txHash,omitempty"`
}

type installmentState struct {
	Amount            float64 `json:"amount"`
	DueAt             string  `json:"dueAt"`
	InstallmentNumber int     `json:"installmentNumber"`
	Status            string  `json:"status"`
	TxHash            *string `json:"txHash,omitempty"`
}

type loanState struct {
	APR              float64            `json:"apr"`
	CollateralAmount float64            `json:"collateralAmount"`
	CollateralStatus string             `json:"collateralStatus"`
	ID               string             `json:"id"`
	InstallmentsPaid int                `json:"installmentsPaid"`
	MerchantAddress  *string            `json:"merchantAddress,omitempty"`
	MerchantCategory *string            `json:"merchantCategory,omitempty"`
	MerchantID       *string            `json:"merchantId,omitempty"`
	OnchainLoanID    *string            `json:"onchainLoanId,omitempty"`
	Principal        float64            `json:"principal"`
	RequestID        string             `json:"requestId"`
	RouteMode        string             `json:"routeMode"`
	Schedule         []installmentState `json:"schedule"`
	Status           string             `json:"status"`
	TenorMonths      int                `json:"tenorMonths"`
	TxHashApprove    *string            `json:"txHashApprove,omitempty"`
}

type loanFeeState struct {
	Borrower            string  `json:"borrower"`
	LoanID              string  `json:"loanId"`
	LateFeeDue          float64 `json:"lateFeeDue"`
	OriginationFeeDue   float64 `json:"originationFeeDue"`
	TotalFeesPaid       float64 `json:"totalFeesPaid"`
	TotalFeesPaidInLend float64 `json:"totalFeesPaidInLend"`
}

type creditProfileQuote struct {
	CollateralRatioBps     int    `json:"collateralRatioBps"`
	CreditLimitBoostBps    int    `json:"creditLimitBoostBps"`
	CurrentLendHoldings    int    `json:"currentLendHoldings"`
	Label                  string `json:"label"`
	MaxPrincipal           int    `json:"maxPrincipal"`
	MaxTenorMonths         int    `json:"maxTenorMonths"`
	MinLendHoldings        int    `json:"minLendHoldings"`
	ProfileID              int    `json:"profileId"`
	Qualified              bool   `json:"qualified"`
	RequiresCollateral     bool   `json:"requiresCollateral"`
	Revolving              bool   `json:"revolving"`
	TierLimitMultiplierBps int    `json:"tierLimitMultiplierBps"`
}

type merchantState struct {
	Active          bool                `json:"active"`
	Actions         []string            `json:"actions,omitempty"`
	Category        string              `json:"category"`
	Contract        *string             `json:"contract,omitempty"`
	Description     *string             `json:"description,omitempty"`
	ID              string              `json:"id"`
	ListingFeeBps   int                 `json:"listingFeeBps"`
	MerchantAddress string              `json:"merchantAddress"`
	Name            *string             `json:"name,omitempty"`
	PartnerFeeBps   int                 `json:"partnerFeeBps"`
	PartnerFeeQuote int                 `json:"partnerFeeQuote"`
	Proof           *merchantProofState `json:"proof,omitempty"`
	Source          string              `json:"source"`
}

type merchantProofState struct {
	ChainID            string   `json:"chainId"`
	InteractionLabel   *string  `json:"interactionLabel,omitempty"`
	InteractionTxHash  *string  `json:"interactionTxHash,omitempty"`
	MerchantID         string   `json:"merchantId"`
	PackageAddress     string   `json:"packageAddress"`
	PayoutBalance      *float64 `json:"payoutBalance,omitempty"`
	ReceiptAddress     *string  `json:"receiptAddress,omitempty"`
	RegistrationTxHash *string  `json:"registrationTxHash,omitempty"`
	ResultLabel        *string  `json:"resultLabel,omitempty"`
}

type lendLiquidityRouteState struct {
	AssetDenom                string                    `json:"assetDenom"`
	AssetSymbol               string                    `json:"assetSymbol"`
	DestinationChainID        string                    `json:"destinationChainId"`
	DestinationChainName      string                    `json:"destinationChainName"`
	DestinationRestURL        string                    `json:"destinationRestUrl"`
	DestinationDenom          *string                   `json:"destinationDenom,omitempty"`
	DestinationAssetReference *string                   `json:"destinationAssetReference,omitempty"`
	Erc20Address              *string                   `json:"erc20Address,omitempty"`
	Erc20FactoryAddress       *string                   `json:"erc20FactoryAddress,omitempty"`
	LiquidityStatus           string                    `json:"liquidityStatus"`
	LiquidityVenue            *string                   `json:"liquidityVenue,omitempty"`
	OracleQuote               liquidityOracleQuoteState `json:"oracleQuote"`
	PoolReference             *string                   `json:"poolReference,omitempty"`
	RouteID                   *int                      `json:"routeId,omitempty"`
	RouteMode                 string                    `json:"routeMode"`
	RouteNotes                *string                   `json:"routeNotes,omitempty"`
	RouteRegistry             string                    `json:"routeRegistry"`
	RouteStatus               string                    `json:"routeStatus"`
	SellReady                 bool                      `json:"sellReady"`
	SourceChainID             string                    `json:"sourceChainId"`
	SourceChainName           string                    `json:"sourceChainName"`
	SwapEnabled               bool                      `json:"swapEnabled"`
	SwapSummary               string                    `json:"swapSummary"`
	TransferMethod            string                    `json:"transferMethod"`
	WalletHandler             string                    `json:"walletHandler"`
}

type liquidityOracleQuoteState struct {
	BlockHeight    *int    `json:"blockHeight,omitempty"`
	BlockTimestamp *string `json:"blockTimestamp,omitempty"`
	Decimals       *int    `json:"decimals,omitempty"`
	FetchedAt      string  `json:"fetchedAt"`
	PairMode       string  `json:"pairMode"`
	PairReason     *string `json:"pairReason,omitempty"`
	PairSupported  bool    `json:"pairSupported"`
	Price          float64 `json:"price"`
	RawPrice       *string `json:"rawPrice,omitempty"`
	RequestedPair  string  `json:"requestedPair"`
	ResolvedPair   string  `json:"resolvedPair"`
	SourcePath     string  `json:"sourcePath"`
}

type userRow struct {
	BadgeCount              int
	ClaimableLend           int
	ClaimableStakingRewards int
	CreatedAt               time.Time
	CreditLimitBoostBps     int
	HeldLend                int
	ID                      string
	InitiaAddress           string
	InterestDiscountBps     int
	LiquidLend              int
	LockedCollateralLend    int
	NativeBalance           int
	Points                  int
	PremiumChecksAvailable  int
	ReferralCode            *string
	ReferralPointsEarned    int
	ReferredBy              *string
	StakedLend              int
	Streak                  int
	Tier                    string
	UpdatedAt               time.Time
	Username                *string
}

type activityRow struct {
	Detail        string
	ID            string
	InitiaAddress string
	Kind          string
	Label         string
	Timestamp     time.Time
}

type scoreRow struct {
	APR           float64
	BreakdownJSON string
	InitiaAddress string
	LimitUSD      int
	Model         *string
	Provider      *string
	Risk          string
	ScannedAt     time.Time
	Score         int
	Summary       *string
}

type loanRequestRow struct {
	Amount           float64
	AssetSymbol      string
	CollateralAmount float64
	ID               string
	InitiaAddress    string
	MerchantAddress  *string
	MerchantCategory *string
	MerchantID       *string
	OnchainRequestID *string
	Status           string
	SubmittedAt      time.Time
	TenorMonths      int
	TxHash           *string
}

type loanRow struct {
	APR              float64
	CollateralAmount float64
	CollateralStatus string
	ID               string
	InitiaAddress    string
	InstallmentsPaid int
	MerchantAddress  *string
	MerchantCategory *string
	MerchantID       *string
	OnchainLoanID    *string
	Principal        float64
	RequestID        string
	RouteMode        string
	ScheduleJSON     string
	Status           string
	TenorMonths      int
	TxHashApprove    *string
}

func mapUserProfile(row userRow) userProfile {
	var usernameSource *string
	if row.Username != nil && *row.Username != "" {
		value := "preview"
		usernameSource = &value
	}

	return userProfile{
		CreatedAt:            isoTime(row.CreatedAt),
		ID:                   row.ID,
		InitiaAddress:        row.InitiaAddress,
		ReferralCode:         row.ReferralCode,
		ReferralPointsEarned: row.ReferralPointsEarned,
		ReferredBy:           row.ReferredBy,
		Rewards: rewardsState{
			BadgeCount:              row.BadgeCount,
			ClaimableLend:           row.ClaimableLend,
			ClaimableStakingRewards: row.ClaimableStakingRewards,
			CreditLimitBoostBps:     row.CreditLimitBoostBps,
			HeldLend:                row.HeldLend,
			InterestDiscountBps:     row.InterestDiscountBps,
			LiquidLend:              row.LiquidLend,
			Points:                  row.Points,
			PremiumChecksAvailable:  row.PremiumChecksAvailable,
			StakedLend:              row.StakedLend,
			Streak:                  row.Streak,
			Tier:                    row.Tier,
		},
		UpdatedAt:                isoTime(row.UpdatedAt),
		Username:                 row.Username,
		UsernameAttestedOnRollup: false,
		UsernameSource:           usernameSource,
		UsernameVerified:         false,
		UsernameVerifiedOnL1:     false,
		Wallet: profileWallet{
			LockedCollateralLend: row.LockedCollateralLend,
			NativeBalance:        row.NativeBalance,
		},
	}
}

func mapActivity(row activityRow) activityItem {
	return activityItem{
		Detail:    row.Detail,
		ID:        row.ID,
		Kind:      row.Kind,
		Label:     row.Label,
		Timestamp: isoTime(row.Timestamp),
	}
}

func mapScore(row scoreRow) (creditScoreState, error) {
	breakdown := []scoreBreakdownItem{}
	if row.BreakdownJSON != "" {
		if err := json.Unmarshal([]byte(row.BreakdownJSON), &breakdown); err != nil {
			return creditScoreState{}, err
		}
	}

	return creditScoreState{
		APR:       row.APR,
		Breakdown: breakdown,
		LimitUSD:  row.LimitUSD,
		Model:     row.Model,
		Provider:  row.Provider,
		Risk:      row.Risk,
		ScannedAt: isoTime(row.ScannedAt),
		Score:     row.Score,
		Summary:   row.Summary,
	}, nil
}

func mapLoanRequest(row loanRequestRow) loanRequestState {
	return loanRequestState{
		Amount:           row.Amount,
		AssetSymbol:      row.AssetSymbol,
		CollateralAmount: row.CollateralAmount,
		ID:               row.ID,
		MerchantAddress:  row.MerchantAddress,
		MerchantCategory: row.MerchantCategory,
		MerchantID:       row.MerchantID,
		OnchainRequestID: row.OnchainRequestID,
		Status:           row.Status,
		SubmittedAt:      isoTime(row.SubmittedAt),
		TenorMonths:      row.TenorMonths,
		TxHash:           row.TxHash,
	}
}

func mapLoan(row loanRow) (loanState, error) {
	schedule := []installmentState{}
	if row.ScheduleJSON != "" {
		if err := json.Unmarshal([]byte(row.ScheduleJSON), &schedule); err != nil {
			return loanState{}, err
		}
	}

	return loanState{
		APR:              row.APR,
		CollateralAmount: row.CollateralAmount,
		CollateralStatus: row.CollateralStatus,
		ID:               row.ID,
		InstallmentsPaid: row.InstallmentsPaid,
		MerchantAddress:  row.MerchantAddress,
		MerchantCategory: row.MerchantCategory,
		MerchantID:       row.MerchantID,
		OnchainLoanID:    row.OnchainLoanID,
		Principal:        row.Principal,
		RequestID:        row.RequestID,
		RouteMode:        row.RouteMode,
		Schedule:         schedule,
		Status:           row.Status,
		TenorMonths:      row.TenorMonths,
		TxHashApprove:    row.TxHashApprove,
	}, nil
}

func isoTime(value time.Time) string {
	return value.UTC().Format(time.RFC3339Nano)
}

func createID(prefix string) string {
	return fmt.Sprintf("%s-%s", prefix, uuidFragment())
}

func uuidFragment() string {
	return fmt.Sprintf("%d", time.Now().UnixNano())
}

func previewTxHash(parts ...string) string {
	payload := fmt.Sprintf("%s:%d", stringsJoin(parts, ":"), time.Now().UnixNano())
	sum := sha256.Sum256([]byte(payload))
	return hex.EncodeToString(sum[:])
}

func stringsJoin(values []string, sep string) string {
	if len(values) == 0 {
		return ""
	}

	result := values[0]
	for _, value := range values[1:] {
		result += sep + value
	}

	return result
}

func ternaryString(condition bool, whenTrue, whenFalse string) string {
	if condition {
		return whenTrue
	}

	return whenFalse
}

func deriveTier(points int) string {
	switch {
	case points >= 10000:
		return "Diamond"
	case points >= 7000:
		return "Gold"
	case points >= 3500:
		return "Silver"
	default:
		return "Bronze"
	}
}
