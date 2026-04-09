module lendpay::bootstrap {
    use lendpay::bridge;
    use lendpay::campaigns;
    use lendpay::config;
    use lendpay::fee_engine;
    use lendpay::governance;
    use lendpay::lend_token;
    use lendpay::loan_book;
    use lendpay::merchant_registry;
    use lendpay::mock_cabal;
    use lendpay::mock_intergaze;
    use lendpay::mock_yominet;
    use lendpay::profiles;
    use lendpay::referral;
    use lendpay::reputation;
    use lendpay::rewards;
    use lendpay::staking;
    use lendpay::treasury;
    use lendpay::viral_drop;

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
        bridge::initialize(admin);
        mock_cabal::initialize(admin);
        mock_yominet::initialize(admin);
        mock_intergaze::initialize(admin);
        viral_drop::initialize(admin);
        viral_drop::initialize_delivery_registry(admin);
        reputation::initialize(admin);
        rewards::initialize(admin);
        referral::initialize(admin);
        campaigns::initialize(admin);
        loan_book::initialize(admin);
    }
}
