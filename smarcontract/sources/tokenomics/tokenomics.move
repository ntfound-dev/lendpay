module lendpay::tokenomics {
    use lendpay::config;

    const TIER_NONE: u8 = 0;
    const TIER_BRONZE: u8 = 1;
    const TIER_SILVER: u8 = 2;
    const TIER_GOLD: u8 = 3;
    const TIER_DIAMOND: u8 = 4;

    const BRONZE_APR_DISCOUNT_BPS: u64 = 500;
    const SILVER_APR_DISCOUNT_BPS: u64 = 1_000;
    const GOLD_APR_DISCOUNT_BPS: u64 = 2_000;
    const DIAMOND_APR_DISCOUNT_BPS: u64 = 3_500;

    const BRONZE_LIMIT_MULTIPLIER_BPS: u64 = 10_000;
    const SILVER_LIMIT_MULTIPLIER_BPS: u64 = 10_000;
    const GOLD_LIMIT_MULTIPLIER_BPS: u64 = 15_000;
    const DIAMOND_LIMIT_MULTIPLIER_BPS: u64 = 20_000;

    const TREASURY_FEE_SPLIT_BPS: u64 = 4_000;
    const STAKING_FEE_SPLIT_BPS: u64 = 3_000;
    const BURN_FEE_SPLIT_BPS: u64 = 3_000;
    const LATE_FEE_BURN_SHARE_BPS: u64 = 5_000;

    const COMMUNITY_ALLOCATION_BPS: u64 = 3_000;
    const TREASURY_ALLOCATION_BPS: u64 = 2_000;
    const TEAM_ALLOCATION_BPS: u64 = 1_500;
    const BURN_RESERVE_ALLOCATION_BPS: u64 = 1_000;
    const INVESTOR_ALLOCATION_BPS: u64 = 1_500;
    const ECOSYSTEM_ALLOCATION_BPS: u64 = 1_000;

    struct TierQuote has copy, drop, store {
        tier: u8,
        fee_discount_bps: u64,
        apr_discount_bps: u64,
        limit_multiplier_bps: u64,
        next_threshold: u64,
        pay_fee_in_lend_discount_bps: u64,
    }

    #[view]
    public fun tier_for_lend_balance(lend_balance: u64): u8 {
        if (lend_balance >= config::diamond_min_lend()) {
            TIER_DIAMOND
        } else if (lend_balance >= config::gold_min_lend()) {
            TIER_GOLD
        } else if (lend_balance >= config::silver_min_lend()) {
            TIER_SILVER
        } else if (lend_balance >= config::bronze_min_lend()) {
            TIER_BRONZE
        } else {
            TIER_NONE
        }
    }

    #[view]
    public fun quote_for_lend_balance(lend_balance: u64): TierQuote {
        let tier = tier_for_lend_balance(lend_balance);

        if (tier == TIER_DIAMOND) {
            TierQuote {
                tier,
                fee_discount_bps: config::diamond_fee_discount_bps(),
                apr_discount_bps: DIAMOND_APR_DISCOUNT_BPS,
                limit_multiplier_bps: DIAMOND_LIMIT_MULTIPLIER_BPS,
                next_threshold: config::diamond_min_lend(),
                pay_fee_in_lend_discount_bps: config::pay_fee_in_lend_discount_bps(),
            }
        } else if (tier == TIER_GOLD) {
            TierQuote {
                tier,
                fee_discount_bps: config::gold_fee_discount_bps(),
                apr_discount_bps: GOLD_APR_DISCOUNT_BPS,
                limit_multiplier_bps: GOLD_LIMIT_MULTIPLIER_BPS,
                next_threshold: config::diamond_min_lend(),
                pay_fee_in_lend_discount_bps: config::pay_fee_in_lend_discount_bps(),
            }
        } else if (tier == TIER_SILVER) {
            TierQuote {
                tier,
                fee_discount_bps: config::silver_fee_discount_bps(),
                apr_discount_bps: SILVER_APR_DISCOUNT_BPS,
                limit_multiplier_bps: SILVER_LIMIT_MULTIPLIER_BPS,
                next_threshold: config::gold_min_lend(),
                pay_fee_in_lend_discount_bps: config::pay_fee_in_lend_discount_bps(),
            }
        } else if (tier == TIER_BRONZE) {
            TierQuote {
                tier,
                fee_discount_bps: config::bronze_fee_discount_bps(),
                apr_discount_bps: BRONZE_APR_DISCOUNT_BPS,
                limit_multiplier_bps: BRONZE_LIMIT_MULTIPLIER_BPS,
                next_threshold: config::silver_min_lend(),
                pay_fee_in_lend_discount_bps: config::pay_fee_in_lend_discount_bps(),
            }
        } else {
            TierQuote {
                tier,
                fee_discount_bps: 0,
                apr_discount_bps: 0,
                limit_multiplier_bps: 10_000,
                next_threshold: config::bronze_min_lend(),
                pay_fee_in_lend_discount_bps: config::pay_fee_in_lend_discount_bps(),
            }
        }
    }

    #[view]
    public fun point_conversion_quote(points: u64): u64 {
        (points * config::lend_per_point_bps()) / 10_000
    }

    #[view]
    public fun tier_fee_discount_bps(lend_balance: u64): u64 {
        let tier = tier_for_lend_balance(lend_balance);

        if (tier == TIER_DIAMOND) {
            config::diamond_fee_discount_bps()
        } else if (tier == TIER_GOLD) {
            config::gold_fee_discount_bps()
        } else if (tier == TIER_SILVER) {
            config::silver_fee_discount_bps()
        } else if (tier == TIER_BRONZE) {
            config::bronze_fee_discount_bps()
        } else {
            0
        }
    }

    #[view]
    public fun tier_apr_discount_bps(lend_balance: u64): u64 {
        let tier = tier_for_lend_balance(lend_balance);

        if (tier == TIER_DIAMOND) {
            DIAMOND_APR_DISCOUNT_BPS
        } else if (tier == TIER_GOLD) {
            GOLD_APR_DISCOUNT_BPS
        } else if (tier == TIER_SILVER) {
            SILVER_APR_DISCOUNT_BPS
        } else if (tier == TIER_BRONZE) {
            BRONZE_APR_DISCOUNT_BPS
        } else {
            0
        }
    }

    #[view]
    public fun tier_limit_multiplier_bps(lend_balance: u64): u64 {
        let tier = tier_for_lend_balance(lend_balance);

        if (tier == TIER_DIAMOND) {
            DIAMOND_LIMIT_MULTIPLIER_BPS
        } else if (tier == TIER_GOLD) {
            GOLD_LIMIT_MULTIPLIER_BPS
        } else if (tier == TIER_SILVER) {
            SILVER_LIMIT_MULTIPLIER_BPS
        } else if (tier == TIER_BRONZE) {
            BRONZE_LIMIT_MULTIPLIER_BPS
        } else {
            10_000
        }
    }

    #[view]
    public fun next_tier_threshold(lend_balance: u64): u64 {
        let tier = tier_for_lend_balance(lend_balance);

        if (tier == TIER_DIAMOND) {
            config::diamond_min_lend()
        } else if (tier == TIER_GOLD) {
            config::diamond_min_lend()
        } else if (tier == TIER_SILVER) {
            config::gold_min_lend()
        } else if (tier == TIER_BRONZE) {
            config::silver_min_lend()
        } else {
            config::bronze_min_lend()
        }
    }

    #[view]
    public fun pay_fee_in_lend_discount_bps(): u64 {
        config::pay_fee_in_lend_discount_bps()
    }

    #[view]
    public fun fee_split_bps(): (u64, u64, u64) {
        (TREASURY_FEE_SPLIT_BPS, STAKING_FEE_SPLIT_BPS, BURN_FEE_SPLIT_BPS)
    }

    #[view]
    public fun late_fee_burn_share_bps(): u64 {
        LATE_FEE_BURN_SHARE_BPS
    }

    #[view]
    public fun burn_for_full_repayment(loan_amount: u64): u64 {
        loan_amount / 200
    }

    #[view]
    public fun token_allocation_bps(): (u64, u64, u64, u64, u64, u64) {
        (
            COMMUNITY_ALLOCATION_BPS,
            TREASURY_ALLOCATION_BPS,
            TEAM_ALLOCATION_BPS,
            BURN_RESERVE_ALLOCATION_BPS,
            INVESTOR_ALLOCATION_BPS,
            ECOSYSTEM_ALLOCATION_BPS,
        )
    }
}
