#[test_only]
module lendpay::bridge_tests {
    use std::signer;
    use std::string;
    use lendpay::bootstrap;
    use lendpay::bridge;
    use lendpay::test_support;

    #[test(admin = @lendpay, treasury_admin = @0x2, borrower = @0x3)]
    fun borrower_can_open_and_cancel_bridge_intent(
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

        bridge::register_route(
            &admin,
            string::utf8(b"lendpay-4"),
            string::utf8(b"ulend"),
            string::utf8(b"mini-evm"),
            string::utf8(b"erc20/LEND"),
            bridge::transfer_method_ibc_hooks(),
            true,
            true,
            string::utf8(b"0xf108dc95...2F2321"),
            string::utf8(b"InitiaDEX"),
            string::utf8(b"LEND/INIT"),
            bridge::liquidity_status_live(),
            true,
            string::utf8(b"Initia MiniEVM route"),
        );

        bridge::open_bridge_intent(
            &borrower,
            1,
            250,
            string::utf8(b"0x1234567890abcdef1234567890abcdef12345678"),
        );

        assert!(bridge::route_count() == 1, 200);
        assert!(bridge::route_is_live(1), 201);
        assert!(bridge::route_is_sell_ready(1), 202);
        assert!(bridge::route_liquidity_status(1) == bridge::liquidity_status_live(), 203);
        assert!(bridge::intent_count() == 1, 202);
        assert!(bridge::intent_route_id(1) == 1, 204);
        assert!(bridge::intent_requester(1) == signer::address_of(&borrower), 205);
        assert!(bridge::intent_amount(1) == 250, 206);
        assert!(bridge::intent_status(1) == bridge::intent_status_pending(), 207);

        bridge::cancel_bridge_intent(&borrower, 1);

        assert!(bridge::intent_status(1) == bridge::intent_status_cancelled(), 208);
    }

    #[test(admin = @lendpay, treasury_admin = @0x2, borrower = @0x3)]
    fun admin_can_resolve_bridge_intent(
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

        bridge::register_route(
            &admin,
            string::utf8(b"lendpay-4"),
            string::utf8(b"ulend"),
            string::utf8(b"mini-evm"),
            string::utf8(b"erc20/LEND"),
            bridge::transfer_method_ibc_hooks(),
            true,
            true,
            string::utf8(b"0xf108dc95...2F2321"),
            string::utf8(b"InitiaDEX"),
            string::utf8(b"LEND/INIT"),
            bridge::liquidity_status_live(),
            true,
            string::utf8(b"Initia MiniEVM route"),
        );

        bridge::open_bridge_intent(
            &borrower,
            1,
            500,
            string::utf8(b"0xabcdefabcdefabcdefabcdefabcdefabcdefabcd"),
        );
        bridge::resolve_bridge_intent(
            &admin,
            1,
            true,
            string::utf8(b"bridge-tx-001"),
            string::utf8(b"Settled on destination"),
        );

        assert!(bridge::intent_status(1) == bridge::intent_status_completed(), 209);
        assert!(
            bridge::intent_settlement_reference(1) == string::utf8(b"bridge-tx-001"),
            210,
        );
    }

    #[test(admin = @lendpay, treasury_admin = @0x2, borrower = @0x3)]
    #[expected_failure(abort_code = 65, location = lendpay::bridge)]
    fun borrower_cannot_open_intent_for_preview_only_route(
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

        bridge::register_route(
            &admin,
            string::utf8(b"lendpay-4"),
            string::utf8(b"ulend"),
            string::utf8(b"mini-evm"),
            string::utf8(b"erc20/LEND"),
            bridge::transfer_method_ibc_hooks(),
            true,
            false,
            string::utf8(b""),
            string::utf8(b"Preview venue"),
            string::utf8(b""),
            bridge::liquidity_status_coming_soon(),
            false,
            string::utf8(b"Mapping not published yet"),
        );

        bridge::open_bridge_intent(
            &borrower,
            1,
            100,
            string::utf8(b"0xpreviewonly000000000000000000000000000001"),
        );
    }

    #[test(admin = @lendpay, treasury_admin = @0x2, borrower = @0x3)]
    fun admin_can_update_liquidity_metadata(
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

        let _borrower_addr = signer::address_of(&borrower);
        bridge::register_route(
            &admin,
            string::utf8(b"lendpay-4"),
            string::utf8(b"ulend"),
            string::utf8(b"mini-evm"),
            string::utf8(b"erc20/LEND"),
            bridge::transfer_method_ibc_hooks(),
            true,
            true,
            string::utf8(b"0xf108dc95...2F2321"),
            string::utf8(b"InitiaDEX"),
            string::utf8(b"LEND/INIT"),
            bridge::liquidity_status_coming_soon(),
            false,
            string::utf8(b"MiniEVM route pending venue activation"),
        );

        bridge::update_route_liquidity(
            &admin,
            1,
            string::utf8(b"InitiaDEX"),
            string::utf8(b"LEND/INIT main pool"),
            bridge::liquidity_status_live(),
            true,
        );

        assert!(bridge::route_liquidity_status(1) == bridge::liquidity_status_live(), 211);
        assert!(bridge::route_swap_enabled(1), 212);
        assert!(bridge::route_is_sell_ready(1), 213);
        assert!(
            bridge::route_pool_reference(1) == string::utf8(b"LEND/INIT main pool"),
            214,
        );
    }
}
