module lendpay::assets {
    use initia_std::fungible_asset::{Self, FungibleAsset, FungibleStore, Metadata};
    use initia_std::object::{Self, ExtendRef, Object};

    public fun metadata_from_address(metadata_address: address): Object<Metadata> {
        object::address_to_object<Metadata>(metadata_address)
    }

    public fun create_named_store(
        creator: &signer,
        seed: vector<u8>,
        metadata_address: address,
    ): ExtendRef {
        let constructor_ref = object::create_named_object(creator, seed);
        let transfer_ref = object::generate_transfer_ref(&constructor_ref);
        object::disable_ungated_transfer(&transfer_ref);
        let metadata = metadata_from_address(metadata_address);
        let _store = fungible_asset::create_store(&constructor_ref, metadata);
        object::generate_extend_ref(&constructor_ref)
    }

    public fun store_from_extend_ref(extend_ref: &ExtendRef): Object<FungibleStore> {
        object::address_to_object<FungibleStore>(object::address_from_extend_ref(extend_ref))
    }

    public fun store_address_from_extend_ref(extend_ref: &ExtendRef): address {
        object::address_from_extend_ref(extend_ref)
    }

    public fun balance_in_store(extend_ref: &ExtendRef): u64 {
        fungible_asset::balance(store_from_extend_ref(extend_ref))
    }

    public fun deposit_to_store(
        extend_ref: &ExtendRef,
        asset: FungibleAsset,
    ) {
        fungible_asset::deposit(store_from_extend_ref(extend_ref), asset);
    }

    public fun withdraw_from_store(
        extend_ref: &ExtendRef,
        amount: u64,
    ): FungibleAsset {
        let store_signer = object::generate_signer_for_extending(extend_ref);
        fungible_asset::withdraw(&store_signer, store_from_extend_ref(extend_ref), amount)
    }
}
