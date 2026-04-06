module lendpay::mock_cabal {
    use std::event;
    use std::signer;
    use std::string::{Self, String};
    use std::timestamp;
    use std::vector;
    use initia_std::coin;
    use initia_std::object::ExtendRef;
    use lendpay::assets;
    use lendpay::config;
    use lendpay::errors;
    use lendpay::merchant_registry;
    use lendpay::treasury;

    const POSITION_OPEN: u8 = 0;
    const POSITION_WITHDRAWN: u8 = 1;

    struct Vault has copy, drop, store {
        id: u64,
        name: String,
        expected_apy_bps: u64,
        min_deposit: u64,
        active: bool,
    }

    struct Position has copy, drop, store {
        id: u64,
        vault_id: u64,
        owner: address,
        merchant_id: u64,
        principal: u64,
        expected_yield_bps: u64,
        opened_at: u64,
        status: u8,
    }

    struct MockCabal has key {
        next_vault_id: u64,
        next_position_id: u64,
        payout_vault_ref: ExtendRef,
        vaults: vector<Vault>,
        positions: vector<Position>,
    }

    #[event]
    struct PositionOpenedEvent has drop, store {
        position_id: u64,
        vault_id: u64,
        owner: address,
        merchant_id: u64,
        principal: u64,
    }

    #[event]
    struct PositionWithdrawnEvent has drop, store {
        position_id: u64,
        owner: address,
        principal: u64,
    }

    public entry fun initialize(admin: &signer) {
        config::assert_admin(signer::address_of(admin));
        assert!(!exists<MockCabal>(@lendpay), errors::already_initialized());

        let payout_vault_ref = assets::create_named_store(
            admin,
            b"mock_cabal_payout_vault",
            config::loan_asset_metadata(),
        );

        let vaults = vector::empty<Vault>();
        vector::push_back(
            &mut vaults,
            Vault {
                id: 1,
                name: string::utf8(b"Momentum Vault"),
                expected_apy_bps: 1200,
                min_deposit: 100,
                active: true,
            },
        );
        vector::push_back(
            &mut vaults,
            Vault {
                id: 2,
                name: string::utf8(b"Stable Carry Vault"),
                expected_apy_bps: 900,
                min_deposit: 150,
                active: true,
            },
        );

        move_to(admin, MockCabal {
            next_vault_id: 3,
            next_position_id: 1,
            payout_vault_ref,
            vaults,
            positions: vector::empty(),
        });
    }

    public entry fun deposit(
        owner: &signer,
        merchant_id: u64,
        vault_id: u64,
        amount: u64,
    ) acquires MockCabal {
        config::assert_not_paused();
        assert!(merchant_registry::is_active(merchant_id), errors::merchant_not_active());
        assert!(amount > 0, errors::invalid_amount());

        let owner_addr = signer::address_of(owner);
        let store = borrow_global_mut<MockCabal>(@lendpay);
        let payout_address = payout_vault_address_internal(store);
        assert!(
            merchant_registry::merchant_address(merchant_id) == payout_address,
            errors::merchant_destination_mismatch(),
        );

        let vault_index = find_vault_index(store, vault_id);
        let vault = *vector::borrow(&store.vaults, vault_index);
        assert!(vault.active, errors::item_not_active());
        assert!(amount >= vault.min_deposit, errors::invalid_amount());

        let payment = coin::withdraw(owner, treasury::loan_asset_metadata(), amount);
        assets::deposit_to_store(&store.payout_vault_ref, payment);

        let position_id = store.next_position_id;
        store.next_position_id = position_id + 1;
        vector::push_back(
            &mut store.positions,
            Position {
                id: position_id,
                vault_id,
                owner: owner_addr,
                merchant_id,
                principal: amount,
                expected_yield_bps: vault.expected_apy_bps,
                opened_at: timestamp::now_seconds(),
                status: POSITION_OPEN,
            },
        );

        event::emit(PositionOpenedEvent {
            position_id,
            vault_id,
            owner: owner_addr,
            merchant_id,
            principal: amount,
        });
    }

    public entry fun withdraw(owner: &signer, position_id: u64) acquires MockCabal {
        config::assert_not_paused();

        let owner_addr = signer::address_of(owner);
        let store = borrow_global_mut<MockCabal>(@lendpay);
        let position_index = find_position_index(store, position_id);
        let position = vector::borrow_mut(&mut store.positions, position_index);

        assert!(position.owner == owner_addr, errors::not_borrower());
        assert!(position.status == POSITION_OPEN, errors::position_not_open());

        let principal = position.principal;
        position.status = POSITION_WITHDRAWN;

        let payout = assets::withdraw_from_store(&store.payout_vault_ref, principal);
        coin::deposit(owner_addr, payout);

        event::emit(PositionWithdrawnEvent {
            position_id,
            owner: owner_addr,
            principal,
        });
    }

    #[view]
    public fun get_vault(vault_id: u64): Vault acquires MockCabal {
        let store = borrow_global<MockCabal>(@lendpay);
        let vault_index = find_vault_index_ref(store, vault_id);
        *vector::borrow(&store.vaults, vault_index)
    }

    #[view]
    public fun get_position(position_id: u64): Position acquires MockCabal {
        let store = borrow_global<MockCabal>(@lendpay);
        let position_index = find_position_index_ref(store, position_id);
        *vector::borrow(&store.positions, position_index)
    }

    #[view]
    public fun next_vault_id(): u64 acquires MockCabal {
        borrow_global<MockCabal>(@lendpay).next_vault_id
    }

    #[view]
    public fun next_position_id(): u64 acquires MockCabal {
        borrow_global<MockCabal>(@lendpay).next_position_id
    }

    #[view]
    public fun payout_vault_address(): address acquires MockCabal {
        let store = borrow_global<MockCabal>(@lendpay);
        payout_vault_address_internal(store)
    }

    #[view]
    public fun payout_balance(): u64 acquires MockCabal {
        assets::balance_in_store(&borrow_global<MockCabal>(@lendpay).payout_vault_ref)
    }

    #[view]
    public fun quote_expected_yield(vault_id: u64, amount: u64): u64 acquires MockCabal {
        let vault = get_vault(vault_id);
        (amount * vault.expected_apy_bps) / 10_000
    }

    #[view]
    public fun position_expected_yield(position_id: u64): u64 acquires MockCabal {
        let position = get_position(position_id);
        (position.principal * position.expected_yield_bps) / 10_000
    }

    #[view]
    public fun position_owner(position_id: u64): address acquires MockCabal {
        get_position(position_id).owner
    }

    fun payout_vault_address_internal(store: &MockCabal): address {
        assets::store_address_from_extend_ref(&store.payout_vault_ref)
    }

    fun find_vault_index(store: &MockCabal, vault_id: u64): u64 {
        let len = vector::length(&store.vaults);
        let i = 0;

        while (i < len) {
            if (vector::borrow(&store.vaults, i).id == vault_id) {
                return i
            };
            i = i + 1;
        };

        abort errors::vault_not_found()
    }

    fun find_vault_index_ref(store: &MockCabal, vault_id: u64): u64 {
        find_vault_index(store, vault_id)
    }

    fun find_position_index(store: &MockCabal, position_id: u64): u64 {
        let len = vector::length(&store.positions);
        let i = 0;

        while (i < len) {
            if (vector::borrow(&store.positions, i).id == position_id) {
                return i
            };
            i = i + 1;
        };

        abort errors::position_not_found()
    }

    fun find_position_index_ref(store: &MockCabal, position_id: u64): u64 {
        find_position_index(store, position_id)
    }
}
