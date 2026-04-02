#[test_only]
module lendpay::tokenomics_tests {
    use std::signer;
    use lendpay::bootstrap;
    use lendpay::config;
    use lendpay::lend_token;
    use lendpay::test_support;
    use lendpay::tokenomics;

    #[test(admin = @lendpay, treasury_admin = @0x2)]
    fun tier_thresholds_follow_blueprint(admin: signer, treasury_admin: signer) {
        let loan_asset_metadata = test_support::ensure_loan_asset(&admin);
        bootstrap::initialize_protocol(
            &admin,
            signer::address_of(&treasury_admin),
            loan_asset_metadata,
        );

        assert!(config::bronze_min_lend() == 100, 300);
        assert!(config::silver_min_lend() == 500, 301);
        assert!(config::gold_min_lend() == 2_000, 302);
        assert!(config::diamond_min_lend() == 10_000, 303);
    }

    #[test(admin = @lendpay, treasury_admin = @0x2)]
    fun mint_and_tier_quote_are_consistent(admin: signer, treasury_admin: signer) {
        let loan_asset_metadata = test_support::ensure_loan_asset(&admin);
        bootstrap::initialize_protocol(
            &admin,
            signer::address_of(&treasury_admin),
            loan_asset_metadata,
        );

        lend_token::mint_to_protocol_reserve(&admin, 5_000);
        assert!(lend_token::protocol_inventory() == 5_000, 304);

        assert!(tokenomics::tier_fee_discount_bps(0) == 0, 305);
        assert!(tokenomics::tier_fee_discount_bps(100) == config::bronze_fee_discount_bps(), 306);
        assert!(tokenomics::next_tier_threshold(500) == config::gold_min_lend(), 307);
        let (treasury_bps, staking_bps, burn_bps) = tokenomics::fee_split_bps();
        assert!(treasury_bps == 4_000, 308);
        assert!(staking_bps == 3_000, 309);
        assert!(burn_bps == 3_000, 310);
    }
}
