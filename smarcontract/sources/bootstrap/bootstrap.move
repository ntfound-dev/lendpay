module lendpay::bootstrap {
    use lendpay::campaigns;
    use lendpay::config;
    use lendpay::fee_engine;
    use lendpay::governance;
    use lendpay::lend_token;
    use lendpay::loan_book;
    use lendpay::merchant_registry;
    use lendpay::profiles;
    use lendpay::reputation;
    use lendpay::rewards;
    use lendpay::staking;
    use lendpay::treasury;

    public entry fun initialize_protocol(
        admin: &signer,
        treasury_admin: address,
        loan_asset_metadata: address,
    ) {
        lend_token::initialize(admin);
        config::initialize(admin, treasury_admin, loan_asset_metadata, lend_token::metadata_address());
        treasury::initialize(admin);
        fee_engine::initialize(admin);
        staking::initialize(admin);
        governance::initialize(admin);
        profiles::initialize(admin);
        merchant_registry::initialize(admin);
        reputation::initialize(admin);
        rewards::initialize(admin);
        campaigns::initialize(admin);
        loan_book::initialize(admin);
    }
}
