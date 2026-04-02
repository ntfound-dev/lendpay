module lendpay::merchant_registry {
    use std::signer;
    use std::vector;
    use lendpay::config;
    use lendpay::errors;

    struct Merchant has copy, drop, store {
        id: u64,
        merchant_address: address,
        category_hash: vector<u8>,
        listing_fee_bps: u64,
        partner_fee_bps: u64,
        active: bool,
    }

    struct MerchantRegistry has key {
        next_merchant_id: u64,
        merchants: vector<Merchant>,
    }

    public entry fun initialize(admin: &signer) {
        config::assert_admin(signer::address_of(admin));
        assert!(!exists<MerchantRegistry>(@lendpay), errors::already_initialized());

        move_to(admin, MerchantRegistry {
            next_merchant_id: 1,
            merchants: vector::empty(),
        });
    }

    public entry fun register_merchant(
        admin: &signer,
        merchant_address: address,
        category_hash: vector<u8>,
        listing_fee_bps: u64,
        partner_fee_bps: u64,
    ) acquires MerchantRegistry {
        config::assert_admin(signer::address_of(admin));
        assert!(
            listing_fee_bps <= 10_000 && partner_fee_bps <= 10_000,
            errors::invalid_policy(),
        );

        let registry = borrow_global_mut<MerchantRegistry>(@lendpay);
        let merchant_id = registry.next_merchant_id;
        registry.next_merchant_id = merchant_id + 1;

        vector::push_back(
            &mut registry.merchants,
            Merchant {
                id: merchant_id,
                merchant_address,
                category_hash,
                listing_fee_bps,
                partner_fee_bps,
                active: true,
            },
        );
    }

    public entry fun set_active(
        admin: &signer,
        merchant_id: u64,
        active: bool,
    ) acquires MerchantRegistry {
        config::assert_admin(signer::address_of(admin));
        let registry = borrow_global_mut<MerchantRegistry>(@lendpay);
        let index = find_merchant_index(registry, merchant_id);
        vector::borrow_mut(&mut registry.merchants, index).active = active;
    }

    #[view]
    public fun get_merchant(merchant_id: u64): Merchant acquires MerchantRegistry {
        let registry = borrow_global<MerchantRegistry>(@lendpay);
        let index = find_merchant_index_ref(registry, merchant_id);
        *vector::borrow(&registry.merchants, index)
    }

    #[view]
    public fun next_merchant_id(): u64 acquires MerchantRegistry {
        borrow_global<MerchantRegistry>(@lendpay).next_merchant_id
    }

    #[view]
    public fun quote_partner_fee(merchant_id: u64, order_amount: u64): u64 acquires MerchantRegistry {
        let merchant = get_merchant(merchant_id);
        (order_amount * merchant.partner_fee_bps) / 10_000
    }

    fun find_merchant_index(registry: &MerchantRegistry, merchant_id: u64): u64 {
        let len = vector::length(&registry.merchants);
        let i = 0;

        while (i < len) {
            if (vector::borrow(&registry.merchants, i).id == merchant_id) {
                return i
            };
            i = i + 1;
        };

        abort errors::invalid_policy()
    }

    fun find_merchant_index_ref(registry: &MerchantRegistry, merchant_id: u64): u64 {
        find_merchant_index(registry, merchant_id)
    }
}
