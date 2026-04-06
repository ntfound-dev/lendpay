module lendpay::loan_book {
    use std::event;
    use std::signer;
    use std::timestamp;
    use std::vector;
    use lendpay::config;
    use lendpay::errors;
    use lendpay::fee_engine;
    use lendpay::lend_token;
    use lendpay::profiles;
    use lendpay::referral;
    use lendpay::reputation;
    use lendpay::rewards;
    use lendpay::tokenomics;
    use lendpay::treasury;

    const PROFILE_UNSPECIFIED: u8 = 0;

    const REQUEST_PENDING: u8 = 0;
    const REQUEST_APPROVED: u8 = 1;
    const REQUEST_REJECTED: u8 = 2;
    const REQUEST_CANCELLED: u8 = 3;

    const LOAN_ACTIVE: u8 = 10;
    const LOAN_REPAID: u8 = 11;
    const LOAN_DEFAULTED: u8 = 12;

    const COLLATERAL_NONE: u8 = 0;
    const COLLATERAL_LOCKED: u8 = 1;
    const COLLATERAL_RETURNED: u8 = 2;
    const COLLATERAL_LIQUIDATED: u8 = 3;

    const SECONDS_PER_MONTH: u64 = 30 * 24 * 60 * 60;

    struct LoanRequest has copy, drop, store {
        id: u64,
        profile_id: u8,
        borrower: address,
        amount: u64,
        collateral_amount: u64,
        tenor_months: u8,
        created_at: u64,
        status: u8,
    }

    struct Loan has copy, drop, store {
        id: u64,
        request_id: u64,
        profile_id: u8,
        borrower: address,
        amount: u64,
        collateral_amount: u64,
        collateral_state: u8,
        apr_bps: u64,
        tenor_months: u8,
        installment_amount: u64,
        installments_total: u64,
        installments_paid: u64,
        issued_at: u64,
        next_due_at: u64,
        grace_period_seconds: u64,
        total_repaid: u64,
        status: u8,
    }

    struct LoanBook has key {
        next_request_id: u64,
        next_loan_id: u64,
        requests: vector<LoanRequest>,
        loans: vector<Loan>,
    }

    #[event]
    struct LoanRequestedEvent has drop, store {
        request_id: u64,
        profile_id: u8,
        borrower: address,
        amount: u64,
        tenor_months: u8,
    }

    #[event]
    struct CollateralLockedEvent has drop, store {
        request_id: u64,
        borrower: address,
        amount: u64,
    }

    #[event]
    struct CollateralReleasedEvent has drop, store {
        loan_id: u64,
        borrower: address,
        amount: u64,
        liquidated: bool,
    }

    #[event]
    struct LoanApprovedEvent has drop, store {
        request_id: u64,
        loan_id: u64,
        profile_id: u8,
        borrower: address,
        amount: u64,
        apr_bps: u64,
    }

    #[event]
    struct InstallmentPaidEvent has drop, store {
        loan_id: u64,
        borrower: address,
        installment_number: u64,
        amount: u64,
        was_on_time: bool,
    }

    #[event]
    struct LoanDefaultedEvent has drop, store {
        loan_id: u64,
        borrower: address,
    }

    public entry fun initialize(admin: &signer) {
        config::assert_admin(signer::address_of(admin));
        assert!(!exists<LoanBook>(@lendpay), errors::already_initialized());

        move_to(admin, LoanBook {
            next_request_id: 1,
            next_loan_id: 1,
            requests: vector::empty(),
            loans: vector::empty(),
        });
    }

    public entry fun request_loan(
        borrower: &signer,
        amount: u64,
        tenor_months: u8,
    ) acquires LoanBook {
        request_loan_internal(borrower, PROFILE_UNSPECIFIED, amount, 0, tenor_months);
    }

    public entry fun request_profiled_loan(
        borrower: &signer,
        profile_id: u8,
        amount: u64,
        tenor_months: u8,
    ) acquires LoanBook {
        profiles::assert_request_allowed(signer::address_of(borrower), profile_id, amount, tenor_months);
        request_loan_internal(borrower, profile_id, amount, 0, tenor_months);
    }

    public entry fun request_collateralized_loan(
        borrower: &signer,
        profile_id: u8,
        amount: u64,
        collateral_amount: u64,
        tenor_months: u8,
    ) acquires LoanBook {
        assert_request_terms(amount, tenor_months);
        profiles::assert_collateral_request_allowed(
            signer::address_of(borrower),
            profile_id,
            amount,
            tenor_months,
            collateral_amount,
        );
        treasury::lock_lend_collateral(borrower, collateral_amount);
        let request_id = request_loan_internal(borrower, profile_id, amount, collateral_amount, tenor_months);

        event::emit(CollateralLockedEvent {
            request_id,
            borrower: signer::address_of(borrower),
            amount: collateral_amount,
        });
    }

    fun request_loan_internal(
        borrower: &signer,
        profile_id: u8,
        amount: u64,
        collateral_amount: u64,
        tenor_months: u8,
    ): u64 acquires LoanBook {
        assert_request_terms(amount, tenor_months);

        let borrower_addr = signer::address_of(borrower);
        let now = timestamp::now_seconds();
        let request_id = {
            let book = borrow_global_mut<LoanBook>(@lendpay);
            let request_id = book.next_request_id;
            book.next_request_id = request_id + 1;
            vector::push_back(
                &mut book.requests,
                LoanRequest {
                    id: request_id,
                    profile_id,
                    borrower: borrower_addr,
                    amount,
                    collateral_amount,
                    tenor_months,
                    created_at: now,
                    status: REQUEST_PENDING,
                },
            );
            request_id
        };

        reputation::record_request(borrower_addr);
        rewards::reward_request(borrower_addr);

        event::emit(LoanRequestedEvent {
            request_id,
            profile_id,
            borrower: borrower_addr,
            amount,
            tenor_months,
        });
        request_id
    }

    public entry fun approve_request(
        admin: &signer,
        request_id: u64,
        apr_bps: u64,
        installment_amount: u64,
        installments_total: u64,
        grace_period_seconds: u64,
    ) acquires LoanBook {
        config::assert_admin(signer::address_of(admin));
        config::assert_not_paused();
        assert!(installment_amount > 0, errors::invalid_amount());
        assert!(installments_total > 0, errors::invalid_installment_plan());

        let now = timestamp::now_seconds();
        let (loan_id, profile_id, borrower, amount, _collateral_amount, effective_apr_bps) = {
            let book = borrow_global_mut<LoanBook>(@lendpay);
            let request_index = find_request_index(book, request_id);
            let loan_id = book.next_loan_id;
            let (profile_id, borrower, amount, collateral_amount, tenor_months) = {
                let request = vector::borrow_mut(&mut book.requests, request_index);
                assert!(request.status == REQUEST_PENDING, errors::request_not_pending());
                assert!(
                    installments_total == (request.tenor_months as u64),
                    errors::invalid_installment_plan(),
                );

                let profile_id = request.profile_id;
                let borrower = request.borrower;
                let amount = request.amount;
                let collateral_amount = request.collateral_amount;
                let tenor_months = request.tenor_months;
                request.status = REQUEST_APPROVED;
                (profile_id, borrower, amount, collateral_amount, tenor_months)
            };

            let holder_apr_discount_bps =
                tokenomics::tier_apr_discount_bps(lend_token::total_balance_of(borrower));
            let points_apr_discount_bps = rewards::interest_discount_bps_of(borrower);
            let total_apr_discount_bps = holder_apr_discount_bps + points_apr_discount_bps;
            let effective_apr_bps = if (apr_bps > total_apr_discount_bps) {
                apr_bps - total_apr_discount_bps
            } else {
                0
            };

            treasury::disburse_loan(borrower, amount);
            book.next_loan_id = loan_id + 1;

            vector::push_back(
                &mut book.loans,
                Loan {
                    id: loan_id,
                    request_id,
                    profile_id,
                    borrower,
                    amount,
                    collateral_amount,
                    collateral_state: if (collateral_amount > 0) COLLATERAL_LOCKED else COLLATERAL_NONE,
                    apr_bps: effective_apr_bps,
                    tenor_months,
                    installment_amount,
                    installments_total,
                    installments_paid: 0,
                    issued_at: now,
                    next_due_at: now + SECONDS_PER_MONTH,
                    grace_period_seconds,
                    total_repaid: 0,
                    status: LOAN_ACTIVE,
                },
            );

            (loan_id, profile_id, borrower, amount, collateral_amount, effective_apr_bps)
        };

        reputation::record_approval(borrower);
        rewards::reward_approval(borrower);
        referral::reward_referrer_for_first_loan(borrower);
        fee_engine::assess_origination_fee(loan_id, borrower, amount);

        event::emit(LoanApprovedEvent {
            request_id,
            loan_id,
            profile_id,
            borrower,
            amount,
            apr_bps: effective_apr_bps,
        });
    }

    public entry fun reject_request(admin: &signer, request_id: u64) acquires LoanBook {
        config::assert_admin(signer::address_of(admin));

        let (borrower, collateral_amount) = {
            let book = borrow_global_mut<LoanBook>(@lendpay);
            let request_index = find_request_index(book, request_id);
            let request = vector::borrow_mut(&mut book.requests, request_index);

            assert!(request.status == REQUEST_PENDING, errors::request_not_pending());
            request.status = REQUEST_REJECTED;
            (request.borrower, request.collateral_amount)
        };

        if (collateral_amount > 0) {
            treasury::release_lend_collateral(borrower, collateral_amount);
            event::emit(CollateralReleasedEvent {
                loan_id: 0,
                borrower,
                amount: collateral_amount,
                liquidated: false,
            });
        };
    }

    public entry fun cancel_request(borrower: &signer, request_id: u64) acquires LoanBook {
        let borrower_addr = signer::address_of(borrower);
        let collateral_amount = {
            let book = borrow_global_mut<LoanBook>(@lendpay);
            let request_index = find_request_index(book, request_id);
            let request = vector::borrow_mut(&mut book.requests, request_index);

            assert!(request.borrower == borrower_addr, errors::not_borrower());
            assert!(request.status == REQUEST_PENDING, errors::request_not_pending());
            request.status = REQUEST_CANCELLED;
            request.collateral_amount
        };

        if (collateral_amount > 0) {
            treasury::release_lend_collateral(borrower_addr, collateral_amount);
            event::emit(CollateralReleasedEvent {
                loan_id: 0,
                borrower: borrower_addr,
                amount: collateral_amount,
                liquidated: false,
            });
        };
    }

    public entry fun repay_installment(borrower: &signer, loan_id: u64) acquires LoanBook {
        config::assert_not_paused();

        let borrower_addr = signer::address_of(borrower);
        let (
            installment_number,
            installment_amount_paid,
            was_on_time,
            loan_fully_repaid,
            loan_amount,
            collateral_to_release,
        ) = {
            let book = borrow_global_mut<LoanBook>(@lendpay);
            let loan_index = find_loan_index(book, loan_id);
            let loan = vector::borrow_mut(&mut book.loans, loan_index);

            assert!(loan.borrower == borrower_addr, errors::not_borrower());
            assert!(loan.status == LOAN_ACTIVE, errors::loan_not_active());
            assert!(loan.installments_paid < loan.installments_total, errors::invalid_status());

            let now = timestamp::now_seconds();
            let due_at = loan.next_due_at;
            let was_on_time = now <= due_at + loan.grace_period_seconds;

            treasury::record_repayment(borrower, loan.installment_amount);

            loan.installments_paid = loan.installments_paid + 1;
            loan.total_repaid = loan.total_repaid + loan.installment_amount;

            if (loan.installments_paid == loan.installments_total) {
                loan.status = LOAN_REPAID;
                loan.next_due_at = 0;
            } else {
                loan.next_due_at = due_at + SECONDS_PER_MONTH;
            };

            let collateral_to_release =
                if (loan.status == LOAN_REPAID && loan.collateral_amount > 0 && loan.collateral_state == COLLATERAL_LOCKED) {
                    loan.collateral_state = COLLATERAL_RETURNED;
                    loan.collateral_amount
                } else {
                    0
                };

            (
                loan.installments_paid,
                loan.installment_amount,
                was_on_time,
                loan.status == LOAN_REPAID,
                loan.amount,
                collateral_to_release,
            )
        };

        if (was_on_time) {
            reputation::record_on_time_payment(borrower_addr);
            rewards::reward_on_time_payment(borrower_addr);
            referral::reward_referrer_for_installment(borrower_addr);
        } else {
            reputation::record_late_payment(borrower_addr);
            rewards::reward_late_payment(borrower_addr);
            fee_engine::assess_late_fee(loan_id, borrower_addr, installment_amount_paid);
        };

        if (loan_fully_repaid) {
            reputation::record_full_repayment(borrower_addr);
            rewards::reward_full_repayment(borrower_addr);
            if (collateral_to_release > 0) {
                treasury::release_lend_collateral(borrower_addr, collateral_to_release);
                event::emit(CollateralReleasedEvent {
                    loan_id,
                    borrower: borrower_addr,
                    amount: collateral_to_release,
                    liquidated: false,
                });
            };
            let burn_amount = tokenomics::burn_for_full_repayment(loan_amount);
            if (burn_amount > 0) {
                let _burned = lend_token::burn_from_protocol_reserve(burn_amount);
            };
        };

        event::emit(InstallmentPaidEvent {
            loan_id,
            borrower: borrower_addr,
            installment_number,
            amount: installment_amount_paid,
            was_on_time,
        });
    }

    public entry fun mark_default(admin: &signer, loan_id: u64) acquires LoanBook {
        config::assert_admin(signer::address_of(admin));

        let (borrower, collateral_to_liquidate) = {
            let now = timestamp::now_seconds();
            let book = borrow_global_mut<LoanBook>(@lendpay);
            let loan_index = find_loan_index(book, loan_id);
            let loan = vector::borrow_mut(&mut book.loans, loan_index);

            assert!(loan.status == LOAN_ACTIVE, errors::loan_not_active());
            assert!(
                now >= loan.next_due_at + loan.grace_period_seconds,
                errors::grace_period_not_expired(),
            );

            loan.status = LOAN_DEFAULTED;
            let collateral_to_liquidate =
                if (loan.collateral_amount > 0 && loan.collateral_state == COLLATERAL_LOCKED) {
                    loan.collateral_state = COLLATERAL_LIQUIDATED;
                    loan.collateral_amount
                } else {
                    0
                };
            (loan.borrower, collateral_to_liquidate)
        };

        reputation::record_default(borrower);
        rewards::penalize_default(borrower);
        referral::mark_referral_default(borrower);
        if (collateral_to_liquidate > 0) {
            treasury::liquidate_lend_collateral(collateral_to_liquidate);
            event::emit(CollateralReleasedEvent {
                loan_id,
                borrower,
                amount: collateral_to_liquidate,
                liquidated: true,
            });
        };

        event::emit(LoanDefaultedEvent {
            loan_id,
            borrower,
        });
    }

    #[view]
    public fun get_request(request_id: u64): LoanRequest acquires LoanBook {
        let book = borrow_global<LoanBook>(@lendpay);
        let request_index = find_request_index_ref(book, request_id);
        *vector::borrow(&book.requests, request_index)
    }

    #[view]
    public fun get_loan(loan_id: u64): Loan acquires LoanBook {
        let book = borrow_global<LoanBook>(@lendpay);
        let loan_index = find_loan_index_ref(book, loan_id);
        *vector::borrow(&book.loans, loan_index)
    }

    #[view]
    public fun next_request_id(): u64 acquires LoanBook {
        borrow_global<LoanBook>(@lendpay).next_request_id
    }

    #[view]
    public fun next_loan_id(): u64 acquires LoanBook {
        borrow_global<LoanBook>(@lendpay).next_loan_id
    }

    #[view]
    public fun request_profile_id(request_id: u64): u8 acquires LoanBook {
        get_request(request_id).profile_id
    }

    #[view]
    public fun request_collateral_amount(request_id: u64): u64 acquires LoanBook {
        get_request(request_id).collateral_amount
    }

    #[view]
    public fun request_status(request_id: u64): u8 acquires LoanBook {
        get_request(request_id).status
    }

    #[view]
    public fun loan_borrower(loan_id: u64): address acquires LoanBook {
        get_loan(loan_id).borrower
    }

    #[view]
    public fun loan_status(loan_id: u64): u8 acquires LoanBook {
        get_loan(loan_id).status
    }

    #[view]
    public fun loan_profile_id(loan_id: u64): u8 acquires LoanBook {
        get_loan(loan_id).profile_id
    }

    #[view]
    public fun loan_collateral_amount(loan_id: u64): u64 acquires LoanBook {
        get_loan(loan_id).collateral_amount
    }

    #[view]
    public fun loan_collateral_state(loan_id: u64): u8 acquires LoanBook {
        get_loan(loan_id).collateral_state
    }

    #[view]
    public fun loan_apr_bps(loan_id: u64): u64 acquires LoanBook {
        get_loan(loan_id).apr_bps
    }

    #[view]
    public fun loan_is_active(loan_id: u64): bool acquires LoanBook {
        loan_status(loan_id) == LOAN_ACTIVE
    }

    #[view]
    public fun loan_is_repaid(loan_id: u64): bool acquires LoanBook {
        loan_status(loan_id) == LOAN_REPAID
    }

    #[view]
    public fun active_loan_id_of(user: address): u64 acquires LoanBook {
        let book = borrow_global<LoanBook>(@lendpay);
        let loan_len = vector::length(&book.loans);
        let loan_index = 0;
        let latest_loan_id = 0;

        while (loan_index < loan_len) {
            let loan = vector::borrow(&book.loans, loan_index);
            if (loan.borrower == user && loan.status == LOAN_ACTIVE) {
                latest_loan_id = loan.id;
            };
            loan_index = loan_index + 1;
        };

        assert!(latest_loan_id > 0, errors::loan_not_found());
        latest_loan_id
    }

    #[view]
    public fun locked_collateral_of(user: address): u64 acquires LoanBook {
        let book = borrow_global<LoanBook>(@lendpay);
        let total = 0;

        let request_len = vector::length(&book.requests);
        let request_index = 0;
        while (request_index < request_len) {
            let request = vector::borrow(&book.requests, request_index);
            if (
                request.borrower == user &&
                request.status == REQUEST_PENDING &&
                request.collateral_amount > 0
            ) {
                total = total + request.collateral_amount;
            };
            request_index = request_index + 1;
        };

        let loan_len = vector::length(&book.loans);
        let loan_index = 0;
        while (loan_index < loan_len) {
            let loan = vector::borrow(&book.loans, loan_index);
            if (
                loan.borrower == user &&
                loan.status == LOAN_ACTIVE &&
                loan.collateral_state == COLLATERAL_LOCKED
            ) {
                total = total + loan.collateral_amount;
            };
            loan_index = loan_index + 1;
        };

        total
    }

    #[test_only]
    public fun force_loan_due_for_testing(admin: &signer, loan_id: u64) acquires LoanBook {
        config::assert_admin(signer::address_of(admin));
        let book = borrow_global_mut<LoanBook>(@lendpay);
        let loan_index = find_loan_index(book, loan_id);
        let loan = vector::borrow_mut(&mut book.loans, loan_index);
        loan.next_due_at = 0;
        loan.grace_period_seconds = 0;
    }

    fun assert_request_terms(amount: u64, tenor_months: u8) {
        config::assert_not_paused();
        assert!(amount > 0, errors::invalid_amount());
        assert!(
            tenor_months > 0 && tenor_months <= config::max_tenor_months(),
            errors::invalid_tenor(),
        );
    }

    fun find_request_index(book: &LoanBook, request_id: u64): u64 {
        let len = vector::length(&book.requests);
        let i = 0;

        while (i < len) {
            if (vector::borrow(&book.requests, i).id == request_id) {
                return i
            };
            i = i + 1;
        };

        abort errors::request_not_found()
    }

    fun find_request_index_ref(book: &LoanBook, request_id: u64): u64 {
        find_request_index(book, request_id)
    }

    fun find_loan_index(book: &LoanBook, loan_id: u64): u64 {
        let len = vector::length(&book.loans);
        let i = 0;

        while (i < len) {
            if (vector::borrow(&book.loans, i).id == loan_id) {
                return i
            };
            i = i + 1;
        };

        abort errors::loan_not_found()
    }

    fun find_loan_index_ref(book: &LoanBook, loan_id: u64): u64 {
        find_loan_index(book, loan_id)
    }
}
