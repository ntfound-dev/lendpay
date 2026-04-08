module lendpay::rewards {
    use std::event;
    use std::signer;
    use std::timestamp;
    use std::vector;
    use lendpay::config;
    use lendpay::errors;
    use lendpay::lend_token;

    friend lendpay::loan_book;
    friend lendpay::referral;

    const REASON_REQUEST: u8 = 1;
    const REASON_APPROVAL: u8 = 2;
    const REASON_ON_TIME_PAYMENT: u8 = 3;
    const REASON_LATE_PAYMENT: u8 = 4;
    const REASON_FULL_REPAYMENT: u8 = 5;
    const REASON_DEFAULT_PENALTY: u8 = 6;
    const REASON_REFERRAL: u8 = 7;

    const SPEND_REDEEM_TO_LEND: u8 = 11;
    const SPEND_LIMIT_BOOST: u8 = 12;
    const SPEND_INTEREST_DISCOUNT: u8 = 13;
    const SPEND_PREMIUM_CHECK: u8 = 14;
    const SPEND_BADGE: u8 = 15;

    struct RewardAccount has copy, drop, store {
        user: address,
        points: u64,
        points_spent: u64,
        lifetime_points: u64,
        claimable_lend: u64,
        claimed_lend: u64,
        current_streak: u64,
        credit_limit_boost_bps: u64,
        interest_discount_bps: u64,
        premium_checks_available: u64,
        badge_count: u64,
        last_rewarded_at: u64,
    }

    struct RewardsRegistry has key {
        accounts: vector<RewardAccount>,
    }

    #[event]
    struct PointsAwardedEvent has drop, store {
        user: address,
        reason_code: u8,
        points_delta: u64,
        new_points_balance: u64,
        claimable_lend: u64,
    }

    #[event]
    struct PointsSpentEvent has drop, store {
        user: address,
        use_code: u8,
        points_delta: u64,
        new_points_balance: u64,
    }

    #[event]
    struct LendClaimedEvent has drop, store {
        user: address,
        amount: u64,
        total_claimed: u64,
    }

    public entry fun initialize(admin: &signer) {
        config::assert_admin(signer::address_of(admin));
        assert!(!exists<RewardsRegistry>(@lendpay), errors::already_initialized());
        move_to(admin, RewardsRegistry { accounts: vector::empty() });
    }

    public(friend) fun reward_request(user: address) acquires RewardsRegistry {
        grant_points(user, config::request_points(), REASON_REQUEST, false, false);
    }

    public(friend) fun reward_approval(user: address) acquires RewardsRegistry {
        grant_points(user, config::approval_points(), REASON_APPROVAL, false, false);
    }

    public(friend) fun reward_on_time_payment(user: address) acquires RewardsRegistry {
        grant_points(user, config::on_time_payment_points(), REASON_ON_TIME_PAYMENT, true, false);
    }

    public(friend) fun reward_late_payment(user: address) acquires RewardsRegistry {
        grant_points(user, config::late_payment_points(), REASON_LATE_PAYMENT, false, true);
    }

    public(friend) fun reward_full_repayment(user: address) acquires RewardsRegistry {
        grant_points(user, config::full_repayment_bonus_points(), REASON_FULL_REPAYMENT, false, false);
    }

    public(friend) fun reward_referral(user: address, points: u64) acquires RewardsRegistry {
        grant_points(user, points, REASON_REFERRAL, false, false);
    }

    public(friend) fun penalize_default(user: address) acquires RewardsRegistry {
        let registry = borrow_global_mut<RewardsRegistry>(@lendpay);
        let account = borrow_or_create_account_in_registry(registry, user);
        let penalty = config::default_penalty_points();
        let effective_penalty = if (account.points > penalty) penalty else account.points;

        account.points = account.points - effective_penalty;
        account.current_streak = 0;
        account.last_rewarded_at = timestamp::now_seconds();

        event::emit(PointsAwardedEvent {
            user,
            reason_code: REASON_DEFAULT_PENALTY,
            points_delta: effective_penalty,
            new_points_balance: account.points,
            claimable_lend: account.claimable_lend,
        });
    }

    public entry fun claim_lend(user: &signer) acquires RewardsRegistry {
        config::assert_not_paused();

        let user_addr = signer::address_of(user);
        let registry = borrow_global_mut<RewardsRegistry>(@lendpay);
        let (claim_amount, total_claimed_after) = {
            let account = borrow_or_create_account_in_registry(registry, user_addr);
            let claim_amount = account.claimable_lend;

            assert!(claim_amount > 0, errors::nothing_to_claim());

            account.claimable_lend = 0;
            account.claimed_lend = account.claimed_lend + claim_amount;
            account.last_rewarded_at = timestamp::now_seconds();
            (claim_amount, account.claimed_lend)
        };

        lend_token::distribute_from_protocol(user_addr, claim_amount);

        event::emit(LendClaimedEvent {
            user: user_addr,
            amount: claim_amount,
            total_claimed: total_claimed_after,
        });
    }

    public entry fun redeem_points_to_claimable_lend(
        user: &signer,
        points_to_redeem: u64,
    ) acquires RewardsRegistry {
        config::assert_not_paused();
        assert!(points_to_redeem > 0, errors::invalid_amount());

        let user_addr = signer::address_of(user);
        let lend_amount = points_to_lend(points_to_redeem);
        let registry = borrow_global_mut<RewardsRegistry>(@lendpay);
        let account = spend_points_in_registry(
            registry,
            user_addr,
            points_to_redeem,
            SPEND_REDEEM_TO_LEND,
        );
        account.claimable_lend = account.claimable_lend + lend_amount;
    }

    public entry fun spend_points_for_limit_boost(user: &signer) acquires RewardsRegistry {
        config::assert_not_paused();

        let user_addr = signer::address_of(user);
        let boost_increment = config::credit_limit_boost_bps();
        let max_total_boost_bps = config::max_total_credit_limit_boost_bps();
        assert!(
            boost_increment > 0 && boost_increment <= max_total_boost_bps,
            errors::invalid_policy(),
        );
        let registry = borrow_global_mut<RewardsRegistry>(@lendpay);
        let account = spend_points_in_registry(
            registry,
            user_addr,
            config::credit_limit_boost_cost_points(),
            SPEND_LIMIT_BOOST,
        );
        assert!(
            account.credit_limit_boost_bps <= max_total_boost_bps - boost_increment,
            errors::invalid_policy(),
        );
        account.credit_limit_boost_bps = account.credit_limit_boost_bps + boost_increment;
    }

    public entry fun spend_points_for_interest_discount(
        user: &signer,
        whole_percent: u64,
    ) acquires RewardsRegistry {
        config::assert_not_paused();
        assert!(whole_percent > 0, errors::invalid_amount());
        assert!(
            whole_percent <= config::max_interest_discount_purchase_percent(),
            errors::invalid_policy(),
        );

        let user_addr = signer::address_of(user);
        let discount_bps = whole_percent * 100;
        let max_total_discount_bps = config::max_total_interest_discount_bps();
        assert!(discount_bps <= max_total_discount_bps, errors::invalid_policy());
        let points_cost = whole_percent * config::interest_discount_cost_points_per_percent();
        let registry = borrow_global_mut<RewardsRegistry>(@lendpay);
        let account = spend_points_in_registry(registry, user_addr, points_cost, SPEND_INTEREST_DISCOUNT);
        assert!(
            account.interest_discount_bps <= max_total_discount_bps - discount_bps,
            errors::invalid_policy(),
        );
        account.interest_discount_bps = account.interest_discount_bps + discount_bps;
    }

    public entry fun unlock_premium_credit_check(user: &signer) acquires RewardsRegistry {
        config::assert_not_paused();

        let user_addr = signer::address_of(user);
        let registry = borrow_global_mut<RewardsRegistry>(@lendpay);
        let account = spend_points_in_registry(
            registry,
            user_addr,
            config::premium_check_cost_points(),
            SPEND_PREMIUM_CHECK,
        );
        account.premium_checks_available = account.premium_checks_available + 1;
    }

    public entry fun redeem_exclusive_badge(user: &signer) acquires RewardsRegistry {
        config::assert_not_paused();

        let user_addr = signer::address_of(user);
        let registry = borrow_global_mut<RewardsRegistry>(@lendpay);
        let account = spend_points_in_registry(
            registry,
            user_addr,
            config::badge_cost_points(),
            SPEND_BADGE,
        );
        account.badge_count = account.badge_count + 1;
    }

    #[view]
    public fun get_account(user: address): RewardAccount acquires RewardsRegistry {
        let registry = borrow_global<RewardsRegistry>(@lendpay);
        let len = vector::length(&registry.accounts);
        let i = 0;

        while (i < len) {
            let account = vector::borrow(&registry.accounts, i);
            if (account.user == user) {
                return *account
            };
            i = i + 1;
        };

        zero_account(user)
    }

    #[view]
    public fun interest_discount_bps_of(user: address): u64 acquires RewardsRegistry {
        get_account(user).interest_discount_bps
    }

    #[view]
    public fun credit_limit_boost_bps_of(user: address): u64 acquires RewardsRegistry {
        get_account(user).credit_limit_boost_bps
    }

    #[view]
    public fun premium_checks_available_of(user: address): u64 acquires RewardsRegistry {
        get_account(user).premium_checks_available
    }

    #[view]
    public fun badge_count_of(user: address): u64 acquires RewardsRegistry {
        get_account(user).badge_count
    }

    #[view]
    public fun points_balance_of(user: address): u64 acquires RewardsRegistry {
        get_account(user).points
    }

    fun grant_points(
        user: address,
        points_delta: u64,
        reason_code: u8,
        increment_streak: bool,
        reset_streak: bool,
    ) acquires RewardsRegistry {
        let registry = borrow_global_mut<RewardsRegistry>(@lendpay);
        let account = borrow_or_create_account_in_registry(registry, user);
        let lend_delta = points_to_lend(points_delta);

        account.points = account.points + points_delta;
        account.lifetime_points = account.lifetime_points + points_delta;
        account.claimable_lend = account.claimable_lend + lend_delta;
        account.last_rewarded_at = timestamp::now_seconds();

        if (reset_streak) {
            account.current_streak = 0;
        };

        if (increment_streak) {
            account.current_streak = account.current_streak + 1;
        };

        event::emit(PointsAwardedEvent {
            user,
            reason_code,
            points_delta,
            new_points_balance: account.points,
            claimable_lend: account.claimable_lend,
        });
    }

    fun spend_points_in_registry(
        registry: &mut RewardsRegistry,
        user: address,
        points_delta: u64,
        use_code: u8,
    ): &mut RewardAccount {
        let account = borrow_or_create_account_in_registry(registry, user);
        assert!(account.points >= points_delta, errors::insufficient_points());

        account.points = account.points - points_delta;
        account.points_spent = account.points_spent + points_delta;
        account.last_rewarded_at = timestamp::now_seconds();

        event::emit(PointsSpentEvent {
            user,
            use_code,
            points_delta,
            new_points_balance: account.points,
        });

        account
    }

    fun points_to_lend(points_delta: u64): u64 {
        (points_delta * config::lend_per_point_bps()) / 10_000
    }

    fun zero_account(user: address): RewardAccount {
        RewardAccount {
            user,
            points: 0,
            points_spent: 0,
            lifetime_points: 0,
            claimable_lend: 0,
            claimed_lend: 0,
            current_streak: 0,
            credit_limit_boost_bps: 0,
            interest_discount_bps: 0,
            premium_checks_available: 0,
            badge_count: 0,
            last_rewarded_at: 0,
        }
    }

    fun borrow_or_create_account_in_registry(
        registry: &mut RewardsRegistry,
        user: address,
    ): &mut RewardAccount {
        let len = vector::length(&registry.accounts);
        let i = 0;

        while (i < len) {
            if (vector::borrow(&registry.accounts, i).user == user) {
                return vector::borrow_mut(&mut registry.accounts, i)
            };
            i = i + 1;
        };

        vector::push_back(&mut registry.accounts, zero_account(user));

        let new_len = vector::length(&registry.accounts);
        vector::borrow_mut(&mut registry.accounts, new_len - 1)
    }
}
