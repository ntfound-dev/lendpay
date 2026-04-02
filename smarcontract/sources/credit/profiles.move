module lendpay::profiles {
    use std::signer;
    use std::vector;
    use lendpay::config;
    use lendpay::errors;
    use lendpay::lend_token;
    use lendpay::rewards;
    use lendpay::tokenomics;

    const PROFILE_MICRO_LOAN: u8 = 1;
    const PROFILE_STANDARD_BNPL: u8 = 2;
    const PROFILE_CREDIT_LINE: u8 = 3;
    const PROFILE_COLLATERALIZED: u8 = 4;
    const DEFAULT_COLLATERAL_RATIO_BPS: u64 = 15_000;

    struct CreditProfile has copy, drop, store {
        profile_id: u8,
        label_hash: vector<u8>,
        max_principal_hint: u64,
        max_tenor_months: u8,
        min_lend_holdings: u64,
        requires_collateral: bool,
        revolving: bool,
        collateral_ratio_bps: u64,
    }

    struct ProfileRegistry has key {
        profiles: vector<CreditProfile>,
    }

    struct ProfileQuote has copy, drop, store {
        profile_id: u8,
        qualified: bool,
        max_principal: u64,
        max_tenor_months: u8,
        requires_collateral: bool,
        revolving: bool,
        min_lend_holdings: u64,
        current_lend_holdings: u64,
        tier_limit_multiplier_bps: u64,
        credit_limit_boost_bps: u64,
        collateral_ratio_bps: u64,
    }

    public entry fun initialize(admin: &signer) {
        config::assert_admin(signer::address_of(admin));
        assert!(!exists<ProfileRegistry>(@lendpay), errors::already_initialized());

        let profiles = vector::empty<CreditProfile>();
        vector::push_back(
            &mut profiles,
            CreditProfile {
                profile_id: PROFILE_MICRO_LOAN,
                label_hash: x"6d6963726f5f6c6f616e",
                max_principal_hint: 500,
                max_tenor_months: 3,
                min_lend_holdings: 0,
                requires_collateral: false,
                revolving: false,
                collateral_ratio_bps: 0,
            },
        );
        vector::push_back(
            &mut profiles,
            CreditProfile {
                profile_id: PROFILE_STANDARD_BNPL,
                label_hash: x"7374616e646172645f626e706c",
                max_principal_hint: 2_500,
                max_tenor_months: 6,
                min_lend_holdings: 100,
                requires_collateral: false,
                revolving: false,
                collateral_ratio_bps: 0,
            },
        );
        vector::push_back(
            &mut profiles,
            CreditProfile {
                profile_id: PROFILE_CREDIT_LINE,
                label_hash: x"6372656469745f6c696e65",
                max_principal_hint: 5_000,
                max_tenor_months: 12,
                min_lend_holdings: 500,
                requires_collateral: false,
                revolving: true,
                collateral_ratio_bps: 0,
            },
        );
        vector::push_back(
            &mut profiles,
            CreditProfile {
                profile_id: PROFILE_COLLATERALIZED,
                label_hash: x"636f6c6c61746572616c697a6564",
                max_principal_hint: 20_000,
                max_tenor_months: 18,
                min_lend_holdings: 0,
                requires_collateral: true,
                revolving: false,
                collateral_ratio_bps: DEFAULT_COLLATERAL_RATIO_BPS,
            },
        );

        move_to(admin, ProfileRegistry { profiles });
    }

    public entry fun update_profile(
        admin: &signer,
        profile_id: u8,
        max_principal_hint: u64,
        max_tenor_months: u8,
        min_lend_holdings: u64,
        requires_collateral: bool,
        revolving: bool,
        collateral_ratio_bps: u64,
    ) acquires ProfileRegistry {
        config::assert_admin(signer::address_of(admin));
        assert!(!requires_collateral || collateral_ratio_bps >= 10_000, errors::invalid_policy());
        let registry = borrow_global_mut<ProfileRegistry>(@lendpay);
        let index = find_profile_index(registry, profile_id);
        let profile = vector::borrow_mut(&mut registry.profiles, index);
        profile.max_principal_hint = max_principal_hint;
        profile.max_tenor_months = max_tenor_months;
        profile.min_lend_holdings = min_lend_holdings;
        profile.requires_collateral = requires_collateral;
        profile.revolving = revolving;
        profile.collateral_ratio_bps = if (requires_collateral) collateral_ratio_bps else 0;
    }

    #[view]
    public fun get_profile(profile_id: u8): CreditProfile acquires ProfileRegistry {
        let registry = borrow_global<ProfileRegistry>(@lendpay);
        let index = find_profile_index_ref(registry, profile_id);
        *vector::borrow(&registry.profiles, index)
    }

    #[view]
    public fun profile_count(): u64 acquires ProfileRegistry {
        vector::length(&borrow_global<ProfileRegistry>(@lendpay).profiles)
    }

    #[view]
    public fun quote_profile(user: address, profile_id: u8): ProfileQuote acquires ProfileRegistry {
        let profile = get_profile(profile_id);
        let current_lend_holdings = lend_token::total_balance_of(user);
        let tier_limit_multiplier_bps =
            tokenomics::tier_limit_multiplier_bps(current_lend_holdings);
        let credit_limit_boost_bps = rewards::credit_limit_boost_bps_of(user);
        let tier_scaled_max =
            (profile.max_principal_hint * tier_limit_multiplier_bps) / 10_000;
        let boosted_max =
            (tier_scaled_max * (10_000 + credit_limit_boost_bps)) / 10_000;
        let qualified = current_lend_holdings >= profile.min_lend_holdings;

        ProfileQuote {
            profile_id,
            qualified,
            max_principal: boosted_max,
            max_tenor_months: profile.max_tenor_months,
            requires_collateral: profile.requires_collateral,
            revolving: profile.revolving,
            min_lend_holdings: profile.min_lend_holdings,
            current_lend_holdings,
            tier_limit_multiplier_bps,
            credit_limit_boost_bps,
            collateral_ratio_bps: profile.collateral_ratio_bps,
        }
    }

    #[view]
    public fun qualifies_for_profile(user: address, profile_id: u8): bool acquires ProfileRegistry {
        quote_profile(user, profile_id).qualified
    }

    #[view]
    public fun max_principal_for(user: address, profile_id: u8): u64 acquires ProfileRegistry {
        quote_profile(user, profile_id).max_principal
    }

    #[view]
    public fun required_collateral_for(profile_id: u8, amount: u64): u64 acquires ProfileRegistry {
        let profile = get_profile(profile_id);
        if (!profile.requires_collateral || amount == 0) {
            0
        } else {
            let raw = amount * profile.collateral_ratio_bps;
            let rounded = raw + 9_999;
            rounded / 10_000
        }
    }

    public fun assert_request_allowed(
        user: address,
        profile_id: u8,
        amount: u64,
        tenor_months: u8,
    ) acquires ProfileRegistry {
        let quote = quote_profile(user, profile_id);

        assert!(!quote.requires_collateral, errors::collateral_required());
        assert!(quote.current_lend_holdings >= quote.min_lend_holdings, errors::profile_requirements_not_met());
        assert!(
            tenor_months > 0 &&
                tenor_months <= quote.max_tenor_months &&
                tenor_months <= config::max_tenor_months(),
            errors::invalid_tenor(),
        );
        assert!(amount > 0 && amount <= quote.max_principal, errors::profile_requirements_not_met());
    }

    public fun assert_collateral_request_allowed(
        user: address,
        profile_id: u8,
        amount: u64,
        tenor_months: u8,
        collateral_amount: u64,
    ) acquires ProfileRegistry {
        let quote = quote_profile(user, profile_id);

        assert!(quote.requires_collateral, errors::collateral_required());
        assert!(quote.current_lend_holdings >= quote.min_lend_holdings, errors::profile_requirements_not_met());
        assert!(
            tenor_months > 0 &&
                tenor_months <= quote.max_tenor_months &&
                tenor_months <= config::max_tenor_months(),
            errors::invalid_tenor(),
        );
        assert!(amount > 0 && amount <= quote.max_principal, errors::profile_requirements_not_met());
        assert!(
            collateral_amount >= required_collateral_for(profile_id, amount),
            errors::insufficient_collateral(),
        );
    }

    fun find_profile_index(registry: &ProfileRegistry, profile_id: u8): u64 {
        let len = vector::length(&registry.profiles);
        let i = 0;

        while (i < len) {
            if (vector::borrow(&registry.profiles, i).profile_id == profile_id) {
                return i
            };
            i = i + 1;
        };

        abort errors::invalid_policy()
    }

    fun find_profile_index_ref(registry: &ProfileRegistry, profile_id: u8): u64 {
        find_profile_index(registry, profile_id)
    }
}
