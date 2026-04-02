module lendpay::lend_token {
    use std::event;
    use std::option;
    use std::signer;
    use std::string;
    use std::vector;
    use initia_std::coin::{Self, BurnCapability, MintCapability};
    use initia_std::fungible_asset::{Self, Metadata};
    use initia_std::object;
    use lendpay::assets;
    use lendpay::config;
    use lendpay::errors;
    use lendpay::treasury;

    friend lendpay::campaigns;
    friend lendpay::fee_engine;
    friend lendpay::loan_book;
    friend lendpay::rewards;
    friend lendpay::staking;

    const LEND_NAME: vector<u8> = b"LendPay Token";
    const LEND_SYMBOL: vector<u8> = b"LEND";
    const LEND_PROJECT_URI: vector<u8> = b"https://lendpay.initia";

    struct BalanceEntry has copy, drop, store {
        owner: address,
        staked: u64,
        total_received: u64,
        total_burned: u64,
        total_fee_contributed: u64,
    }

    struct LendLedger has key {
        metadata_address: address,
        mint_cap: MintCapability,
        burn_cap: BurnCapability,
        reserve_store_ref: object::ExtendRef,
        staking_store_ref: object::ExtendRef,
        total_minted: u64,
        total_burned: u64,
        total_fee_contributed: u64,
        total_rewards_distributed: u64,
        balances: vector<BalanceEntry>,
    }

    #[event]
    struct LendMintedEvent has drop, store {
        recipient: address,
        amount: u64,
        total_minted: u64,
    }

    #[event]
    struct LendTransferredEvent has drop, store {
        sender: address,
        recipient: address,
        amount: u64,
    }

    #[event]
    struct LendBurnedEvent has drop, store {
        owner: address,
        amount: u64,
        total_burned: u64,
    }

    public entry fun initialize(admin: &signer) {
        assert!(signer::address_of(admin) == @lendpay, errors::not_package_owner());
        assert!(!exists<LendLedger>(@lendpay), errors::already_initialized());

        let (mint_cap, burn_cap, _freeze_cap) = coin::initialize(
            admin,
            option::none(),
            string::utf8(LEND_NAME),
            string::utf8(LEND_SYMBOL),
            6,
            string::utf8(b""),
            string::utf8(LEND_PROJECT_URI),
        );
        let metadata = coin::metadata(signer::address_of(admin), string::utf8(LEND_SYMBOL));
        let metadata_address = object::object_address(&metadata);
        let reserve_store_ref =
            assets::create_named_store(admin, b"lend_reserve_vault", metadata_address);
        let staking_store_ref =
            assets::create_named_store(admin, b"lend_staking_vault", metadata_address);

        move_to(admin, LendLedger {
            metadata_address,
            mint_cap,
            burn_cap,
            reserve_store_ref,
            staking_store_ref,
            total_minted: 0,
            total_burned: 0,
            total_fee_contributed: 0,
            total_rewards_distributed: 0,
            balances: vector::empty(),
        });
    }

    public entry fun mint_to_protocol_reserve(admin: &signer, amount: u64) acquires LendLedger {
        config::assert_admin(signer::address_of(admin));
        assert!(amount > 0, errors::invalid_amount());

        let total_minted_after = {
            let ledger = borrow_global_mut<LendLedger>(@lendpay);
            let minted = coin::mint(&ledger.mint_cap, amount);
            assets::deposit_to_store(&ledger.reserve_store_ref, minted);
            ledger.total_minted = ledger.total_minted + amount;
            ledger.total_minted
        };
        treasury::absorb_protocol_lend(amount);

        event::emit(LendMintedEvent {
            recipient: @lendpay,
            amount,
            total_minted: total_minted_after,
        });
    }

    public entry fun deposit_to_protocol_reserve(user: &signer, amount: u64) acquires LendLedger {
        config::assert_treasury_admin(signer::address_of(user));
        assert!(amount > 0, errors::invalid_amount());

        let asset = coin::withdraw(user, metadata(), amount);
        let ledger = borrow_global_mut<LendLedger>(@lendpay);
        assets::deposit_to_store(&ledger.reserve_store_ref, asset);
        treasury::absorb_protocol_lend(amount);

        event::emit(LendTransferredEvent {
            sender: signer::address_of(user),
            recipient: @lendpay,
            amount,
        });
    }

    public entry fun transfer(sender: &signer, recipient: address, amount: u64) acquires LendLedger {
        assert!(amount > 0, errors::invalid_amount());

        coin::transfer(sender, recipient, metadata(), amount);

        event::emit(LendTransferredEvent {
            sender: signer::address_of(sender),
            recipient,
            amount,
        });
    }

    public(friend) fun distribute_from_protocol(user: address, amount: u64) acquires LendLedger {
        assert!(amount > 0, errors::invalid_amount());

        let available = protocol_inventory();
        assert!(available >= amount, errors::insufficient_reward_reserve());

        {
            let ledger = borrow_global_mut<LendLedger>(@lendpay);
            let asset = assets::withdraw_from_store(&ledger.reserve_store_ref, amount);
            coin::deposit(user, asset);
            ledger.total_rewards_distributed = ledger.total_rewards_distributed + amount;
            let balance = borrow_or_create_balance_in_ledger(ledger, user);
            balance.total_received = balance.total_received + amount;
        };
        treasury::release_reward(amount);

        event::emit(LendTransferredEvent {
            sender: @lendpay,
            recipient: user,
            amount,
        });
    }

    public(friend) fun burn_from_protocol_reserve(amount: u64): u64 acquires LendLedger {
        if (amount == 0) {
            return 0
        };

        let burn_amount = {
            let available = protocol_inventory();
            if (available >= amount) amount else available
        };
        if (burn_amount == 0) {
            return 0
        };

        let total_burned_after = {
            let ledger = borrow_global_mut<LendLedger>(@lendpay);
            let asset = assets::withdraw_from_store(&ledger.reserve_store_ref, burn_amount);
            coin::burn(&ledger.burn_cap, asset);
            ledger.total_burned = ledger.total_burned + burn_amount;
            ledger.total_burned
        };
        treasury::burn_protocol_lend(burn_amount);

        event::emit(LendBurnedEvent {
            owner: @lendpay,
            amount: burn_amount,
            total_burned: total_burned_after,
        });
        burn_amount
    }

    public(friend) fun collect_fee_from_user(
        user: &signer,
        protocol_credit: u64,
        burn_amount: u64,
    ) acquires LendLedger {
        let total = protocol_credit + burn_amount;
        let user_addr = signer::address_of(user);
        assert!(total > 0, errors::invalid_amount());

        let total_burned_after = {
            let ledger = borrow_global_mut<LendLedger>(@lendpay);
            let payment = coin::withdraw(user, metadata_from_ledger(ledger), total);
            let remainder = payment;

            if (protocol_credit > 0) {
                let protocol_asset = fungible_asset::extract(&mut remainder, protocol_credit);
                assets::deposit_to_store(&ledger.reserve_store_ref, protocol_asset);
            };

            let total_burned_after = if (burn_amount > 0) {
                let burn_asset = fungible_asset::extract(&mut remainder, burn_amount);
                coin::burn(&ledger.burn_cap, burn_asset);
                ledger.total_burned = ledger.total_burned + burn_amount;
                {
                    let balance = borrow_or_create_balance_in_ledger(ledger, user_addr);
                    balance.total_burned = balance.total_burned + burn_amount;
                };
                ledger.total_burned
            } else {
                0
            };

            fungible_asset::destroy_zero(remainder);

            ledger.total_fee_contributed = ledger.total_fee_contributed + total;
            {
                let balance = borrow_or_create_balance_in_ledger(ledger, user_addr);
                balance.total_fee_contributed = balance.total_fee_contributed + total;
            };
            total_burned_after
        };

        if (protocol_credit > 0) {
            treasury::absorb_protocol_lend(protocol_credit);
        };

        if (burn_amount > 0) {
            event::emit(LendBurnedEvent {
                owner: user_addr,
                amount: burn_amount,
                total_burned: total_burned_after,
            });
        };
    }

    public(friend) fun move_to_staked(user: &signer, amount: u64) acquires LendLedger {
        assert!(amount > 0, errors::nothing_to_stake());

        let user_addr = signer::address_of(user);
        let asset = coin::withdraw(user, metadata(), amount);
        let ledger = borrow_global_mut<LendLedger>(@lendpay);
        assets::deposit_to_store(&ledger.staking_store_ref, asset);

        let balance = borrow_or_create_balance_in_ledger(ledger, user_addr);
        balance.staked = balance.staked + amount;
    }

    public(friend) fun release_from_staked(user: address, amount: u64) acquires LendLedger {
        assert!(amount > 0, errors::nothing_to_unstake());

        let ledger = borrow_global_mut<LendLedger>(@lendpay);
        {
            let balance = borrow_or_create_balance_in_ledger(ledger, user);
            assert!(balance.staked >= amount, errors::insufficient_staked_balance());
            balance.staked = balance.staked - amount;
        };

        let asset = assets::withdraw_from_store(&ledger.staking_store_ref, amount);
        coin::deposit(user, asset);
    }

    #[view]
    public fun metadata_address(): address acquires LendLedger {
        borrow_global<LendLedger>(@lendpay).metadata_address
    }

    #[view]
    public fun balance_of(user: address): u64 acquires LendLedger {
        if (!exists<LendLedger>(@lendpay)) {
            0
        } else {
            coin::balance(user, metadata())
        }
    }

    #[view]
    public fun staked_balance_of(user: address): u64 acquires LendLedger {
        if (!exists<LendLedger>(@lendpay)) {
            0
        } else {
            get_balance_or_zero(user).staked
        }
    }

    #[view]
    public fun total_balance_of(user: address): u64 acquires LendLedger {
        balance_of(user) + staked_balance_of(user)
    }

    #[view]
    public fun voting_power_of(user: address): u64 acquires LendLedger {
        total_balance_of(user)
    }

    #[view]
    public fun protocol_inventory(): u64 acquires LendLedger {
        assets::balance_in_store(&borrow_global<LendLedger>(@lendpay).reserve_store_ref)
    }

    #[view]
    public fun staked_inventory(): u64 acquires LendLedger {
        assets::balance_in_store(&borrow_global<LendLedger>(@lendpay).staking_store_ref)
    }

    #[view]
    public fun reserve_vault_address(): address acquires LendLedger {
        assets::store_address_from_extend_ref(&borrow_global<LendLedger>(@lendpay).reserve_store_ref)
    }

    #[view]
    public fun staking_vault_address(): address acquires LendLedger {
        assets::store_address_from_extend_ref(&borrow_global<LendLedger>(@lendpay).staking_store_ref)
    }

    #[view]
    public fun total_minted(): u64 acquires LendLedger {
        borrow_global<LendLedger>(@lendpay).total_minted
    }

    #[view]
    public fun total_burned(): u64 acquires LendLedger {
        borrow_global<LendLedger>(@lendpay).total_burned
    }

    #[view]
    public fun circulating_supply(): u64 acquires LendLedger {
        let ledger = borrow_global<LendLedger>(@lendpay);
        let live_supply = ledger.total_minted - ledger.total_burned;
        let inventory = assets::balance_in_store(&ledger.reserve_store_ref);
        if (live_supply > inventory) {
            live_supply - inventory
        } else {
            0
        }
    }

    fun metadata(): object::Object<Metadata> acquires LendLedger {
        object::address_to_object<Metadata>(borrow_global<LendLedger>(@lendpay).metadata_address)
    }

    fun metadata_from_ledger(ledger: &LendLedger): object::Object<Metadata> {
        object::address_to_object<Metadata>(ledger.metadata_address)
    }

    fun get_balance_or_zero(user: address): BalanceEntry acquires LendLedger {
        let ledger = borrow_global<LendLedger>(@lendpay);
        let len = vector::length(&ledger.balances);
        let i = 0;

        while (i < len) {
            let balance = vector::borrow(&ledger.balances, i);
            if (balance.owner == user) {
                return *balance
            };
            i = i + 1;
        };

        BalanceEntry {
            owner: user,
            staked: 0,
            total_received: 0,
            total_burned: 0,
            total_fee_contributed: 0,
        }
    }

    fun borrow_or_create_balance_in_ledger(
        ledger: &mut LendLedger,
        user: address,
    ): &mut BalanceEntry {
        let len = vector::length(&ledger.balances);
        let i = 0;

        while (i < len) {
            if (vector::borrow(&ledger.balances, i).owner == user) {
                return vector::borrow_mut(&mut ledger.balances, i)
            };
            i = i + 1;
        };

        vector::push_back(
            &mut ledger.balances,
            BalanceEntry {
                owner: user,
                staked: 0,
                total_received: 0,
                total_burned: 0,
                total_fee_contributed: 0,
            },
        );

        let new_len = vector::length(&ledger.balances);
        vector::borrow_mut(&mut ledger.balances, new_len - 1)
    }
}
