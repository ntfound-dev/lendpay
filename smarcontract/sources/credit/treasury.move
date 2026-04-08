module lendpay::treasury {
    use std::signer;
    use initia_std::coin;
    use initia_std::object;
    use lendpay::assets;
    use lendpay::config;
    use lendpay::errors;

    friend lendpay::lend_token;
    friend lendpay::loan_book;
    friend lendpay::rewards;

    struct Treasury has key {
        loan_vault_ref: object::ExtendRef,
        collateral_vault_ref: object::ExtendRef,
        seized_collateral_vault_ref: object::ExtendRef,
        total_liquidity_deposited: u64,
        total_disbursed: u64,
        total_repaid: u64,
        total_collateral_locked: u64,
        total_collateral_released: u64,
        total_collateral_liquidated: u64,
        reward_reserve: u64,
        total_reward_funded: u64,
        total_lend_claimed: u64,
        total_protocol_lend_burned: u64,
    }

    public entry fun initialize(admin: &signer) {
        config::assert_admin(signer::address_of(admin));
        assert!(!exists<Treasury>(@lendpay), errors::already_initialized());

        let loan_vault_ref = assets::create_named_store(
            admin,
            b"loan_liquidity_vault",
            config::loan_asset_metadata(),
        );
        let collateral_vault_ref = assets::create_named_store(
            admin,
            b"lend_collateral_vault",
            config::lend_metadata(),
        );
        let seized_collateral_vault_ref = assets::create_named_store(
            admin,
            b"lend_seized_collateral_vault",
            config::lend_metadata(),
        );

        move_to(admin, Treasury {
            loan_vault_ref,
            collateral_vault_ref,
            seized_collateral_vault_ref,
            total_liquidity_deposited: 0,
            total_disbursed: 0,
            total_repaid: 0,
            total_collateral_locked: 0,
            total_collateral_released: 0,
            total_collateral_liquidated: 0,
            reward_reserve: 0,
            total_reward_funded: 0,
            total_lend_claimed: 0,
            total_protocol_lend_burned: 0,
        });
    }

    public entry fun deposit_liquidity(admin: &signer, amount: u64) acquires Treasury {
        config::assert_treasury_admin(signer::address_of(admin));
        assert!(amount > 0, errors::invalid_amount());

        let asset = coin::withdraw(admin, loan_asset_metadata(), amount);
        let treasury = borrow_global_mut<Treasury>(@lendpay);
        assets::deposit_to_store(&treasury.loan_vault_ref, asset);
        treasury.total_liquidity_deposited = treasury.total_liquidity_deposited + amount;
    }

    public entry fun withdraw_seized_collateral(
        admin: &signer,
        recipient: address,
        amount: u64,
    ) acquires Treasury {
        config::assert_treasury_admin(signer::address_of(admin));
        assert!(amount > 0, errors::invalid_amount());

        let treasury = borrow_global_mut<Treasury>(@lendpay);
        assert!(
            assets::balance_in_store(&treasury.seized_collateral_vault_ref) >= amount,
            errors::insufficient_lend_balance(),
        );

        let asset = assets::withdraw_from_store(&treasury.seized_collateral_vault_ref, amount);
        coin::deposit(recipient, asset);
    }

    public(friend) fun lock_lend_collateral(borrower: &signer, amount: u64) acquires Treasury {
        assert!(amount > 0, errors::invalid_amount());

        let asset = coin::withdraw(borrower, lend_collateral_metadata(), amount);
        let treasury = borrow_global_mut<Treasury>(@lendpay);
        assets::deposit_to_store(&treasury.collateral_vault_ref, asset);
        treasury.total_collateral_locked = treasury.total_collateral_locked + amount;
    }

    public(friend) fun release_lend_collateral(borrower: address, amount: u64) acquires Treasury {
        assert!(amount > 0, errors::invalid_amount());

        let treasury = borrow_global_mut<Treasury>(@lendpay);
        assert!(
            assets::balance_in_store(&treasury.collateral_vault_ref) >= amount,
            errors::collateral_not_active(),
        );

        let asset = assets::withdraw_from_store(&treasury.collateral_vault_ref, amount);
        coin::deposit(borrower, asset);
        treasury.total_collateral_released = treasury.total_collateral_released + amount;
    }

    public(friend) fun liquidate_lend_collateral(amount: u64) acquires Treasury {
        assert!(amount > 0, errors::invalid_amount());

        let treasury = borrow_global_mut<Treasury>(@lendpay);
        assert!(
            assets::balance_in_store(&treasury.collateral_vault_ref) >= amount,
            errors::collateral_not_active(),
        );

        let asset = assets::withdraw_from_store(&treasury.collateral_vault_ref, amount);
        assets::deposit_to_store(&treasury.seized_collateral_vault_ref, asset);
        treasury.total_collateral_liquidated = treasury.total_collateral_liquidated + amount;
    }

    public(friend) fun disburse_loan(borrower: address, amount: u64) acquires Treasury {
        assert!(amount > 0, errors::invalid_amount());

        let treasury = borrow_global_mut<Treasury>(@lendpay);
        assert!(
            assets::balance_in_store(&treasury.loan_vault_ref) >= amount,
            errors::insufficient_liquidity(),
        );

        let asset = assets::withdraw_from_store(&treasury.loan_vault_ref, amount);
        coin::deposit(borrower, asset);
        treasury.total_disbursed = treasury.total_disbursed + amount;
    }

    public(friend) fun record_repayment(borrower: &signer, amount: u64) acquires Treasury {
        assert!(amount > 0, errors::invalid_amount());

        let asset = coin::withdraw(borrower, loan_asset_metadata(), amount);
        let treasury = borrow_global_mut<Treasury>(@lendpay);
        assets::deposit_to_store(&treasury.loan_vault_ref, asset);
        treasury.total_repaid = treasury.total_repaid + amount;
    }

    public(friend) fun release_reward(amount: u64) acquires Treasury {
        assert!(amount > 0, errors::invalid_amount());

        let treasury = borrow_global_mut<Treasury>(@lendpay);
        assert!(treasury.reward_reserve >= amount, errors::insufficient_reward_reserve());
        treasury.reward_reserve = treasury.reward_reserve - amount;
        treasury.total_lend_claimed = treasury.total_lend_claimed + amount;
    }

    public(friend) fun absorb_protocol_lend(amount: u64) acquires Treasury {
        assert!(amount > 0, errors::invalid_amount());

        let treasury = borrow_global_mut<Treasury>(@lendpay);
        treasury.reward_reserve = treasury.reward_reserve + amount;
        treasury.total_reward_funded = treasury.total_reward_funded + amount;
    }

    public(friend) fun burn_protocol_lend(amount: u64) acquires Treasury {
        assert!(amount > 0, errors::invalid_amount());

        let treasury = borrow_global_mut<Treasury>(@lendpay);
        assert!(treasury.reward_reserve >= amount, errors::insufficient_reward_reserve());
        treasury.reward_reserve = treasury.reward_reserve - amount;
        treasury.total_protocol_lend_burned = treasury.total_protocol_lend_burned + amount;
    }

    #[view]
    public fun loan_asset_metadata(): initia_std::object::Object<initia_std::fungible_asset::Metadata> {
        assets::metadata_from_address(config::loan_asset_metadata())
    }

    #[view]
    public fun lend_collateral_metadata(): initia_std::object::Object<initia_std::fungible_asset::Metadata> {
        assets::metadata_from_address(config::lend_metadata())
    }

    #[view]
    public fun liquidity_balance(): u64 acquires Treasury {
        assets::balance_in_store(&borrow_global<Treasury>(@lendpay).loan_vault_ref)
    }

    #[view]
    public fun reward_reserve(): u64 acquires Treasury {
        borrow_global<Treasury>(@lendpay).reward_reserve
    }

    #[view]
    public fun collateral_balance(): u64 acquires Treasury {
        assets::balance_in_store(&borrow_global<Treasury>(@lendpay).collateral_vault_ref)
    }

    #[view]
    public fun seized_collateral_balance(): u64 acquires Treasury {
        assets::balance_in_store(&borrow_global<Treasury>(@lendpay).seized_collateral_vault_ref)
    }

    #[view]
    public fun total_collateral_locked(): u64 acquires Treasury {
        borrow_global<Treasury>(@lendpay).total_collateral_locked
    }

    #[view]
    public fun total_collateral_released(): u64 acquires Treasury {
        borrow_global<Treasury>(@lendpay).total_collateral_released
    }

    #[view]
    public fun total_collateral_liquidated(): u64 acquires Treasury {
        borrow_global<Treasury>(@lendpay).total_collateral_liquidated
    }

    #[view]
    public fun total_disbursed(): u64 acquires Treasury {
        borrow_global<Treasury>(@lendpay).total_disbursed
    }

    #[view]
    public fun total_repaid(): u64 acquires Treasury {
        borrow_global<Treasury>(@lendpay).total_repaid
    }

    #[view]
    public fun total_lend_claimed(): u64 acquires Treasury {
        borrow_global<Treasury>(@lendpay).total_lend_claimed
    }

    #[view]
    public fun total_protocol_lend_burned(): u64 acquires Treasury {
        borrow_global<Treasury>(@lendpay).total_protocol_lend_burned
    }

    #[view]
    public fun loan_vault_address(): address acquires Treasury {
        assets::store_address_from_extend_ref(&borrow_global<Treasury>(@lendpay).loan_vault_ref)
    }

    #[view]
    public fun collateral_vault_address(): address acquires Treasury {
        assets::store_address_from_extend_ref(&borrow_global<Treasury>(@lendpay).collateral_vault_ref)
    }

    #[view]
    public fun seized_collateral_vault_address(): address acquires Treasury {
        assets::store_address_from_extend_ref(&borrow_global<Treasury>(@lendpay).seized_collateral_vault_ref)
    }
}
