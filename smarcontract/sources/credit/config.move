module lendpay::config {
    use std::signer;
    use lendpay::errors;

    const DEFAULT_ORIGINATION_FEE_BPS: u64 = 150;
    const DEFAULT_LATE_FEE_BPS: u64 = 500;
    const DEFAULT_MAX_TENOR_MONTHS: u8 = 12;
    const DEFAULT_GRACE_PERIOD_SECONDS: u64 = 7 * 24 * 60 * 60;
    const DEFAULT_REQUEST_POINTS: u64 = 100;
    const DEFAULT_APPROVAL_POINTS: u64 = 200;
    const DEFAULT_ON_TIME_PAYMENT_POINTS: u64 = 50;
    const DEFAULT_LATE_PAYMENT_POINTS: u64 = 0;
    const DEFAULT_FULL_REPAYMENT_BONUS_POINTS: u64 = 100;
    const DEFAULT_DEFAULT_PENALTY_POINTS: u64 = 250;
    const DEFAULT_LEND_PER_POINT_BPS: u64 = 100;

    const DEFAULT_BRONZE_MIN_LEND: u64 = 100;
    const DEFAULT_SILVER_MIN_LEND: u64 = 500;
    const DEFAULT_GOLD_MIN_LEND: u64 = 2_000;
    const DEFAULT_DIAMOND_MIN_LEND: u64 = 10_000;

    const DEFAULT_BRONZE_FEE_DISCOUNT_BPS: u64 = 500;
    const DEFAULT_SILVER_FEE_DISCOUNT_BPS: u64 = 1_000;
    const DEFAULT_GOLD_FEE_DISCOUNT_BPS: u64 = 1_500;
    const DEFAULT_DIAMOND_FEE_DISCOUNT_BPS: u64 = 2_500;
    const DEFAULT_PAY_FEE_IN_LEND_DISCOUNT_BPS: u64 = 500;
    const DEFAULT_CREDIT_LIMIT_BOOST_COST_POINTS: u64 = 500;
    const DEFAULT_CREDIT_LIMIT_BOOST_BPS: u64 = 500;
    const DEFAULT_INTEREST_DISCOUNT_COST_POINTS_PER_PERCENT: u64 = 300;
    const DEFAULT_PREMIUM_CHECK_COST_POINTS: u64 = 200;
    const DEFAULT_BADGE_COST_POINTS: u64 = 1_000;
    const DEFAULT_GOVERNANCE_PROPOSAL_THRESHOLD_LEND: u64 = 500;
    const DEFAULT_GOVERNANCE_QUORUM_BPS: u64 = 2_000;
    const DEFAULT_GOVERNANCE_VOTING_PERIOD_SECONDS: u64 = 7 * 24 * 60 * 60;

    struct Config has key {
        admin: address,
        treasury_admin: address,
        loan_asset_metadata: address,
        lend_metadata: address,
        origination_fee_bps: u64,
        late_fee_bps: u64,
        max_tenor_months: u8,
        default_grace_period_seconds: u64,
        request_points: u64,
        approval_points: u64,
        on_time_payment_points: u64,
        late_payment_points: u64,
        full_repayment_bonus_points: u64,
        default_penalty_points: u64,
        lend_per_point_bps: u64,
        bronze_min_lend: u64,
        silver_min_lend: u64,
        gold_min_lend: u64,
        diamond_min_lend: u64,
        bronze_fee_discount_bps: u64,
        silver_fee_discount_bps: u64,
        gold_fee_discount_bps: u64,
        diamond_fee_discount_bps: u64,
        pay_fee_in_lend_discount_bps: u64,
        credit_limit_boost_cost_points: u64,
        credit_limit_boost_bps: u64,
        interest_discount_cost_points_per_percent: u64,
        premium_check_cost_points: u64,
        badge_cost_points: u64,
        governance_proposal_threshold_lend: u64,
        governance_quorum_bps: u64,
        governance_voting_period_seconds: u64,
        package_paused: bool,
    }

    public entry fun initialize(
        admin: &signer,
        treasury_admin: address,
        loan_asset_metadata: address,
        lend_metadata: address,
    ) {
        assert!(signer::address_of(admin) == @lendpay, errors::not_package_owner());
        assert!(!exists<Config>(@lendpay), errors::already_initialized());

        move_to(admin, Config {
            admin: signer::address_of(admin),
            treasury_admin,
            loan_asset_metadata,
            lend_metadata,
            origination_fee_bps: DEFAULT_ORIGINATION_FEE_BPS,
            late_fee_bps: DEFAULT_LATE_FEE_BPS,
            max_tenor_months: DEFAULT_MAX_TENOR_MONTHS,
            default_grace_period_seconds: DEFAULT_GRACE_PERIOD_SECONDS,
            request_points: DEFAULT_REQUEST_POINTS,
            approval_points: DEFAULT_APPROVAL_POINTS,
            on_time_payment_points: DEFAULT_ON_TIME_PAYMENT_POINTS,
            late_payment_points: DEFAULT_LATE_PAYMENT_POINTS,
            full_repayment_bonus_points: DEFAULT_FULL_REPAYMENT_BONUS_POINTS,
            default_penalty_points: DEFAULT_DEFAULT_PENALTY_POINTS,
            lend_per_point_bps: DEFAULT_LEND_PER_POINT_BPS,
            bronze_min_lend: DEFAULT_BRONZE_MIN_LEND,
            silver_min_lend: DEFAULT_SILVER_MIN_LEND,
            gold_min_lend: DEFAULT_GOLD_MIN_LEND,
            diamond_min_lend: DEFAULT_DIAMOND_MIN_LEND,
            bronze_fee_discount_bps: DEFAULT_BRONZE_FEE_DISCOUNT_BPS,
            silver_fee_discount_bps: DEFAULT_SILVER_FEE_DISCOUNT_BPS,
            gold_fee_discount_bps: DEFAULT_GOLD_FEE_DISCOUNT_BPS,
            diamond_fee_discount_bps: DEFAULT_DIAMOND_FEE_DISCOUNT_BPS,
            pay_fee_in_lend_discount_bps: DEFAULT_PAY_FEE_IN_LEND_DISCOUNT_BPS,
            credit_limit_boost_cost_points: DEFAULT_CREDIT_LIMIT_BOOST_COST_POINTS,
            credit_limit_boost_bps: DEFAULT_CREDIT_LIMIT_BOOST_BPS,
            interest_discount_cost_points_per_percent:
                DEFAULT_INTEREST_DISCOUNT_COST_POINTS_PER_PERCENT,
            premium_check_cost_points: DEFAULT_PREMIUM_CHECK_COST_POINTS,
            badge_cost_points: DEFAULT_BADGE_COST_POINTS,
            governance_proposal_threshold_lend: DEFAULT_GOVERNANCE_PROPOSAL_THRESHOLD_LEND,
            governance_quorum_bps: DEFAULT_GOVERNANCE_QUORUM_BPS,
            governance_voting_period_seconds: DEFAULT_GOVERNANCE_VOTING_PERIOD_SECONDS,
            package_paused: false,
        });
    }

    public entry fun set_pause(admin: &signer, paused: bool) acquires Config {
        assert_admin(signer::address_of(admin));
        borrow_global_mut<Config>(@lendpay).package_paused = paused;
    }

    public entry fun update_treasury_admin(admin: &signer, treasury_admin: address) acquires Config {
        assert_admin(signer::address_of(admin));
        borrow_global_mut<Config>(@lendpay).treasury_admin = treasury_admin;
    }

    public entry fun update_fee_policy(
        admin: &signer,
        origination_fee_bps: u64,
        late_fee_bps: u64,
        pay_fee_in_lend_discount_bps: u64,
    ) acquires Config {
        assert_admin(signer::address_of(admin));
        assert!(
            origination_fee_bps <= 10_000 &&
                late_fee_bps <= 10_000 &&
                pay_fee_in_lend_discount_bps <= 10_000,
            errors::invalid_policy(),
        );

        let cfg = borrow_global_mut<Config>(@lendpay);
        cfg.origination_fee_bps = origination_fee_bps;
        cfg.late_fee_bps = late_fee_bps;
        cfg.pay_fee_in_lend_discount_bps = pay_fee_in_lend_discount_bps;
    }

    public entry fun update_reward_policy(
        admin: &signer,
        request_points: u64,
        approval_points: u64,
        on_time_payment_points: u64,
        late_payment_points: u64,
        full_repayment_bonus_points: u64,
        default_penalty_points: u64,
        lend_per_point_bps: u64,
    ) acquires Config {
        assert_admin(signer::address_of(admin));

        let cfg = borrow_global_mut<Config>(@lendpay);
        cfg.request_points = request_points;
        cfg.approval_points = approval_points;
        cfg.on_time_payment_points = on_time_payment_points;
        cfg.late_payment_points = late_payment_points;
        cfg.full_repayment_bonus_points = full_repayment_bonus_points;
        cfg.default_penalty_points = default_penalty_points;
        cfg.lend_per_point_bps = lend_per_point_bps;
    }

    public entry fun update_tier_policy(
        admin: &signer,
        bronze_min_lend: u64,
        silver_min_lend: u64,
        gold_min_lend: u64,
        diamond_min_lend: u64,
        bronze_fee_discount_bps: u64,
        silver_fee_discount_bps: u64,
        gold_fee_discount_bps: u64,
        diamond_fee_discount_bps: u64,
    ) acquires Config {
        assert_admin(signer::address_of(admin));
        assert!(
            bronze_min_lend <= silver_min_lend &&
                silver_min_lend <= gold_min_lend &&
                gold_min_lend <= diamond_min_lend,
            errors::invalid_policy(),
        );

        let cfg = borrow_global_mut<Config>(@lendpay);
        cfg.bronze_min_lend = bronze_min_lend;
        cfg.silver_min_lend = silver_min_lend;
        cfg.gold_min_lend = gold_min_lend;
        cfg.diamond_min_lend = diamond_min_lend;
        cfg.bronze_fee_discount_bps = bronze_fee_discount_bps;
        cfg.silver_fee_discount_bps = silver_fee_discount_bps;
        cfg.gold_fee_discount_bps = gold_fee_discount_bps;
        cfg.diamond_fee_discount_bps = diamond_fee_discount_bps;
    }

    public entry fun update_point_spend_policy(
        admin: &signer,
        credit_limit_boost_cost_points: u64,
        credit_limit_boost_bps: u64,
        interest_discount_cost_points_per_percent: u64,
        premium_check_cost_points: u64,
        badge_cost_points: u64,
    ) acquires Config {
        assert_admin(signer::address_of(admin));

        let cfg = borrow_global_mut<Config>(@lendpay);
        cfg.credit_limit_boost_cost_points = credit_limit_boost_cost_points;
        cfg.credit_limit_boost_bps = credit_limit_boost_bps;
        cfg.interest_discount_cost_points_per_percent = interest_discount_cost_points_per_percent;
        cfg.premium_check_cost_points = premium_check_cost_points;
        cfg.badge_cost_points = badge_cost_points;
    }

    public entry fun update_governance_policy(
        admin: &signer,
        governance_proposal_threshold_lend: u64,
        governance_quorum_bps: u64,
        governance_voting_period_seconds: u64,
    ) acquires Config {
        assert_admin(signer::address_of(admin));
        assert!(governance_quorum_bps <= 10_000, errors::invalid_policy());

        let cfg = borrow_global_mut<Config>(@lendpay);
        cfg.governance_proposal_threshold_lend = governance_proposal_threshold_lend;
        cfg.governance_quorum_bps = governance_quorum_bps;
        cfg.governance_voting_period_seconds = governance_voting_period_seconds;
    }

    public fun assert_admin(actor: address) acquires Config {
        assert!(exists<Config>(@lendpay), errors::not_initialized());
        assert!(borrow_global<Config>(@lendpay).admin == actor, errors::not_admin());
    }

    public fun assert_treasury_admin(actor: address) acquires Config {
        assert!(exists<Config>(@lendpay), errors::not_initialized());
        assert!(
            borrow_global<Config>(@lendpay).treasury_admin == actor ||
                borrow_global<Config>(@lendpay).admin == actor,
            errors::not_treasury_admin(),
        );
    }

    public fun assert_not_paused() acquires Config {
        assert!(exists<Config>(@lendpay), errors::not_initialized());
        assert!(!borrow_global<Config>(@lendpay).package_paused, errors::package_paused());
    }

    #[view]
    public fun admin(): address acquires Config {
        borrow_global<Config>(@lendpay).admin
    }

    #[view]
    public fun treasury_admin(): address acquires Config {
        borrow_global<Config>(@lendpay).treasury_admin
    }

    #[view]
    public fun loan_asset_metadata(): address acquires Config {
        borrow_global<Config>(@lendpay).loan_asset_metadata
    }

    #[view]
    public fun lend_metadata(): address acquires Config {
        borrow_global<Config>(@lendpay).lend_metadata
    }

    #[view]
    public fun max_tenor_months(): u8 acquires Config {
        borrow_global<Config>(@lendpay).max_tenor_months
    }

    #[view]
    public fun default_grace_period_seconds(): u64 acquires Config {
        borrow_global<Config>(@lendpay).default_grace_period_seconds
    }

    #[view]
    public fun request_points(): u64 acquires Config {
        borrow_global<Config>(@lendpay).request_points
    }

    #[view]
    public fun approval_points(): u64 acquires Config {
        borrow_global<Config>(@lendpay).approval_points
    }

    #[view]
    public fun on_time_payment_points(): u64 acquires Config {
        borrow_global<Config>(@lendpay).on_time_payment_points
    }

    #[view]
    public fun late_payment_points(): u64 acquires Config {
        borrow_global<Config>(@lendpay).late_payment_points
    }

    #[view]
    public fun full_repayment_bonus_points(): u64 acquires Config {
        borrow_global<Config>(@lendpay).full_repayment_bonus_points
    }

    #[view]
    public fun default_penalty_points(): u64 acquires Config {
        borrow_global<Config>(@lendpay).default_penalty_points
    }

    #[view]
    public fun lend_per_point_bps(): u64 acquires Config {
        borrow_global<Config>(@lendpay).lend_per_point_bps
    }

    #[view]
    public fun origination_fee_bps(): u64 acquires Config {
        borrow_global<Config>(@lendpay).origination_fee_bps
    }

    #[view]
    public fun late_fee_bps(): u64 acquires Config {
        borrow_global<Config>(@lendpay).late_fee_bps
    }

    #[view]
    public fun bronze_min_lend(): u64 acquires Config {
        borrow_global<Config>(@lendpay).bronze_min_lend
    }

    #[view]
    public fun silver_min_lend(): u64 acquires Config {
        borrow_global<Config>(@lendpay).silver_min_lend
    }

    #[view]
    public fun gold_min_lend(): u64 acquires Config {
        borrow_global<Config>(@lendpay).gold_min_lend
    }

    #[view]
    public fun diamond_min_lend(): u64 acquires Config {
        borrow_global<Config>(@lendpay).diamond_min_lend
    }

    #[view]
    public fun bronze_fee_discount_bps(): u64 acquires Config {
        borrow_global<Config>(@lendpay).bronze_fee_discount_bps
    }

    #[view]
    public fun silver_fee_discount_bps(): u64 acquires Config {
        borrow_global<Config>(@lendpay).silver_fee_discount_bps
    }

    #[view]
    public fun gold_fee_discount_bps(): u64 acquires Config {
        borrow_global<Config>(@lendpay).gold_fee_discount_bps
    }

    #[view]
    public fun diamond_fee_discount_bps(): u64 acquires Config {
        borrow_global<Config>(@lendpay).diamond_fee_discount_bps
    }

    #[view]
    public fun pay_fee_in_lend_discount_bps(): u64 acquires Config {
        borrow_global<Config>(@lendpay).pay_fee_in_lend_discount_bps
    }

    #[view]
    public fun credit_limit_boost_cost_points(): u64 acquires Config {
        borrow_global<Config>(@lendpay).credit_limit_boost_cost_points
    }

    #[view]
    public fun credit_limit_boost_bps(): u64 acquires Config {
        borrow_global<Config>(@lendpay).credit_limit_boost_bps
    }

    #[view]
    public fun interest_discount_cost_points_per_percent(): u64 acquires Config {
        borrow_global<Config>(@lendpay).interest_discount_cost_points_per_percent
    }

    #[view]
    public fun premium_check_cost_points(): u64 acquires Config {
        borrow_global<Config>(@lendpay).premium_check_cost_points
    }

    #[view]
    public fun badge_cost_points(): u64 acquires Config {
        borrow_global<Config>(@lendpay).badge_cost_points
    }

    #[view]
    public fun governance_proposal_threshold_lend(): u64 acquires Config {
        borrow_global<Config>(@lendpay).governance_proposal_threshold_lend
    }

    #[view]
    public fun governance_quorum_bps(): u64 acquires Config {
        borrow_global<Config>(@lendpay).governance_quorum_bps
    }

    #[view]
    public fun governance_voting_period_seconds(): u64 acquires Config {
        borrow_global<Config>(@lendpay).governance_voting_period_seconds
    }

    #[view]
    public fun is_paused(): bool acquires Config {
        borrow_global<Config>(@lendpay).package_paused
    }
}
