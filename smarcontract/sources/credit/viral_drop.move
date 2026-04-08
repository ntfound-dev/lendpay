module lendpay::viral_drop {
    use std::bcs;
    use std::event;
    use std::option;
    use std::signer;
    use std::string::{Self, String};
    use std::timestamp;
    use std::vector;
    use initia_std::bigdecimal;
    use initia_std::coin;
    use initia_std::hex;
    use initia_std::initia_nft::{Self, InitiaNft};
    use initia_std::object::{Self, ExtendRef, Object};
    use lendpay::assets;
    use lendpay::config;
    use lendpay::errors;
    use lendpay::loan_book;
    use lendpay::merchant_registry;
    use lendpay::treasury;

    const COLLECTION_NAME: vector<u8> = b"LendPay Viral Drops";
    const COLLECTION_DESCRIPTION: vector<u8> =
        b"Limited onchain drops with receipt-first delivery and unlockable collectibles";
    const COLLECTION_URI: vector<u8> = b"https://lendpay.app/viral-drops";
    const DELIVERY_CLAIM_ON_REPAY: u8 = 0;
    const DELIVERY_SECURED_INSTANT: u8 = 1;
    const INSTANT_DELIVERY_COLLATERAL_BPS: u64 = 15_000;

    struct DropItem has copy, drop, store {
        id: u64,
        name: String,
        uri: String,
        price: u64,
        active: bool,
    }

    struct DropPurchase has copy, drop, store {
        id: u64,
        item_id: u64,
        buyer: address,
        merchant_id: u64,
        amount_paid: u64,
        purchased_at: u64,
        receipt_object: address,
    }

    struct PurchaseDelivery has copy, drop, store {
        purchase_id: u64,
        loan_id: u64,
        delivery_mode: u8,
        collectible_claimed: bool,
        collectible_object: address,
        claimed_at: u64,
    }

    struct ViralDrop has key {
        next_item_id: u64,
        next_purchase_id: u64,
        payout_vault_ref: ExtendRef,
        items: vector<DropItem>,
        purchases: vector<DropPurchase>,
    }

    struct ViralDropDeliveryRegistry has key {
        deliveries: vector<PurchaseDelivery>,
    }

    #[event]
    struct DropPurchasedEvent has drop, store {
        purchase_id: u64,
        item_id: u64,
        buyer: address,
        merchant_id: u64,
        amount_paid: u64,
        receipt_object: address,
    }

    #[event]
    struct DropDeliveryAssignedEvent has drop, store {
        purchase_id: u64,
        loan_id: u64,
        delivery_mode: u8,
        collectible_claimed: bool,
        collectible_object: address,
    }

    #[event]
    struct DropCollectibleClaimedEvent has drop, store {
        purchase_id: u64,
        loan_id: u64,
        buyer: address,
        collectible_object: address,
    }

    public entry fun initialize(admin: &signer) {
        config::assert_admin(signer::address_of(admin));
        assert!(!exists<ViralDrop>(@lendpay), errors::already_initialized());

        let payout_vault_ref = assets::create_named_store(
            admin,
            b"viral_drop_payout_vault",
            config::loan_asset_metadata(),
        );
        let payout_signer = object::generate_signer_for_extending(&payout_vault_ref);
        initia_nft::create_collection(
            &payout_signer,
            string::utf8(COLLECTION_DESCRIPTION),
            option::none(),
            string::utf8(COLLECTION_NAME),
            string::utf8(COLLECTION_URI),
            false,
            false,
            false,
            false,
            false,
            bigdecimal::zero(),
        );

        let items = vector::empty<DropItem>();
        vector::push_back(
            &mut items,
            DropItem {
                id: 1,
                name: string::utf8(b"Initia OG Pass"),
                uri: string::utf8(b"https://lendpay.app/drops/initia-og-pass"),
                price: 100,
                active: true,
            },
        );
        vector::push_back(
            &mut items,
            DropItem {
                id: 2,
                name: string::utf8(b"Meme Capsule"),
                uri: string::utf8(b"https://lendpay.app/drops/meme-capsule"),
                price: 300,
                active: true,
            },
        );
        vector::push_back(
            &mut items,
            DropItem {
                id: 3,
                name: string::utf8(b"Alpha Circle Badge"),
                uri: string::utf8(b"https://lendpay.app/drops/alpha-circle-badge"),
                price: 500,
                active: true,
            },
        );

        move_to(admin, ViralDrop {
            next_item_id: 4,
            next_purchase_id: 1,
            payout_vault_ref,
            items,
            purchases: vector::empty(),
        });
    }

    public entry fun initialize_delivery_registry(admin: &signer) {
        config::assert_admin(signer::address_of(admin));
        assert!(!exists<ViralDropDeliveryRegistry>(@lendpay), errors::already_initialized());
        move_to(admin, ViralDropDeliveryRegistry {
            deliveries: vector::empty(),
        });
    }

    public entry fun add_item(
        admin: &signer,
        name: String,
        uri: String,
        price: u64,
    ) acquires ViralDrop {
        config::assert_admin(signer::address_of(admin));
        assert!(price > 0, errors::invalid_amount());

        let store = borrow_global_mut<ViralDrop>(@lendpay);
        let item_id = store.next_item_id;
        store.next_item_id = item_id + 1;
        vector::push_back(
            &mut store.items,
            DropItem {
                id: item_id,
                name,
                uri,
                price,
                active: true,
            },
        );
    }

    public entry fun set_item_active(
        admin: &signer,
        item_id: u64,
        active: bool,
    ) acquires ViralDrop {
        config::assert_admin(signer::address_of(admin));
        let store = borrow_global_mut<ViralDrop>(@lendpay);
        let item_index = find_item_index(store, item_id);
        vector::borrow_mut(&mut store.items, item_index).active = active;
    }

    public entry fun buy_item(
        buyer: &signer,
        merchant_id: u64,
        item_id: u64,
    ) acquires ViralDrop, ViralDropDeliveryRegistry {
        config::assert_not_paused();
        assert!(exists<ViralDropDeliveryRegistry>(@lendpay), errors::delivery_registry_not_initialized());
        assert!(merchant_registry::is_active(merchant_id), errors::merchant_not_active());

        let buyer_addr = signer::address_of(buyer);
        let loan_id = loan_book::active_loan_id_of(buyer_addr);
        assert!(loan_book::loan_borrower(loan_id) == buyer_addr, errors::not_borrower());
        assert!(loan_book::loan_is_active(loan_id), errors::loan_not_active());
        let store = borrow_global_mut<ViralDrop>(@lendpay);
        let payout_address = payout_vault_address_internal(store);
        assert!(
            merchant_registry::merchant_address(merchant_id) == payout_address,
            errors::merchant_destination_mismatch(),
        );

        let item_index = find_item_index(store, item_id);
        let item = *vector::borrow(&store.items, item_index);
        assert!(item.active, errors::item_not_active());

        let payment = coin::withdraw(buyer, treasury::loan_asset_metadata(), item.price);
        assets::deposit_to_store(&store.payout_vault_ref, payment);

        let payout_signer = object::generate_signer_for_extending(&store.payout_vault_ref);
        let purchase_id = store.next_purchase_id;
        store.next_purchase_id = purchase_id + 1;
        let delivery_mode =
            if (qualifies_for_secured_instant(loan_id, item.price)) DELIVERY_SECURED_INSTANT else DELIVERY_CLAIM_ON_REPAY;

        let (receipt_object, _) = initia_nft::mint_nft_object(
            &payout_signer,
            string::utf8(COLLECTION_NAME),
            receipt_description(item.name),
            receipt_token_id(purchase_id),
            item.uri,
            false,
        );
        let receipt_address = object::object_address(&receipt_object);
        object::transfer(&payout_signer, receipt_object, buyer_addr);

        let (collectible_claimed, collectible_object, claimed_at) =
            if (delivery_mode == DELIVERY_SECURED_INSTANT) {
                let (collectible_object, _) = initia_nft::mint_nft_object(
                    &payout_signer,
                    string::utf8(COLLECTION_NAME),
                    collectible_description(item.name),
                    collectible_token_id(purchase_id),
                    item.uri,
                    false,
                );
                let collectible_address = object::object_address(&collectible_object);
                object::transfer(&payout_signer, collectible_object, buyer_addr);
                (true, collectible_address, timestamp::now_seconds())
            } else {
                (false, @0x0, 0)
            };

        vector::push_back(
            &mut store.purchases,
            DropPurchase {
                id: purchase_id,
                item_id,
                buyer: buyer_addr,
                merchant_id,
                amount_paid: item.price,
                purchased_at: timestamp::now_seconds(),
                receipt_object: receipt_address,
            },
        );
        vector::push_back(
            &mut borrow_global_mut<ViralDropDeliveryRegistry>(@lendpay).deliveries,
            PurchaseDelivery {
                purchase_id,
                loan_id,
                delivery_mode,
                collectible_claimed,
                collectible_object,
                claimed_at,
            },
        );

        event::emit(DropPurchasedEvent {
            purchase_id,
            item_id,
            buyer: buyer_addr,
            merchant_id,
            amount_paid: item.price,
            receipt_object: receipt_address,
        });
        event::emit(DropDeliveryAssignedEvent {
            purchase_id,
            loan_id,
            delivery_mode,
            collectible_claimed,
            collectible_object,
        });
    }

    public entry fun claim_collectible(
        buyer: &signer,
        purchase_id: u64,
    ) acquires ViralDrop, ViralDropDeliveryRegistry {
        config::assert_not_paused();
        assert!(exists<ViralDropDeliveryRegistry>(@lendpay), errors::delivery_registry_not_initialized());

        let buyer_addr = signer::address_of(buyer);
        let purchase = get_purchase(purchase_id);
        assert!(purchase.buyer == buyer_addr, errors::not_borrower());

        let registry = borrow_global_mut<ViralDropDeliveryRegistry>(@lendpay);
        let delivery_index = find_delivery_index(registry, purchase_id);
        let delivery = vector::borrow_mut(&mut registry.deliveries, delivery_index);
        assert!(!delivery.collectible_claimed, errors::already_claimed());
        assert!(loan_book::loan_borrower(delivery.loan_id) == buyer_addr, errors::not_borrower());
        assert!(loan_book::loan_is_repaid(delivery.loan_id), errors::collectible_locked());

        let store = borrow_global<ViralDrop>(@lendpay);
        let item_index = find_item_index_ref(store, purchase.item_id);
        let item = *vector::borrow(&store.items, item_index);
        let payout_signer = object::generate_signer_for_extending(&store.payout_vault_ref);
        let (collectible_object, _) = initia_nft::mint_nft_object(
            &payout_signer,
            string::utf8(COLLECTION_NAME),
            collectible_description(item.name),
            collectible_token_id(purchase_id),
            item.uri,
            false,
        );
        let collectible_address = object::object_address(&collectible_object);
        object::transfer(&payout_signer, collectible_object, buyer_addr);

        delivery.collectible_claimed = true;
        delivery.collectible_object = collectible_address;
        delivery.claimed_at = timestamp::now_seconds();

        event::emit(DropCollectibleClaimedEvent {
            purchase_id,
            loan_id: delivery.loan_id,
            buyer: buyer_addr,
            collectible_object: collectible_address,
        });
    }

    #[view]
    public fun get_item(item_id: u64): DropItem acquires ViralDrop {
        let store = borrow_global<ViralDrop>(@lendpay);
        let item_index = find_item_index_ref(store, item_id);
        *vector::borrow(&store.items, item_index)
    }

    #[view]
    public fun get_purchase(purchase_id: u64): DropPurchase acquires ViralDrop {
        let store = borrow_global<ViralDrop>(@lendpay);
        let purchase_index = find_purchase_index_ref(store, purchase_id);
        *vector::borrow(&store.purchases, purchase_index)
    }

    #[view]
    public fun get_purchase_delivery(purchase_id: u64): PurchaseDelivery acquires ViralDropDeliveryRegistry {
        let registry = borrow_global<ViralDropDeliveryRegistry>(@lendpay);
        let delivery_index = find_delivery_index_ref(registry, purchase_id);
        *vector::borrow(&registry.deliveries, delivery_index)
    }

    #[view]
    public fun next_item_id(): u64 acquires ViralDrop {
        borrow_global<ViralDrop>(@lendpay).next_item_id
    }

    #[view]
    public fun next_purchase_id(): u64 acquires ViralDrop {
        borrow_global<ViralDrop>(@lendpay).next_purchase_id
    }

    #[view]
    public fun item_price(item_id: u64): u64 acquires ViralDrop {
        get_item(item_id).price
    }

    #[view]
    public fun purchase_amount_paid(purchase_id: u64): u64 acquires ViralDrop {
        get_purchase(purchase_id).amount_paid
    }

    #[view]
    public fun purchase_receipt_address(purchase_id: u64): address acquires ViralDrop {
        get_purchase(purchase_id).receipt_object
    }

    #[view]
    public fun purchase_loan_id(purchase_id: u64): u64 acquires ViralDropDeliveryRegistry {
        get_purchase_delivery(purchase_id).loan_id
    }

    #[view]
    public fun purchase_delivery_mode(purchase_id: u64): u8 acquires ViralDropDeliveryRegistry {
        get_purchase_delivery(purchase_id).delivery_mode
    }

    #[view]
    public fun purchase_collectible_claimed(purchase_id: u64): bool acquires ViralDropDeliveryRegistry {
        get_purchase_delivery(purchase_id).collectible_claimed
    }

    #[view]
    public fun purchase_collectible_address(purchase_id: u64): address acquires ViralDropDeliveryRegistry {
        get_purchase_delivery(purchase_id).collectible_object
    }

    #[view]
    public fun purchase_collectible_claimable(purchase_id: u64): bool acquires ViralDropDeliveryRegistry {
        let delivery = get_purchase_delivery(purchase_id);
        delivery.collectible_claimed || loan_book::loan_is_repaid(delivery.loan_id)
    }

    #[view]
    public fun purchase_claimed_at(purchase_id: u64): u64 acquires ViralDropDeliveryRegistry {
        get_purchase_delivery(purchase_id).claimed_at
    }

    #[view]
    public fun required_collateral_for_instant(item_id: u64): u64 acquires ViralDrop {
        required_collateral_amount(get_item(item_id).price)
    }

    #[view]
    public fun delivery_mode_claim_on_repay(): u8 {
        DELIVERY_CLAIM_ON_REPAY
    }

    #[view]
    public fun delivery_mode_secured_instant(): u8 {
        DELIVERY_SECURED_INSTANT
    }

    #[view]
    public fun purchase_buyer(purchase_id: u64): address acquires ViralDrop {
        get_purchase(purchase_id).buyer
    }

    #[view]
    public fun payout_vault_address(): address acquires ViralDrop {
        let store = borrow_global<ViralDrop>(@lendpay);
        payout_vault_address_internal(store)
    }

    #[view]
    public fun payout_balance(): u64 acquires ViralDrop {
        assets::balance_in_store(&borrow_global<ViralDrop>(@lendpay).payout_vault_ref)
    }

    #[view]
    public fun receipt_object(purchase_id: u64): Object<InitiaNft> acquires ViralDrop {
        object::address_to_object<InitiaNft>(purchase_receipt_address(purchase_id))
    }

    fun payout_vault_address_internal(store: &ViralDrop): address {
        assets::store_address_from_extend_ref(&store.payout_vault_ref)
    }

    fun receipt_description(item_name: String): String {
        let description = string::utf8(b"LendPay credit receipt: ");
        string::append(&mut description, item_name);
        description
    }

    fun receipt_token_id(purchase_id: u64): String {
        let token_id = string::utf8(b"receipt-");
        string::append(&mut token_id, hex::encode_to_string(&bcs::to_bytes(&purchase_id)));
        token_id
    }

    fun collectible_description(item_name: String): String {
        let description = string::utf8(b"LendPay viral drop collectible: ");
        string::append(&mut description, item_name);
        description
    }

    fun collectible_token_id(purchase_id: u64): String {
        let token_id = string::utf8(b"collectible-");
        string::append(&mut token_id, hex::encode_to_string(&bcs::to_bytes(&purchase_id)));
        token_id
    }

    fun required_collateral_amount(item_price: u64): u64 {
        ((item_price * INSTANT_DELIVERY_COLLATERAL_BPS) + 9_999) / 10_000
    }

    fun qualifies_for_secured_instant(loan_id: u64, item_price: u64): bool {
        let collateral_amount = loan_book::loan_collateral_amount(loan_id);
        collateral_amount >= required_collateral_amount(item_price)
    }

    fun find_item_index(store: &ViralDrop, item_id: u64): u64 {
        let len = vector::length(&store.items);
        let i = 0;

        while (i < len) {
            if (vector::borrow(&store.items, i).id == item_id) {
                return i
            };
            i = i + 1;
        };

        abort errors::item_not_found()
    }

    fun find_item_index_ref(store: &ViralDrop, item_id: u64): u64 {
        find_item_index(store, item_id)
    }

    fun find_purchase_index(store: &ViralDrop, purchase_id: u64): u64 {
        let len = vector::length(&store.purchases);
        let i = 0;

        while (i < len) {
            if (vector::borrow(&store.purchases, i).id == purchase_id) {
                return i
            };
            i = i + 1;
        };

        abort errors::purchase_not_found()
    }

    fun find_purchase_index_ref(store: &ViralDrop, purchase_id: u64): u64 {
        find_purchase_index(store, purchase_id)
    }

    fun find_delivery_index(registry: &ViralDropDeliveryRegistry, purchase_id: u64): u64 {
        let len = vector::length(&registry.deliveries);
        let i = 0;

        while (i < len) {
            if (vector::borrow(&registry.deliveries, i).purchase_id == purchase_id) {
                return i
            };
            i = i + 1;
        };

        abort errors::delivery_not_found()
    }

    fun find_delivery_index_ref(registry: &ViralDropDeliveryRegistry, purchase_id: u64): u64 {
        find_delivery_index(registry, purchase_id)
    }
}
