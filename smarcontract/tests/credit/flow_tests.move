#[test_only]
module lendpay::credit_flow_tests {
    use lendpay::campaigns;
    use std::signer;
    use lendpay::bootstrap;
    use lendpay::config;
    use lendpay::loan_book;
    use lendpay::profiles;
    use lendpay::rewards;
    use lendpay::test_support;
    use lendpay::treasury;
    use lendpay::lend_token;

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
}
