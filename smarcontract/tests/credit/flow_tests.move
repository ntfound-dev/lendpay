#[test_only]
module lendpay::credit_flow_tests {
    use lendpay::campaigns;
    use initia_std::coin;
    use initia_std::initia_nft;
    use initia_std::object;
    use std::signer;
    use lendpay::bootstrap;
    use lendpay::config;
    use lendpay::lend_token;
    use lendpay::loan_book;
    use lendpay::merchant_registry;
    use lendpay::mock_cabal;
    use lendpay::mock_intergaze;
    use lendpay::mock_yominet;
    use lendpay::profiles;
    use lendpay::referral;
    use lendpay::rewards;
    use lendpay::test_support;
    use lendpay::treasury;
    use lendpay::viral_drop;

    #[test(admin = @lendpay, treasury_admin = @0x2, borrower = @0x3)]
    fun request_flow_updates_points(admin: signer, treasury_admin: signer, borrower: signer) {
        let loan_asset_metadata = test_support::ensure_loan_asset(&admin);
        bootstrap::initialize_protocol(
            &admin,
            signer::address_of(&treasury_admin),
            loan_asset_metadata,
        );

        test_support::mint_loan_asset(&admin, signer::address_of(&admin), 10_000);
        treasury::deposit_liquidity(&admin, 10_000);
        loan_book::request_loan(&borrower, 500, 3);

        assert!(loan_book::next_request_id() == 2, 100);
        assert!(rewards::points_balance_of(signer::address_of(&borrower)) == config::request_points(), 101);
    }

    #[test(admin = @lendpay, treasury_admin = @0x2, borrower = @0x3)]
    fun approval_and_repayment_progression(admin: signer, treasury_admin: signer, borrower: signer) {
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

        assert!(loan_book::next_loan_id() == 2, 102);
        assert!(treasury::total_disbursed() == 900, 103);
        assert!(treasury::total_repaid() == 320, 104);
        assert!(rewards::points_balance_of(signer::address_of(&borrower)) >= 350, 105);
    }

    #[test(admin = @lendpay, treasury_admin = @0x2, borrower = @0x3)]
    fun profiled_request_uses_holdings_and_limit_boost(
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

        config::update_point_spend_policy(&admin, 100, 500, 300, 200, 1_000);
        lend_token::mint_to_protocol_reserve(&admin, 500);
        campaigns::create_campaign(&admin, 1, 200, false, 0);
        campaigns::allocate_claim(&admin, 1, signer::address_of(&borrower), 100);
        campaigns::claim_campaign(&borrower, 1);

        loan_book::request_loan(&borrower, 150, 1);
        rewards::spend_points_for_limit_boost(&borrower);

        let borrower_addr = signer::address_of(&borrower);
        assert!(lend_token::total_balance_of(borrower_addr) == 100, 106);
        assert!(rewards::credit_limit_boost_bps_of(borrower_addr) == 500, 107);
        assert!(profiles::max_principal_for(borrower_addr, 2) == 2_625, 108);

        loan_book::request_profiled_loan(&borrower, 2, 2_600, 6);

        assert!(loan_book::next_request_id() == 3, 109);
        assert!(loan_book::request_profile_id(2) == 2, 110);
    }

    #[test(admin = @lendpay, treasury_admin = @0x2, borrower = @0x3)]
    fun collateralized_loan_unlocks_lend_after_full_repayment(
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

        test_support::mint_loan_asset(&admin, signer::address_of(&admin), 10_000);
        treasury::deposit_liquidity(&admin, 10_000);
        lend_token::mint_to_protocol_reserve(&admin, 5_000);
        campaigns::create_campaign(&admin, 1, 3_000, false, 0);
        campaigns::allocate_claim(&admin, 1, signer::address_of(&borrower), 2_000);
        campaigns::claim_campaign(&borrower, 1);

        let borrower_addr = signer::address_of(&borrower);
        loan_book::request_collateralized_loan(&borrower, 4, 900, 1_350, 3);
        assert!(loan_book::request_collateral_amount(1) == 1_350, 111);
        assert!(treasury::collateral_balance() == 1_350, 112);
        assert!(loan_book::locked_collateral_of(borrower_addr) == 1_350, 113);

        loan_book::approve_request(&admin, 1, 1_200, 300, 3, 86_400);
        loan_book::repay_installment(&borrower, 1);
        loan_book::repay_installment(&borrower, 1);
        loan_book::repay_installment(&borrower, 1);

        assert!(loan_book::loan_collateral_amount(1) == 1_350, 114);
        assert!(loan_book::loan_collateral_state(1) == 2, 115);
        assert!(treasury::collateral_balance() == 0, 116);
        assert!(treasury::total_collateral_released() == 1_350, 117);
        assert!(loan_book::locked_collateral_of(borrower_addr) == 0, 118);
        assert!(lend_token::balance_of(borrower_addr) == 2_000, 119);
    }

    #[test(admin = @lendpay, treasury_admin = @0x2, borrower = @0x3)]
    fun collateralized_default_liquidates_lend(
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

        test_support::mint_loan_asset(&admin, signer::address_of(&admin), 10_000);
        treasury::deposit_liquidity(&admin, 10_000);
        lend_token::mint_to_protocol_reserve(&admin, 5_000);
        campaigns::create_campaign(&admin, 1, 2_000, false, 0);
        campaigns::allocate_claim(&admin, 1, signer::address_of(&borrower), 1_000);
        campaigns::claim_campaign(&borrower, 1);

        let borrower_addr = signer::address_of(&borrower);
        loan_book::request_collateralized_loan(&borrower, 4, 500, 750, 1);
        loan_book::approve_request(&admin, 1, 0, 500, 1, 0);
        loan_book::force_loan_due_for_testing(&admin, 1);
        loan_book::mark_default(&admin, 1);

        assert!(loan_book::loan_collateral_state(1) == 3, 120);
        assert!(treasury::collateral_balance() == 0, 121);
        assert!(treasury::seized_collateral_balance() == 750, 122);
        assert!(treasury::total_collateral_liquidated() == 750, 123);
        assert!(loan_book::locked_collateral_of(borrower_addr) == 0, 124);
        assert!(lend_token::balance_of(borrower_addr) == 250, 125);
    }

    #[test(admin = @lendpay, treasury_admin = @0x2, borrower = @0x3)]
    fun approved_funds_can_be_spent_on_viral_drop(
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

        test_support::mint_loan_asset(&admin, signer::address_of(&admin), 10_000);
        treasury::deposit_liquidity(&admin, 10_000);
        merchant_registry::register_merchant(
            &admin,
            viral_drop::payout_vault_address(),
            x"706172746e65725f617070",
            0,
            0,
        );

        let borrower_addr = signer::address_of(&borrower);
        loan_book::request_loan(&borrower, 300, 3);
        loan_book::approve_request(&admin, 1, 1_200, 100, 3, 86_400);

        assert!(coin::balance(borrower_addr, treasury::loan_asset_metadata()) == 300, 126);

        viral_drop::buy_item(&borrower, 1, 2);

        assert!(coin::balance(borrower_addr, treasury::loan_asset_metadata()) == 0, 127);
        assert!(viral_drop::payout_balance() == 300, 128);
        assert!(viral_drop::purchase_amount_paid(1) == 300, 129);
        assert!(viral_drop::purchase_buyer(1) == borrower_addr, 130);
        assert!(viral_drop::purchase_loan_id(1) == 1, 131);
        assert!(viral_drop::purchase_delivery_mode(1) == viral_drop::delivery_mode_claim_on_repay(), 132);
        assert!(!viral_drop::purchase_collectible_claimed(1), 133);
        assert!(!viral_drop::purchase_collectible_claimable(1), 134);
        assert!(viral_drop::purchase_collectible_address(1) == @0x0, 135);

        let receipt =
            object::address_to_object<initia_nft::InitiaNft>(viral_drop::purchase_receipt_address(1));
        assert!(object::owns(receipt, borrower_addr), 136);

        test_support::mint_loan_asset(&admin, borrower_addr, 500);
        loan_book::repay_installment(&borrower, 1);
        loan_book::repay_installment(&borrower, 1);
        loan_book::repay_installment(&borrower, 1);
        viral_drop::claim_collectible(&borrower, 1);

        assert!(treasury::total_repaid() == 300, 137);
        assert!(viral_drop::purchase_collectible_claimed(1), 138);
        assert!(viral_drop::purchase_collectible_claimable(1), 139);
        let collectible =
            object::address_to_object<initia_nft::InitiaNft>(viral_drop::purchase_collectible_address(1));
        assert!(object::owns(collectible, borrower_addr), 140);
        assert!(rewards::points_balance_of(borrower_addr) >= 150, 141);
    }

    #[test(admin = @lendpay, treasury_admin = @0x2, borrower = @0x3)]
    fun collateralized_viral_drop_unlocks_collectible_instantly(
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

        test_support::mint_loan_asset(&admin, signer::address_of(&admin), 10_000);
        treasury::deposit_liquidity(&admin, 10_000);
        lend_token::mint_to_protocol_reserve(&admin, 5_000);
        campaigns::create_campaign(&admin, 1, 2_000, false, 0);
        campaigns::allocate_claim(&admin, 1, signer::address_of(&borrower), 1_000);
        campaigns::claim_campaign(&borrower, 1);
        merchant_registry::register_merchant(
            &admin,
            viral_drop::payout_vault_address(),
            x"706172746e65725f617070",
            0,
            0,
        );

        let borrower_addr = signer::address_of(&borrower);
        loan_book::request_collateralized_loan(&borrower, 4, 300, 450, 3);
        loan_book::approve_request(&admin, 1, 1_200, 100, 3, 86_400);

        viral_drop::buy_item(&borrower, 1, 2);

        assert!(viral_drop::purchase_delivery_mode(1) == viral_drop::delivery_mode_secured_instant(), 142);
        assert!(viral_drop::purchase_collectible_claimed(1), 143);
        let collectible =
            object::address_to_object<initia_nft::InitiaNft>(viral_drop::purchase_collectible_address(1));
        assert!(object::owns(collectible, borrower_addr), 144);
    }

    #[test(admin = @lendpay, treasury_admin = @0x2, borrower = @0x3)]
    #[expected_failure(abort_code = 57, location = lendpay::viral_drop)]
    fun unsecured_viral_drop_collectible_stays_locked_until_repayment(
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

        test_support::mint_loan_asset(&admin, signer::address_of(&admin), 10_000);
        treasury::deposit_liquidity(&admin, 10_000);
        merchant_registry::register_merchant(
            &admin,
            viral_drop::payout_vault_address(),
            x"706172746e65725f617070",
            0,
            0,
        );

        loan_book::request_loan(&borrower, 300, 3);
        loan_book::approve_request(&admin, 1, 1_200, 100, 3, 86_400);
        viral_drop::buy_item(&borrower, 1, 2);
        viral_drop::claim_collectible(&borrower, 1);
    }

    #[test(admin = @lendpay, treasury_admin = @0x2, borrower = @0x3)]
    fun approved_funds_can_be_deposited_into_mock_cabal(
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

        test_support::mint_loan_asset(&admin, signer::address_of(&admin), 10_000);
        treasury::deposit_liquidity(&admin, 10_000);
        merchant_registry::register_merchant(
            &admin,
            mock_cabal::payout_vault_address(),
            x"64656669",
            0,
            0,
        );

        let borrower_addr = signer::address_of(&borrower);
        loan_book::request_loan(&borrower, 220, 3);
        loan_book::approve_request(&admin, 1, 900, 90, 3, 86_400);

        mock_cabal::deposit(&borrower, 1, 1, 220);

        assert!(coin::balance(borrower_addr, treasury::loan_asset_metadata()) == 0, 138);
        assert!(mock_cabal::payout_balance() == 220, 139);
        assert!(mock_cabal::position_expected_yield(1) == 26, 140);
        assert!(mock_cabal::position_owner(1) == borrower_addr, 141);
    }

    #[test(admin = @lendpay, treasury_admin = @0x2, borrower = @0x3)]
    fun approved_funds_can_be_spent_on_mock_yominet(
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

        test_support::mint_loan_asset(&admin, signer::address_of(&admin), 10_000);
        treasury::deposit_liquidity(&admin, 10_000);
        merchant_registry::register_merchant(
            &admin,
            mock_yominet::payout_vault_address(),
            x"67616d696e67",
            0,
            0,
        );

        let borrower_addr = signer::address_of(&borrower);
        loan_book::request_loan(&borrower, 340, 3);
        loan_book::approve_request(&admin, 1, 900, 120, 3, 86_400);

        mock_yominet::buy_item(&borrower, 1, 2);

        assert!(coin::balance(borrower_addr, treasury::loan_asset_metadata()) == 0, 142);
        assert!(mock_yominet::payout_balance() == 340, 143);
        assert!(mock_yominet::purchase_amount_paid(1) == 340, 144);
        assert!(mock_yominet::purchase_buyer(1) == borrower_addr, 145);

        let receipt =
            object::address_to_object<initia_nft::InitiaNft>(mock_yominet::purchase_receipt_address(1));
        assert!(object::owns(receipt, borrower_addr), 146);
    }

    #[test(admin = @lendpay, treasury_admin = @0x2, borrower = @0x3)]
    fun approved_funds_can_be_spent_on_mock_intergaze(
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

        test_support::mint_loan_asset(&admin, signer::address_of(&admin), 10_000);
        treasury::deposit_liquidity(&admin, 10_000);
        merchant_registry::register_merchant(
            &admin,
            mock_intergaze::payout_vault_address(),
            x"6e6674",
            0,
            0,
        );

        let borrower_addr = signer::address_of(&borrower);
        loan_book::request_loan(&borrower, 320, 3);
        loan_book::approve_request(&admin, 1, 900, 120, 3, 86_400);

        mock_intergaze::buy_item(&borrower, 1, 2);

        assert!(coin::balance(borrower_addr, treasury::loan_asset_metadata()) == 0, 147);
        assert!(mock_intergaze::payout_balance() == 320, 148);
        assert!(mock_intergaze::purchase_amount_paid(1) == 320, 149);
        assert!(mock_intergaze::purchase_buyer(1) == borrower_addr, 150);

        let receipt =
            object::address_to_object<initia_nft::InitiaNft>(mock_intergaze::purchase_receipt_address(1));
        assert!(object::owns(receipt, borrower_addr), 151);
    }

    #[test(admin = @lendpay, treasury_admin = @0x2, referrer = @0x3, referee = @0x4)]
    fun referral_rewards_follow_credit_health(
        admin: signer,
        treasury_admin: signer,
        referrer: signer,
        referee: signer,
    ) {
        let loan_asset_metadata = test_support::ensure_loan_asset(&admin);
        bootstrap::initialize_protocol(
            &admin,
            signer::address_of(&treasury_admin),
            loan_asset_metadata,
        );

        test_support::mint_loan_asset(&admin, signer::address_of(&admin), 10_000);
        test_support::mint_loan_asset(&admin, signer::address_of(&referee), 1_000);
        treasury::deposit_liquidity(&admin, 10_000);

        referral::generate_code(&referrer);
        let code = referral::get_referral_code(signer::address_of(&referrer));
        referral::apply_code(&referee, code);

        loan_book::request_loan(&referee, 500, 3);
        loan_book::approve_request(&admin, 1, 900, 170, 3, 86_400);
        loan_book::repay_installment(&referee, 1);

        let (total_referrals, active_referrals, points_earned) =
            referral::get_referral_stats(signer::address_of(&referrer));

        assert!(total_referrals == 1, 134);
        assert!(active_referrals == 1, 135);
        assert!(points_earned == 70, 136);
        assert!(rewards::points_balance_of(signer::address_of(&referrer)) == 70, 137);
    }
}
