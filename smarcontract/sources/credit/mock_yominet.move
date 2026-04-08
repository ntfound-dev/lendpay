module lendpay::mock_yominet {
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
    use lendpay::merchant_registry;
    use lendpay::treasury;

    const COLLECTION_NAME: vector<u8> = b"LendPay Yominet Mock";
    const COLLECTION_DESCRIPTION: vector<u8> =
        b"Playable mock items and Kamigotchi-style collectibles unlocked with LendPay credit";
    const COLLECTION_URI: vector<u8> = b"https://lendpay.app/apps/yominet";

    struct GameItem has copy, drop, store {
        id: u64,
        name: String,
        uri: String,
        price: u64,
        active: bool,
    }

    struct Purchase has copy, drop, store {
        id: u64,
        item_id: u64,
        buyer: address,
        merchant_id: u64,
        amount_paid: u64,
        purchased_at: u64,
        receipt_object: address,
    }

    struct MockYominet has key {
        next_item_id: u64,
        next_purchase_id: u64,
        payout_vault_ref: ExtendRef,
        items: vector<GameItem>,
        purchases: vector<Purchase>,
    }

    #[event]
    struct ItemPurchasedEvent has drop, store {
        purchase_id: u64,
        item_id: u64,
        buyer: address,
        merchant_id: u64,
        amount_paid: u64,
        receipt_object: address,
    }

    public entry fun initialize(admin: &signer) {
        config::assert_admin(signer::address_of(admin));
        assert!(!exists<MockYominet>(@lendpay), errors::already_initialized());

        let payout_vault_ref = assets::create_named_store(
            admin,
            b"mock_yominet_payout_vault",
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

        let items = vector::empty<GameItem>();
        vector::push_back(
            &mut items,
            GameItem {
                id: 1,
                name: string::utf8(b"Kamigotchi Egg"),
                uri: string::utf8(b"https://lendpay.app/yominet/kamigotchi-egg"),
                price: 220,
                active: true,
            },
        );
        vector::push_back(
            &mut items,
            GameItem {
                id: 2,
                name: string::utf8(b"Arena Starter Pack"),
                uri: string::utf8(b"https://lendpay.app/yominet/arena-starter-pack"),
                price: 340,
                active: true,
            },
        );
        vector::push_back(
            &mut items,
            GameItem {
                id: 3,
                name: string::utf8(b"Guild Access Pass"),
                uri: string::utf8(b"https://lendpay.app/yominet/guild-access-pass"),
                price: 480,
                active: true,
            },
        );

        move_to(admin, MockYominet {
            next_item_id: 4,
            next_purchase_id: 1,
            payout_vault_ref,
            items,
            purchases: vector::empty(),
        });
    }

    public entry fun buy_item(
        buyer: &signer,
        merchant_id: u64,
        item_id: u64,
    ) acquires MockYominet {
        config::assert_not_paused();
        assert!(merchant_registry::is_active(merchant_id), errors::merchant_not_active());

        let buyer_addr = signer::address_of(buyer);
        let store = borrow_global_mut<MockYominet>(@lendpay);
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

        vector::push_back(
            &mut store.purchases,
            Purchase {
                id: purchase_id,
                item_id,
                buyer: buyer_addr,
                merchant_id,
                amount_paid: item.price,
                purchased_at: timestamp::now_seconds(),
                receipt_object: receipt_address,
            },
        );

        event::emit(ItemPurchasedEvent {
            purchase_id,
            item_id,
            buyer: buyer_addr,
            merchant_id,
            amount_paid: item.price,
            receipt_object: receipt_address,
        });
    }

    #[view]
    public fun get_item(item_id: u64): GameItem acquires MockYominet {
        let store = borrow_global<MockYominet>(@lendpay);
        let item_index = find_item_index_ref(store, item_id);
        *vector::borrow(&store.items, item_index)
    }

    #[view]
    public fun get_purchase(purchase_id: u64): Purchase acquires MockYominet {
        let store = borrow_global<MockYominet>(@lendpay);
        let purchase_index = find_purchase_index_ref(store, purchase_id);
        *vector::borrow(&store.purchases, purchase_index)
    }

    #[view]
    public fun next_item_id(): u64 acquires MockYominet {
        borrow_global<MockYominet>(@lendpay).next_item_id
    }

    #[view]
    public fun next_purchase_id(): u64 acquires MockYominet {
        borrow_global<MockYominet>(@lendpay).next_purchase_id
    }

    #[view]
    public fun item_price(item_id: u64): u64 acquires MockYominet {
        get_item(item_id).price
    }

    #[view]
    public fun purchase_amount_paid(purchase_id: u64): u64 acquires MockYominet {
        get_purchase(purchase_id).amount_paid
    }

    #[view]
    public fun purchase_receipt_address(purchase_id: u64): address acquires MockYominet {
        get_purchase(purchase_id).receipt_object
    }

    #[view]
    public fun purchase_buyer(purchase_id: u64): address acquires MockYominet {
        get_purchase(purchase_id).buyer
    }

    #[view]
    public fun payout_vault_address(): address acquires MockYominet {
        let store = borrow_global<MockYominet>(@lendpay);
        payout_vault_address_internal(store)
    }

    #[view]
    public fun payout_balance(): u64 acquires MockYominet {
        assets::balance_in_store(&borrow_global<MockYominet>(@lendpay).payout_vault_ref)
    }

    #[view]
    public fun receipt_object(purchase_id: u64): Object<InitiaNft> acquires MockYominet {
        object::address_to_object<InitiaNft>(purchase_receipt_address(purchase_id))
    }

    fun payout_vault_address_internal(store: &MockYominet): address {
        assets::store_address_from_extend_ref(&store.payout_vault_ref)
    }

    fun receipt_description(item_name: String): String {
        let description = string::utf8(b"LendPay Yominet unlock: ");
        string::append(&mut description, item_name);
        description
    }

    fun receipt_token_id(purchase_id: u64): String {
        let token_id = string::utf8(b"yominet-receipt-");
        string::append(&mut token_id, hex::encode_to_string(&bcs::to_bytes(&purchase_id)));
        token_id
    }

    fun find_item_index(store: &MockYominet, item_id: u64): u64 {
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

    fun find_item_index_ref(store: &MockYominet, item_id: u64): u64 {
        find_item_index(store, item_id)
    }

    fun find_purchase_index(store: &MockYominet, purchase_id: u64): u64 {
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

    fun find_purchase_index_ref(store: &MockYominet, purchase_id: u64): u64 {
        find_purchase_index(store, purchase_id)
    }
}
