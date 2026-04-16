package app

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"
)

type agentChecklistItem struct {
	Done  bool   `json:"done"`
	Label string `json:"label"`
}

type agentGuidanceState struct {
  ActionKey       *string              `json:"actionKey,omitempty"`
  ActionLabel     *string              `json:"actionLabel,omitempty"`
  AssistantDetail string               `json:"assistantDetail"`
  AssistantLabel  string               `json:"assistantLabel"`
  Checklist       []agentChecklistItem `json:"checklist"`
	Confidence      *int                 `json:"confidence,omitempty"`
	GeneratedAt     string               `json:"generatedAt"`
	Model           *string              `json:"model,omitempty"`
	PanelBody       string               `json:"panelBody"`
	PanelTitle      string               `json:"panelTitle"`
	Provider        string               `json:"provider"`
  Recommendation  string               `json:"recommendation"`
  Surface         string               `json:"surface"`
}

type agentGuideRequestContext struct {
	RequestBlockingMessage *string  `json:"requestBlockingMessage,omitempty"`
	HasSelectedApp         bool     `json:"hasSelectedApp"`
	SelectedAppLabel       *string  `json:"selectedAppLabel,omitempty"`
	HasSelectedProfile     bool     `json:"hasSelectedProfile"`
	SelectedProfileLabel   *string  `json:"selectedProfileLabel,omitempty"`
	CheckoutReady          bool     `json:"checkoutReady"`
	MonthlyPaymentUsd      *float64 `json:"monthlyPaymentUsd,omitempty"`
	CanSubmitRequest       bool     `json:"canSubmitRequest"`
	ActiveLoanPrincipalUsd *float64 `json:"activeLoanPrincipalUsd,omitempty"`
}

type agentGuideRepayContext struct {
	ClaimableCollectibleName *string  `json:"claimableCollectibleName,omitempty"`
	NextDueAmountUsd          *float64 `json:"nextDueAmountUsd,omitempty"`
	NextDueDate               *string  `json:"nextDueDate,omitempty"`
	ActiveLoanPrincipalUsd    *float64 `json:"activeLoanPrincipalUsd,omitempty"`
	HasActiveLoan             bool     `json:"hasActiveLoan"`
}

type agentGuideContext struct {
	Surface string                   `json:"surface"`
	Request *agentGuideRequestContext `json:"request,omitempty"`
	Repay   *agentGuideRepayContext   `json:"repay,omitempty"`
}

func normalizeAgentSurface(value string) string {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "analyze", "request", "loan", "rewards", "admin":
		return strings.ToLower(strings.TrimSpace(value))
	default:
		return "overview"
	}
}

func agentAction(value string) *string {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return nil
	}

	return &trimmed
}

func agentConfidence(value int) *int {
	if value <= 0 {
		return nil
	}

	normalized := value
	if normalized > 99 {
		normalized = 99
	}

	return &normalized
}

func shortDateLabel(value string) string {
	parsed, err := time.Parse(time.RFC3339Nano, strings.TrimSpace(value))
	if err != nil {
		return "the next due date"
	}

	return parsed.UTC().Format("Jan 2")
}

func usdLabel(value float64) string {
	if value == float64(int(value)) {
		return fmt.Sprintf("$%.0f", value)
	}

	return fmt.Sprintf("$%.2f", value)
}

func nextDueInstallment(loan loanState) *installmentState {
	for index := range loan.Schedule {
		if loan.Schedule[index].Status == "due" {
			return &loan.Schedule[index]
		}
	}

	for index := range loan.Schedule {
		if loan.Schedule[index].Status != "paid" {
			return &loan.Schedule[index]
		}
	}

	return nil
}

func findPendingRequest(requests []loanRequestState) *loanRequestState {
	for index := range requests {
		if requests[index].Status == "pending" {
			return &requests[index]
		}
	}

	return nil
}

func findActiveLoan(loans []loanState) *loanState {
	for index := range loans {
		if loans[index].Status == "active" {
			return &loans[index]
		}
	}

	return nil
}

func hasApprovedRequestWithoutLoan(requests []loanRequestState, activeLoan *loanState) bool {
	if activeLoan != nil {
		return false
	}

	for _, request := range requests {
		if request.Status == "approved" {
			return true
		}
	}

	return false
}

func claimableRewardsTotal(user userRow) int {
	return user.ClaimableLend + user.ClaimableStakingRewards
}

func isPreviewScore(score creditScoreState) bool {
	return strings.EqualFold(strings.TrimSpace(score.Source), scoreSourcePreview)
}

func effectiveGuideProfileLimit(score creditScoreState, quote creditProfileQuote) int {
	if strings.EqualFold(strings.TrimSpace(quote.Source), profileQuoteSourceRollup) || quote.RequiresCollateral {
		return quote.MaxPrincipal
	}

	if score.LimitUSD < quote.MaxPrincipal {
		return score.LimitUSD
	}

	return quote.MaxPrincipal
}

func bestGuideProfileQuote(score creditScoreState, quotes []creditProfileQuote) *creditProfileQuote {
	bestIndex := -1
	for index := range quotes {
		if bestIndex == -1 {
			bestIndex = index
			continue
		}

		candidate := quotes[index]
		best := quotes[bestIndex]

		if candidate.Qualified != best.Qualified {
			if candidate.Qualified {
				bestIndex = index
			}
			continue
		}

		candidateLimit := effectiveGuideProfileLimit(score, candidate)
		bestLimit := effectiveGuideProfileLimit(score, best)
		if candidateLimit != bestLimit {
			if candidateLimit > bestLimit {
				bestIndex = index
			}
			continue
		}

		if candidate.RequiresCollateral != best.RequiresCollateral {
			if !candidate.RequiresCollateral {
				bestIndex = index
			}
			continue
		}

		if candidate.MaxTenorMonths > best.MaxTenorMonths {
			bestIndex = index
		}
	}

	if bestIndex == -1 {
		return nil
	}

	return &quotes[bestIndex]
}

func trimGuideString(value *string) string {
	if value == nil {
		return ""
	}

	return strings.TrimSpace(*value)
}

func isGuideFloatPositive(value *float64) bool {
	return value != nil && *value > 0
}

func buildAgentContextSummary(
	user userRow,
	score creditScoreState,
	surface string,
	nextRequest *loanRequestState,
	activeLoan *loanState,
	claimableRewards int,
) string {
	parts := []string{
		fmt.Sprintf("surface: %s", surface),
		fmt.Sprintf("score: %d", score.Score),
		fmt.Sprintf("risk: %s", score.Risk),
		fmt.Sprintf("apr: %.1f%%", score.APR),
		fmt.Sprintf("limit: %s", usdLabel(float64(score.LimitUSD))),
		fmt.Sprintf("tier: %s", user.Tier),
		fmt.Sprintf("streak: %d", user.Streak),
		fmt.Sprintf("held_lend: %d", user.HeldLend),
		fmt.Sprintf("claimable_rewards: %d", claimableRewards),
	}

	if user.Username != nil && strings.TrimSpace(*user.Username) != "" {
		parts = append(parts, fmt.Sprintf("username: %s", strings.TrimSpace(*user.Username)))
	}

	if nextRequest != nil {
		parts = append(
			parts,
			fmt.Sprintf("pending_request_amount: %s", usdLabel(nextRequest.Amount)),
			fmt.Sprintf("pending_request_tenor: %d months", nextRequest.TenorMonths),
		)
	}

	if activeLoan != nil {
		parts = append(parts, fmt.Sprintf("active_loan_principal: %s", usdLabel(activeLoan.Principal)))
		if dueItem := nextDueInstallment(*activeLoan); dueItem != nil {
			parts = append(
				parts,
				fmt.Sprintf("next_due_amount: %s", usdLabel(dueItem.Amount)),
				fmt.Sprintf("next_due_date: %s", shortDateLabel(dueItem.DueAt)),
			)
		}
	}

	return strings.Join(parts, "\n")
}

func buildAgentExtraContextSummary(context *agentGuideContext) string {
	if context == nil {
		return ""
	}

	parts := []string{}
	if context.Request != nil {
		request := context.Request
		if strings.TrimSpace(trimGuideString(request.RequestBlockingMessage)) != "" {
			parts = append(parts, fmt.Sprintf("request_blocking_message: %s", trimGuideString(request.RequestBlockingMessage)))
		}
		if request.HasSelectedApp && strings.TrimSpace(trimGuideString(request.SelectedAppLabel)) != "" {
			parts = append(parts, fmt.Sprintf("request_selected_app: %s", trimGuideString(request.SelectedAppLabel)))
		}
		if request.HasSelectedProfile && strings.TrimSpace(trimGuideString(request.SelectedProfileLabel)) != "" {
			parts = append(parts, fmt.Sprintf("request_selected_profile: %s", trimGuideString(request.SelectedProfileLabel)))
		}
		if request.CheckoutReady {
			parts = append(parts, "request_checkout_ready: true")
		}
		if isGuideFloatPositive(request.MonthlyPaymentUsd) {
			parts = append(parts, fmt.Sprintf("request_monthly_payment: %s", usdLabel(*request.MonthlyPaymentUsd)))
		}
	}
	if context.Repay != nil {
		repay := context.Repay
		if strings.TrimSpace(trimGuideString(repay.ClaimableCollectibleName)) != "" {
			parts = append(parts, fmt.Sprintf("repay_claimable_collectible: %s", trimGuideString(repay.ClaimableCollectibleName)))
		}
		if isGuideFloatPositive(repay.NextDueAmountUsd) {
			parts = append(parts, fmt.Sprintf("repay_next_due_amount: %s", usdLabel(*repay.NextDueAmountUsd)))
		}
		if strings.TrimSpace(trimGuideString(repay.NextDueDate)) != "" {
			parts = append(parts, fmt.Sprintf("repay_next_due_date: %s", trimGuideString(repay.NextDueDate)))
		}
	}

	return strings.Join(parts, "\n")
}

func (s *Server) finalizeAgentGuidance(
	ctx context.Context,
	guide agentGuidanceState,
	user userRow,
	score creditScoreState,
	surface string,
	nextRequest *loanRequestState,
	activeLoan *loanState,
	claimableRewards int,
) agentGuidanceState {
	if s.ollama == nil {
		return guide
	}

	contextSummary := buildAgentContextSummary(
		user,
		score,
		surface,
		nextRequest,
		activeLoan,
		claimableRewards,
	)
	rewritten, err := s.ollama.RewriteAgentGuidance(ctx, guide, contextSummary)
	if err != nil {
		log.Printf("[agent] ollama rewrite failed surface=%s user=%s err=%v", surface, user.InitiaAddress, err)
		return guide
	}

	return rewritten
}

func (s *Server) finalizeAgentGuidanceWithContext(
	ctx context.Context,
	guide agentGuidanceState,
	user userRow,
	score creditScoreState,
	surface string,
	nextRequest *loanRequestState,
	activeLoan *loanState,
	claimableRewards int,
	extraContext string,
) agentGuidanceState {
	if s.ollama == nil {
		return guide
	}

	contextSummary := buildAgentContextSummary(
		user,
		score,
		surface,
		nextRequest,
		activeLoan,
		claimableRewards,
	)
	if strings.TrimSpace(extraContext) != "" {
		contextSummary = strings.TrimSpace(contextSummary + "\n" + extraContext)
	}

	rewritten, err := s.ollama.RewriteAgentGuidance(ctx, guide, contextSummary)
	if err != nil {
		log.Printf("[agent] ollama rewrite failed surface=%s user=%s err=%v", surface, user.InitiaAddress, err)
		return guide
	}

	return rewritten
}

func applyAgentGuideRequestContext(guide *agentGuidanceState, context *agentGuideRequestContext) {
	if guide == nil || context == nil {
		return
	}

	blockingMessage := trimGuideString(context.RequestBlockingMessage)
	if blockingMessage != "" {
		guide.AssistantLabel = "Request on hold"
		guide.AssistantDetail = blockingMessage
		guide.PanelTitle = "Wait for the current request result"
		guide.PanelBody = blockingMessage
		guide.Recommendation = "Wait for review"
		guide.ActionLabel = nil
		guide.ActionKey = nil
		guide.Confidence = agentConfidence(90)
		return
	}

	if !context.CheckoutReady {
		guide.AssistantLabel = "Credit request"
		guide.AssistantDetail = "Choose a live app before opening a new request."
		guide.PanelTitle = "Choose an app to start your request"
		guide.PanelBody = "Pick a live app first. The request builder opens after the app is selected."
		guide.Recommendation = "Choose an app first"
		guide.ActionLabel = nil
		guide.ActionKey = nil
		guide.Confidence = agentConfidence(82)
		return
	}

	if context.HasSelectedProfile && trimGuideString(context.SelectedProfileLabel) != "" {
		guide.PanelTitle = fmt.Sprintf("Best fit today: %s", trimGuideString(context.SelectedProfileLabel))
	}

	if context.HasSelectedApp && trimGuideString(context.SelectedAppLabel) != "" {
		guide.AssistantDetail = fmt.Sprintf("%s selected. The agent is ready to guide the request.", trimGuideString(context.SelectedAppLabel))
	}

	if isGuideFloatPositive(context.MonthlyPaymentUsd) {
		guide.PanelBody = fmt.Sprintf("Your estimated monthly payment is %s. Keep the request within your current limit and aim for a clean first cycle.", usdLabel(*context.MonthlyPaymentUsd))
	}

	if context.CanSubmitRequest {
		guide.Recommendation = "Send your credit request"
		guide.ActionLabel = agentAction("Send credit request")
		guide.ActionKey = agentAction("submit_request")
		guide.Confidence = agentConfidence(86)
		return
	}
}

func applyAgentGuideRepayContext(guide *agentGuidanceState, context *agentGuideRepayContext) {
	if guide == nil || context == nil {
		return
	}

	collectibleName := trimGuideString(context.ClaimableCollectibleName)
	if collectibleName != "" {
		guide.AssistantLabel = "Collectible ready"
		guide.AssistantDetail = fmt.Sprintf("%s is ready to claim.", collectibleName)
		guide.PanelTitle = fmt.Sprintf("Claim %s now", collectibleName)
		guide.PanelBody = "Your receipt is onchain. Claim the final collectible to finish the repayment journey."
		guide.Recommendation = "Claim the collectible"
		guide.ActionLabel = agentAction("Claim collectible")
		guide.ActionKey = agentAction("claim_collectible")
		guide.Confidence = agentConfidence(94)
		return
	}

	if isGuideFloatPositive(context.NextDueAmountUsd) && trimGuideString(context.NextDueDate) != "" {
		guide.AssistantLabel = "Repayment watch"
		guide.AssistantDetail = fmt.Sprintf("Next installment %s is due by %s.", usdLabel(*context.NextDueAmountUsd), shortDateLabel(trimGuideString(context.NextDueDate)))
		guide.PanelTitle = fmt.Sprintf("Repay %s by %s", usdLabel(*context.NextDueAmountUsd), shortDateLabel(trimGuideString(context.NextDueDate)))
		guide.PanelBody = "Paying the next installment on time protects your limit and keeps pricing pressure down for the next cycle."
		guide.Recommendation = "Repay the next installment now"
		guide.ActionLabel = agentAction("Repay now")
		guide.ActionKey = agentAction("repay_now")
		guide.Confidence = agentConfidence(93)
		return
	}
}

func (s *Server) buildAgentGuidance(ctx context.Context, user userRow, surface string) (agentGuidanceState, *appError) {
	return s.buildAgentGuidanceWithContext(ctx, user, surface, nil)
}

func (s *Server) buildAgentGuidanceWithContext(
	ctx context.Context,
	user userRow,
	surface string,
	context *agentGuideContext,
) (agentGuidanceState, *appError) {
	if syncedUser, err := s.syncUserOnchainState(ctx, user); err == nil {
		user = syncedUser
	}
	s.syncOnchainBorrowerCredit(ctx, user.InitiaAddress)

	score, appErr := s.getLatestScore(ctx, user)
	if appErr != nil {
		return agentGuidanceState{}, appErr
	}

	requests, appErr := s.listLoanRequestsFromDB(ctx, user.InitiaAddress)
	if appErr != nil {
		return agentGuidanceState{}, appErr
	}

	loans, appErr := s.listLoansFromDB(ctx, user.InitiaAddress)
	if appErr != nil {
		return agentGuidanceState{}, appErr
	}

	if context != nil && strings.TrimSpace(context.Surface) != "" {
		surface = context.Surface
	}
	normalizedSurface := normalizeAgentSurface(surface)
	activeLoan := findActiveLoan(loans)
	nextRequest := findPendingRequest(requests)
	claimableRewards := claimableRewardsTotal(user)
	scorePreview := isPreviewScore(score)
	bestProfileQuote := bestGuideProfileQuote(score, s.profileQuotes(user, score))
	liveProfileCap := bestProfileQuote != nil &&
		bestProfileQuote.Qualified &&
		strings.EqualFold(strings.TrimSpace(bestProfileQuote.Source), profileQuoteSourceRollup)
	liveProfileCapAmount := score.LimitUSD
	liveProfileLabel := ""
	if bestProfileQuote != nil {
		liveProfileCapAmount = effectiveGuideProfileLimit(score, *bestProfileQuote)
		liveProfileLabel = strings.ReplaceAll(bestProfileQuote.Label, "_", " ")
	}
	engineProvider := "heuristic"
	engineModel := "agent-planner-v1"
	extraContext := buildAgentExtraContextSummary(context)

	finalize := func(next agentGuidanceState) (agentGuidanceState, *appError) {
		if context != nil {
			switch normalizedSurface {
			case "request":
				applyAgentGuideRequestContext(&next, context.Request)
			case "loan":
				applyAgentGuideRepayContext(&next, context.Repay)
			}
		}

		return s.finalizeAgentGuidanceWithContext(
			ctx,
			next,
			user,
			score,
			normalizedSurface,
			nextRequest,
			activeLoan,
			claimableRewards,
			extraContext,
		), nil
	}

	guide := agentGuidanceState{
		AssistantDetail: "The agent is ready to translate your borrower state into the next safest move.",
		AssistantLabel:  "Account summary",
		Checklist: []agentChecklistItem{
			{Done: true, Label: "Wallet linked"},
			{Done: score.Score > 0, Label: "Profile scored"},
			{Done: activeLoan != nil || hasApprovedRequestWithoutLoan(requests, activeLoan), Label: "Credit unlocked"},
			{Done: activeLoan == nil || nextDueInstallment(*activeLoan) == nil, Label: "Repayment current"},
		},
		Confidence:     agentConfidence(79),
		GeneratedAt:    isoTime(time.Now().UTC()),
		Model:          &engineModel,
		PanelBody: ternaryGuideLabel(
			liveProfileCap,
			fmt.Sprintf("Your current %s is %d with a %s risk band. The rollup currently quotes up to %s through %s, and the agent will keep steering toward the next healthiest step for this account.", ternaryGuideLabel(scorePreview, "preview score", "score"), score.Score, strings.ToLower(score.Risk), usdLabel(float64(liveProfileCapAmount)), liveProfileLabel),
			fmt.Sprintf("Your current %s is %d with a %s risk band. The agent will keep steering toward the next healthiest step for this account.", ternaryGuideLabel(scorePreview, "preview score", "score"), score.Score, strings.ToLower(score.Risk)),
		),
		PanelTitle: ternaryGuideLabel(
			liveProfileCap,
			fmt.Sprintf("A live %s cap is available today", usdLabel(float64(liveProfileCapAmount))),
			ternaryGuideLabel(scorePreview, fmt.Sprintf("You can safely work within an estimated %s limit", usdLabel(float64(score.LimitUSD))), fmt.Sprintf("You can safely work within a %s limit", usdLabel(float64(score.LimitUSD)))),
		),
		Provider:       engineProvider,
		Recommendation: "Open Request and choose an app",
		Surface:        normalizedSurface,
	}

	switch normalizedSurface {
	case "analyze":
		guide.AssistantLabel = "Profile status"
		guide.AssistantDetail = ternaryGuideLabel(scorePreview, fmt.Sprintf("Preview score %d is ready. The agent is watching what most improves pricing next.", score.Score), fmt.Sprintf("Score %d is ready. The agent is watching what most improves pricing next.", score.Score))
		guide.PanelTitle = ternaryGuideLabel(scorePreview, fmt.Sprintf("Your preview score is %d and the next move is clear", score.Score), fmt.Sprintf("Your score is %d and the next move is clear", score.Score))
		guide.PanelBody = ternaryGuideLabel(scorePreview, fmt.Sprintf("Risk is %s with preview APR %.1f%%. The strongest lift now comes from clean repayment behavior, stronger loyalty signals, and a fresh sync after the next onchain action.", score.Risk, score.APR), fmt.Sprintf("Risk is %s with APR %.1f%%. The strongest lift now comes from clean repayment behavior, stronger loyalty signals, and a fresh sync after the next onchain action.", score.Risk, score.APR))
		guide.Recommendation = "Re-analyze after your next wallet action"
		guide.ActionLabel = agentAction("Re-analyze")
		guide.ActionKey = agentAction("analyze_profile")
		guide.Confidence = agentConfidence(83)
	case "request":
		guide.AssistantLabel = "Credit request"
		guide.AssistantDetail = "The agent is checking whether your account is ready to open a new credit request."
		guide.PanelTitle = ternaryGuideLabel(
			liveProfileCap,
			fmt.Sprintf("Your live %s cap supports up to %s today", liveProfileLabel, usdLabel(float64(liveProfileCapAmount))),
			ternaryGuideLabel(scorePreview, fmt.Sprintf("Your preview profile suggests up to %s today", usdLabel(float64(score.LimitUSD))), fmt.Sprintf("Your profile supports up to %s today", usdLabel(float64(score.LimitUSD)))),
		)
		guide.PanelBody = ternaryGuideLabel(
			liveProfileCap,
			fmt.Sprintf("The rollup quote for %s is live right now. Keep the request within %s and favor a smaller first cycle if you are still building repayment history.", liveProfileLabel, usdLabel(float64(liveProfileCapAmount))),
			ternaryGuideLabel(scorePreview, "Choose one trusted Initia app, keep the request within your estimated limit, and favor a smaller first cycle if you are still building repayment history.", "Choose one trusted Initia app, keep the request within your current limit, and favor a smaller first cycle if you are still building repayment history."),
		)
		guide.Recommendation = "Choose an app and submit a request"
		guide.ActionLabel = agentAction("Open Request")
		guide.ActionKey = agentAction("open_request")
		guide.Confidence = agentConfidence(82)
	case "loan":
		guide.AssistantLabel = "Repayment watch"
		guide.AssistantDetail = "The agent is watching your active balance, next due date, and repayment health."
		guide.PanelTitle = "No active loan is open right now"
		guide.PanelBody = "Once you use credit, the agent will track what is due next and keep the safest repayment path in front of you."
		guide.Recommendation = "Open Request when you are ready"
		guide.ActionLabel = agentAction("Use credit")
		guide.ActionKey = agentAction("open_request")
		guide.Confidence = agentConfidence(76)
	case "rewards":
		guide.AssistantLabel = "Loyalty status"
		guide.AssistantDetail = "The agent is watching claimable rewards, streak health, and what unlocks your next perk."
		guide.PanelTitle = "Turn healthy usage into stronger perks"
		guide.PanelBody = "Each clean repayment strengthens your loyalty position. Claimable rewards, streaks, and LEND held all feed into how much room and discounting the account can support."
		guide.Recommendation = "Use credit and keep repayments on time"
		guide.ActionLabel = agentAction("Use credit")
		guide.ActionKey = agentAction("open_request")
		guide.Confidence = agentConfidence(78)
	case "admin":
		guide.AssistantLabel = "Watching ecosystem activity"
		guide.AssistantDetail = "The agent is observing apps, campaigns, and protocol surfaces around the borrower journey."
		guide.PanelTitle = "Ecosystem awareness stays tied to borrower safety"
		guide.PanelBody = "This surface still helps the agent decide where credit can be used responsibly, but borrower health remains the primary decision boundary."
		guide.Recommendation = "Browse live apps and protocol surfaces"
		guide.ActionLabel = nil
		guide.ActionKey = nil
		guide.Confidence = agentConfidence(72)
	default:
		guide.AssistantLabel = "Account summary"
		guide.AssistantDetail = ternaryGuideLabel(
			liveProfileCap,
			fmt.Sprintf("The agent is watching %s %d and a live rollup cap of %s through %s to decide the next healthiest move.", ternaryGuideLabel(scorePreview, "preview score", "score"), score.Score, usdLabel(float64(liveProfileCapAmount)), liveProfileLabel),
			ternaryGuideLabel(scorePreview, fmt.Sprintf("The agent is watching preview score %d, the current estimated limit, and the next action most likely to improve this account.", score.Score), fmt.Sprintf("The agent is watching score %d, current limit, and the next action most likely to improve this account.", score.Score)),
		)
	}

	if nextRequest != nil {
		guide.AssistantLabel = "Pending review"
		guide.AssistantDetail = fmt.Sprintf("Request %s for %s is still being reviewed.", nextRequest.ID, usdLabel(nextRequest.Amount))
		guide.PanelTitle = "Wait for the current request result"
		guide.PanelBody = fmt.Sprintf("A %s request over %d month(s) is already pending. Opening another request now would create unnecessary risk and duplicate review work.", usdLabel(nextRequest.Amount), nextRequest.TenorMonths)
		guide.Recommendation = "Hold the line until review finishes"
		guide.ActionLabel = nil
		guide.ActionKey = nil
		guide.Confidence = agentConfidence(92)
		return finalize(guide)
	}

	if activeLoan != nil {
		dueItem := nextDueInstallment(*activeLoan)
		guide.AssistantLabel = "Repayment watch"
		if dueItem != nil {
			guide.AssistantDetail = fmt.Sprintf("Next installment %s is due by %s.", usdLabel(dueItem.Amount), shortDateLabel(dueItem.DueAt))
			guide.PanelTitle = fmt.Sprintf("Repay %s by %s", usdLabel(dueItem.Amount), shortDateLabel(dueItem.DueAt))
			guide.PanelBody = fmt.Sprintf("You still have an active %s credit line open. Paying the next installment on time protects your limit and keeps pricing pressure down for the next cycle.", usdLabel(activeLoan.Principal))
			guide.Recommendation = "Repay the next installment now"
			guide.ActionLabel = agentAction("Repay now")
			guide.ActionKey = agentAction("repay_now")
			guide.Confidence = agentConfidence(95)
		} else {
			guide.AssistantDetail = "The active loan is current. The agent is waiting for the next due state or app action."
			guide.PanelTitle = "Use the approved balance carefully"
			guide.PanelBody = fmt.Sprintf("The active %s credit is still open, but no installment is due right now. Use the funded balance in the selected app and stay ready for the next cycle.", usdLabel(activeLoan.Principal))
			guide.Recommendation = "Use the approved balance in your app"
			guide.ActionLabel = agentAction("Open Repay")
			guide.ActionKey = agentAction("open_repay")
			guide.Confidence = agentConfidence(86)
		}
		return finalize(guide)
	}

	if claimableRewards > 0 {
		guide.AssistantLabel = "Rewards ready"
		guide.AssistantDetail = fmt.Sprintf("%d LEND is claimable from rewards and staking right now.", claimableRewards)
		guide.PanelTitle = fmt.Sprintf("%d LEND is ready to claim", claimableRewards)
		guide.PanelBody = "The account has already earned rewards. Claiming them keeps the loyalty side visible and makes the next cycle easier to reason about."
		guide.Recommendation = "Claim available rewards"
		guide.ActionLabel = agentAction("Claim rewards")
		guide.ActionKey = agentAction("claim_rewards")
		guide.Confidence = agentConfidence(87)
		return finalize(guide)
	}

	if score.Risk == "High" {
		guide.PanelTitle = ternaryGuideLabel(
			liveProfileCap,
			fmt.Sprintf("Start smaller and build trust within the live %s cap", usdLabel(float64(liveProfileCapAmount))),
			ternaryGuideLabel(scorePreview, fmt.Sprintf("Start smaller and build trust within an estimated %s limit", usdLabel(float64(score.LimitUSD))), fmt.Sprintf("Start smaller and build trust from %s", usdLabel(float64(score.LimitUSD)))),
		)
		guide.PanelBody = ternaryGuideLabel(
			liveProfileCap,
			ternaryGuideLabel(
				scorePreview,
				fmt.Sprintf("The rollup already exposes a live %s cap through %s, but the account is still in the highest preview risk band. The safest agent move is a smaller first request followed by a clean on-time repayment streak.", usdLabel(float64(liveProfileCapAmount)), liveProfileLabel),
				fmt.Sprintf("The rollup already exposes a live %s cap through %s, but the account is still in the highest risk band. The safest agent move is a smaller first request followed by a clean on-time repayment streak.", usdLabel(float64(liveProfileCapAmount)), liveProfileLabel),
			),
			ternaryGuideLabel(scorePreview, "The account is still in the highest preview risk band. The safest agent move is a smaller first request followed by a clean on-time repayment streak.", "The account is still in the highest risk band. The safest agent move is a smaller first request followed by a clean on-time repayment streak."),
		)
		guide.Recommendation = "Open a smaller first request"
		guide.ActionLabel = agentAction("Use credit")
		guide.ActionKey = agentAction("open_request")
		guide.Confidence = agentConfidence(80)
		return finalize(guide)
	}

	guide.PanelTitle = ternaryGuideLabel(
		liveProfileCap,
		ternaryGuideLabel(scorePreview, fmt.Sprintf("You can conservatively explore up to the live %s cap today", usdLabel(float64(liveProfileCapAmount))), fmt.Sprintf("You can safely explore up to the live %s cap today", usdLabel(float64(liveProfileCapAmount)))),
		ternaryGuideLabel(scorePreview, fmt.Sprintf("You can conservatively explore up to %s today", usdLabel(float64(score.LimitUSD))), fmt.Sprintf("You can safely explore up to %s today", usdLabel(float64(score.LimitUSD)))),
	)
	guide.PanelBody = ternaryGuideLabel(
		liveProfileCap,
		ternaryGuideLabel(scorePreview, fmt.Sprintf("The rollup currently quotes up to %s through %s. Your preview risk band is %s with preview APR %.1f%%. The strongest next move is to choose a real app, stay within that ceiling, and keep the first repayment clean.", usdLabel(float64(liveProfileCapAmount)), liveProfileLabel, strings.ToLower(score.Risk), score.APR), fmt.Sprintf("The rollup currently quotes up to %s through %s. The account is in the %s risk band with APR %.1f%%. The strongest next move is to choose a real app, stay within that ceiling, and keep the first repayment clean.", usdLabel(float64(liveProfileCapAmount)), liveProfileLabel, strings.ToLower(score.Risk), score.APR)),
		ternaryGuideLabel(scorePreview, fmt.Sprintf("The account is in the %s preview risk band with preview APR %.1f%%. The strongest next move is to choose a real app, stay within the current ceiling, and keep the first repayment clean.", strings.ToLower(score.Risk), score.APR), fmt.Sprintf("The account is in the %s risk band with APR %.1f%%. The strongest next move is to choose a real app, stay within the current ceiling, and keep the first repayment clean.", strings.ToLower(score.Risk), score.APR)),
	)
	guide.Recommendation = "Open Request and choose an app"
	guide.ActionLabel = agentAction("Use credit")
	guide.ActionKey = agentAction("open_request")
	guide.Confidence = agentConfidence(84)
	return finalize(guide)
}

func ternaryGuideLabel(condition bool, whenTrue, whenFalse string) string {
	if condition {
		return whenTrue
	}

	return whenFalse
}

func (s *Server) handleGetAgentGuide(w http.ResponseWriter, r *http.Request) {
	user, appErr := s.currentUser(r)
	if appErr != nil {
		writeAppError(w, appErr)
		return
	}

	guide, appErr := s.buildAgentGuidance(r.Context(), user, r.URL.Query().Get("surface"))
	if appErr != nil {
		writeAppError(w, appErr)
		return
	}

	writeJSON(w, http.StatusOK, guide)
}

func (s *Server) handlePostAgentGuide(w http.ResponseWriter, r *http.Request) {
	user, appErr := s.currentUser(r)
	if appErr != nil {
		writeAppError(w, appErr)
		return
	}

	payload := agentGuideContext{}
	if err := decodeJSON(r, &payload); err != nil {
		writeAppError(w, err)
		return
	}

	guide, appErr := s.buildAgentGuidanceWithContext(r.Context(), user, payload.Surface, &payload)
	if appErr != nil {
		writeAppError(w, appErr)
		return
	}

	writeJSON(w, http.StatusOK, guide)
}
