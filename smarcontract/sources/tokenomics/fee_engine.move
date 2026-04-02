module lendpay::fee_engine {
    use std::event;
    use std::signer;
    use std::vector;
    use lendpay::config;
    use lendpay::errors;
    use lendpay::lend_token;
    use lendpay::staking;
    use lendpay::tokenomics;

    friend lendpay::loan_book;

    struct FeeState has copy, drop, store {
        loan_id: u64,
        borrower: address,
        origination_fee_due: u64,
        late_fee_due: u64,
        total_fees_paid: u64,
        total_fees_paid_in_lend: u64,
    }

    struct FeeRegistry has key {
        states: vector<FeeState>,
        treasury_fee_accrued: u64,
        staking_fee_accrued: u64,
        burned_lend: u64,
        lend_fees_paid: u64,
    }

    struct FeeQuoted has copy, drop, store {
        base_fee: u64,
        tier_discount_bps: u64,
        pay_in_lend_discount_bps: u64,
        effective_fee: u64,
    }

    #[event]
    struct FeeAssessedEvent has drop, store {
        loan_id: u64,
        borrower: address,
        fee_kind: u8,
        amount: u64,
    }

    #[event]
    struct FeePaidEvent has drop, store {
        loan_id: u64,
        borrower: address,
        total_paid: u64,
        treasury_share: u64,
        staking_share: u64,
        burned_share: u64,
    }

    public entry fun initialize(admin: &signer) {
        config::assert_admin(signer::address_of(admin));
        assert!(!exists<FeeRegistry>(@lendpay), errors::already_initialized());

        move_to(admin, FeeRegistry {
            states: vector::empty(),
            treasury_fee_accrued: 0,
            staking_fee_accrued: 0,
            burned_lend: 0,
            lend_fees_paid: 0,
        });
    }

    public(friend) fun assess_origination_fee(loan_id: u64, borrower: address, principal: u64) acquires FeeRegistry {
        let registry = borrow_global_mut<FeeRegistry>(@lendpay);
        let state = borrow_or_create_state_in_registry(registry, loan_id, borrower);
        let quote = quote_origination_fee(principal, borrower, false);
        state.origination_fee_due = state.origination_fee_due + quote.effective_fee;

        event::emit(FeeAssessedEvent {
            loan_id,
            borrower,
            fee_kind: 1,
            amount: quote.effective_fee,
        });
    }

    public(friend) fun assess_late_fee(
        loan_id: u64,
        borrower: address,
        installment_amount: u64,
    ) acquires FeeRegistry {
        let registry = borrow_global_mut<FeeRegistry>(@lendpay);
        let state = borrow_or_create_state_in_registry(registry, loan_id, borrower);
        let quote = quote_late_fee(installment_amount, borrower, false);
        state.late_fee_due = state.late_fee_due + quote.effective_fee;

        event::emit(FeeAssessedEvent {
            loan_id,
            borrower,
            fee_kind: 2,
            amount: quote.effective_fee,
        });
    }

    public entry fun pay_outstanding_fees_in_lend(user: &signer, loan_id: u64) acquires FeeRegistry {
        config::assert_not_paused();

        let user_addr = signer::address_of(user);
        let registry = borrow_global_mut<FeeRegistry>(@lendpay);
        let index = find_state_index(registry, loan_id);
        let (orig_due, late_due) = {
            let state = vector::borrow_mut(&mut registry.states, index);
            assert!(state.borrower == user_addr, errors::not_borrower());
            let orig_due =
                apply_discount(state.origination_fee_due, config::pay_fee_in_lend_discount_bps());
            let late_due =
                apply_discount(state.late_fee_due, config::pay_fee_in_lend_discount_bps());
            (orig_due, late_due)
        };
        let total_due = orig_due + late_due;
        assert!(total_due > 0, errors::nothing_to_pay());

        let (orig_treasury, orig_staking, orig_burn) = split_standard_fee(orig_due);
        let (late_treasury, late_staking, late_burn) = split_late_fee(late_due);

        let treasury_share = orig_treasury + late_treasury;
        let staking_share = orig_staking + late_staking;
        let burned_share = orig_burn + late_burn;

        lend_token::collect_fee_from_user(user, treasury_share + staking_share, burned_share);
        staking::fund_from_fee(staking_share);

        {
            let state = vector::borrow_mut(&mut registry.states, index);
            state.total_fees_paid = state.total_fees_paid + total_due;
            state.total_fees_paid_in_lend = state.total_fees_paid_in_lend + total_due;
            state.origination_fee_due = 0;
            state.late_fee_due = 0;
        };

        registry.treasury_fee_accrued = registry.treasury_fee_accrued + treasury_share;
        registry.staking_fee_accrued = registry.staking_fee_accrued + staking_share;
        registry.burned_lend = registry.burned_lend + burned_share;
        registry.lend_fees_paid = registry.lend_fees_paid + total_due;

        event::emit(FeePaidEvent {
            loan_id,
            borrower: user_addr,
            total_paid: total_due,
            treasury_share,
            staking_share,
            burned_share,
        });
    }

    #[view]
    public fun quote_origination_fee(principal: u64, borrower: address, pay_in_lend: bool): FeeQuoted {
        let base_fee = (principal * config::origination_fee_bps()) / 10_000;
        let tier_discount_bps = tokenomics::tier_fee_discount_bps(lend_token::total_balance_of(borrower));
        let discounted = apply_discount(base_fee, tier_discount_bps);
        let effective_fee = if (pay_in_lend) {
            apply_discount(discounted, config::pay_fee_in_lend_discount_bps())
        } else {
            discounted
        };

        FeeQuoted {
            base_fee,
            tier_discount_bps,
            pay_in_lend_discount_bps: if (pay_in_lend) config::pay_fee_in_lend_discount_bps() else 0,
            effective_fee,
        }
    }

    #[view]
    public fun quote_late_fee(installment_amount: u64, borrower: address, pay_in_lend: bool): FeeQuoted {
        let base_fee = (installment_amount * config::late_fee_bps()) / 10_000;
        let tier_discount_bps = tokenomics::tier_fee_discount_bps(lend_token::total_balance_of(borrower));
        let discounted = apply_discount(base_fee, tier_discount_bps);
        let effective_fee = if (pay_in_lend) {
            apply_discount(discounted, config::pay_fee_in_lend_discount_bps())
        } else {
            discounted
        };

        FeeQuoted {
            base_fee,
            tier_discount_bps,
            pay_in_lend_discount_bps: if (pay_in_lend) config::pay_fee_in_lend_discount_bps() else 0,
            effective_fee,
        }
    }

    #[view]
    public fun get_fee_state(loan_id: u64): FeeState acquires FeeRegistry {
        let registry = borrow_global<FeeRegistry>(@lendpay);
        let index = find_state_index_ref(registry, loan_id);
        *vector::borrow(&registry.states, index)
    }

    fun split_standard_fee(amount: u64): (u64, u64, u64) {
        if (amount == 0) {
            return (0, 0, 0)
        };

        let (treasury_bps, staking_bps, _burn_bps) = tokenomics::fee_split_bps();
        let treasury_share = (amount * treasury_bps) / 10_000;
        let staking_share = (amount * staking_bps) / 10_000;
        let burned_share = amount - treasury_share - staking_share;
        (treasury_share, staking_share, burned_share)
    }

    fun split_late_fee(amount: u64): (u64, u64, u64) {
        if (amount == 0) {
            return (0, 0, 0)
        };

        let burn_share = (amount * tokenomics::late_fee_burn_share_bps()) / 10_000;
        let remaining = amount - burn_share;
        let treasury_share = remaining / 2;
        let staking_share = remaining - treasury_share;
        (treasury_share, staking_share, burn_share)
    }

    fun apply_discount(amount: u64, discount_bps: u64): u64 {
        amount - ((amount * discount_bps) / 10_000)
    }

    fun borrow_or_create_state_in_registry(
        registry: &mut FeeRegistry,
        loan_id: u64,
        borrower: address,
    ): &mut FeeState {
        let len = vector::length(&registry.states);
        let i = 0;

        while (i < len) {
            if (vector::borrow(&registry.states, i).loan_id == loan_id) {
                return vector::borrow_mut(&mut registry.states, i)
            };
            i = i + 1;
        };

        vector::push_back(
            &mut registry.states,
            FeeState {
                loan_id,
                borrower,
                origination_fee_due: 0,
                late_fee_due: 0,
                total_fees_paid: 0,
                total_fees_paid_in_lend: 0,
            },
        );

        let new_len = vector::length(&registry.states);
        vector::borrow_mut(&mut registry.states, new_len - 1)
    }

    fun find_state_index(registry: &FeeRegistry, loan_id: u64): u64 {
        let len = vector::length(&registry.states);
        let i = 0;

        while (i < len) {
            if (vector::borrow(&registry.states, i).loan_id == loan_id) {
                return i
            };
            i = i + 1;
        };

        abort errors::fee_record_not_found()
    }

    fun find_state_index_ref(registry: &FeeRegistry, loan_id: u64): u64 {
        find_state_index(registry, loan_id)
    }
}
