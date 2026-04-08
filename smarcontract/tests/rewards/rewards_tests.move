#[test_only]
module lendpay::rewards_tests {
    use lendpay::campaigns;
    use lendpay::config;
    use std::signer;
    use lendpay::bootstrap;
    use lendpay::lend_token;
    use lendpay::loan_book;
    use lendpay::reputation;
    use lendpay::rewards;
    use lendpay::staking;
    use lendpay::test_support;
    use lendpay::treasury;

    #[test(admin = @lendpay, treasury_admin = @0x2, borrower = @0x3)]
    fun claim_lend_moves_balance_to_wallet(admin: signer, treasury_admin: signer, borrower: signer) {
        let loan_asset_metadata = test_support::ensure_loan_asset(&admin);
        bootstrap::initialize_protocol(
            &admin,
            signer::address_of(&treasury_admin),
            loan_asset_metadata,
        );

        test_support::mint_loan_asset(&admin, signer::address_of(&admin), 10_000);
        test_support::mint_loan_asset(&admin, signer::address_of(&borrower), 2_000);
        treasury::deposit_liquidity(&admin, 10_000);
        lend_token::mint_to_protocol_reserve(&admin, 5_000);
        loan_book::request_loan(&borrower, 900, 3);
        loan_book::approve_request(&admin, 1, 1_200, 320, 3, 86_400);
        loan_book::repay_installment(&borrower, 1);
        let reward_reserve_before_claim = treasury::reward_reserve();

        rewards::claim_lend(&borrower);

        assert!(lend_token::balance_of(signer::address_of(&borrower)) > 0, 200);
        assert!(treasury::reward_reserve() < reward_reserve_before_claim, 201);
    }

    #[test(admin = @lendpay, treasury_admin = @0x2, borrower = @0x3)]
    fun points_can_unlock_premium_check(admin: signer, treasury_admin: signer, borrower: signer) {
        let loan_asset_metadata = test_support::ensure_loan_asset(&admin);
        bootstrap::initialize_protocol(
            &admin,
            signer::address_of(&treasury_admin),
            loan_asset_metadata,
        );

        test_support::mint_loan_asset(&admin, signer::address_of(&admin), 10_000);
        test_support::mint_loan_asset(&admin, signer::address_of(&borrower), 2_000);
        treasury::deposit_liquidity(&admin, 10_000);
        loan_book::request_loan(&borrower, 900, 3);
        loan_book::approve_request(&admin, 1, 1_200, 320, 3, 86_400);
        loan_book::repay_installment(&borrower, 1);

        rewards::unlock_premium_credit_check(&borrower);

        assert!(rewards::premium_checks_available_of(signer::address_of(&borrower)) == 1, 201);
    }

    #[test(admin = @lendpay, treasury_admin = @0x2, borrower = @0x3)]
    fun claimed_lend_can_be_staked_and_unstaked(admin: signer, treasury_admin: signer, borrower: signer) {
        let loan_asset_metadata = test_support::ensure_loan_asset(&admin);
        bootstrap::initialize_protocol(
            &admin,
            signer::address_of(&treasury_admin),
            loan_asset_metadata,
        );

        test_support::mint_loan_asset(&admin, signer::address_of(&admin), 10_000);
        test_support::mint_loan_asset(&admin, signer::address_of(&borrower), 2_000);
        treasury::deposit_liquidity(&admin, 10_000);
        lend_token::mint_to_protocol_reserve(&admin, 5_000);
        loan_book::request_loan(&borrower, 900, 1);
        loan_book::approve_request(&admin, 1, 1_200, 960, 1, 86_400);
        loan_book::repay_installment(&borrower, 1);
        rewards::claim_lend(&borrower);

        let user_addr = signer::address_of(&borrower);
        let claim_amount = lend_token::balance_of(user_addr);
        let stake_amount = claim_amount / 2;

        staking::stake(&borrower, stake_amount);
        assert!(lend_token::staked_balance_of(user_addr) == stake_amount, 202);
        assert!(lend_token::staked_inventory() == stake_amount, 203);

        staking::unstake(&borrower, stake_amount);
        assert!(lend_token::staked_balance_of(user_addr) == 0, 204);
    }

    #[test(admin = @lendpay, treasury_admin = @0x2, borrower = @0x3)]
    #[expected_failure(abort_code = 41, location = lendpay::campaigns)]
    fun username_gated_campaign_requires_attestation(
        admin: signer,
        treasury_admin: signer,
        borrower: signer,
    ) {
        let loan_asset_metadata = test_support::ensure_loan_asset(&admin);
        bootstrap::initialize_protocol(
            &admin,
            signer::address_of(&treasury_admin),
            loan_asset_metadata,
        );

        lend_token::mint_to_protocol_reserve(&admin, 500);
        campaigns::create_campaign(&admin, 1, 200, true, 0);
        campaigns::allocate_claim(&admin, 1, signer::address_of(&borrower), 100);

        campaigns::claim_campaign(&borrower, 1);
    }

    #[test(admin = @lendpay, treasury_admin = @0x2, borrower = @0x3)]
    fun campaign_claim_unlocks_after_username_and_activity(
        admin: signer,
        treasury_admin: signer,
        borrower: signer,
    ) {
        let loan_asset_metadata = test_support::ensure_loan_asset(&admin);
        bootstrap::initialize_protocol(
            &admin,
            signer::address_of(&treasury_admin),
            loan_asset_metadata,
        );

        lend_token::mint_to_protocol_reserve(&admin, 500);
        campaigns::create_campaign(&admin, 1, 200, true, 1);
        campaigns::allocate_claim(&admin, 1, signer::address_of(&borrower), 100);

        let borrower_addr = signer::address_of(&borrower);
        reputation::attest_username(&admin, borrower_addr, b"borrower.init");
        assert!(!campaigns::can_claim(borrower_addr, 1), 205);

        loan_book::request_loan(&borrower, 150, 1);
        assert!(campaigns::can_claim(borrower_addr, 1), 206);

        campaigns::claim_campaign(&borrower, 1);

        assert!(lend_token::balance_of(borrower_addr) == 100, 207);
        assert!(campaigns::claimable_amount(1, borrower_addr) == 0, 208);
    }

    #[test(admin = @lendpay, treasury_admin = @0x2, borrower = @0x3)]
    #[expected_failure(abort_code = 62, location = lendpay::campaigns)]
    fun duplicate_unclaimed_campaign_allocation_is_rejected(
        admin: signer,
        treasury_admin: signer,
        borrower: signer,
    ) {
        let loan_asset_metadata = test_support::ensure_loan_asset(&admin);
        bootstrap::initialize_protocol(
            &admin,
            signer::address_of(&treasury_admin),
            loan_asset_metadata,
        );

        let borrower_addr = signer::address_of(&borrower);
        lend_token::mint_to_protocol_reserve(&admin, 1_000);
        campaigns::create_campaign(&admin, 1, 400, false, 0);
        campaigns::allocate_claim(&admin, 1, borrower_addr, 100);
        campaigns::allocate_claim(&admin, 1, borrower_addr, 150);
    }

    #[test(admin = @lendpay, treasury_admin = @0x2, borrower = @0x3)]
    #[expected_failure(abort_code = 21, location = lendpay::rewards)]
    fun limit_boost_cannot_exceed_global_cap(admin: signer, treasury_admin: signer, borrower: signer) {
        let loan_asset_metadata = test_support::ensure_loan_asset(&admin);
        bootstrap::initialize_protocol(
            &admin,
            signer::address_of(&treasury_admin),
            loan_asset_metadata,
        );

        config::update_point_spend_policy(
            &admin,
            1,
            config::max_total_credit_limit_boost_bps(),
            1,
            200,
            1_000,
        );

        loan_book::request_loan(&borrower, 150, 1);
        rewards::spend_points_for_limit_boost(&borrower);
        assert!(
            rewards::credit_limit_boost_bps_of(signer::address_of(&borrower)) ==
                config::max_total_credit_limit_boost_bps(),
            209,
        );

        rewards::spend_points_for_limit_boost(&borrower);
    }
}
