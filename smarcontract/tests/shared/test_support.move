#[test_only]
module lendpay::test_support {
    use std::option;
    use std::signer;
    use std::string;
    use initia_std::coin;
    use initia_std::managed_coin;
    use initia_std::primary_fungible_store;

    const LOAN_ASSET_NAME: vector<u8> = b"LendPay Loan Dollar";
    const LOAN_ASSET_SYMBOL: vector<u8> = b"USDL";

    public fun ensure_loan_asset(admin: &signer): address {
        primary_fungible_store::init_module_for_test();

        if (!coin::is_coin_by_symbol(signer::address_of(admin), string::utf8(LOAN_ASSET_SYMBOL))) {
            managed_coin::initialize(
                admin,
                option::none(),
                string::utf8(LOAN_ASSET_NAME),
                string::utf8(LOAN_ASSET_SYMBOL),
                6,
                string::utf8(b""),
                string::utf8(b""),
            );
        };

        coin::metadata_address(signer::address_of(admin), string::utf8(LOAN_ASSET_SYMBOL))
    }

    public fun mint_loan_asset(admin: &signer, recipient: address, amount: u64) {
        let metadata = coin::metadata(signer::address_of(admin), string::utf8(LOAN_ASSET_SYMBOL));
        managed_coin::mint_to(admin, recipient, metadata, amount);
    }
}
