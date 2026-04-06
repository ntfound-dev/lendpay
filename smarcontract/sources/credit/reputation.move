module lendpay::reputation {
    use std::signer;
    use std::timestamp;
    use std::vector;
    use lendpay::config;
    use lendpay::errors;

    friend lendpay::loan_book;

    struct ReputationEntry has copy, drop, store {
        user: address,
        loans_requested: u64,
        loans_approved: u64,
        loans_repaid: u64,
        loans_defaulted: u64,
        on_time_payments: u64,
        late_payments: u64,
        username_hash: vector<u8>,
        username_verified: bool,
        last_updated: u64,
    }

    struct ReputationRegistry has key {
        entries: vector<ReputationEntry>,
    }

    public entry fun initialize(admin: &signer) {
        config::assert_admin(signer::address_of(admin));
        assert!(!exists<ReputationRegistry>(@lendpay), errors::already_initialized());
        move_to(admin, ReputationRegistry { entries: vector::empty() });
    }

    public entry fun attest_username(
        admin: &signer,
        user: address,
        username_hash: vector<u8>,
    ) acquires ReputationRegistry {
        config::assert_admin(signer::address_of(admin));
        assert!(vector::length(&username_hash) > 0, errors::username_required());

        let registry = borrow_global_mut<ReputationRegistry>(@lendpay);
        let entry = borrow_or_create_entry_in_registry(registry, user);
        entry.username_hash = username_hash;
        entry.username_verified = true;
        entry.last_updated = timestamp::now_seconds();
    }

    public(friend) fun record_request(user: address) acquires ReputationRegistry {
        let registry = borrow_global_mut<ReputationRegistry>(@lendpay);
        let entry = borrow_or_create_entry_in_registry(registry, user);
        entry.loans_requested = entry.loans_requested + 1;
        entry.last_updated = timestamp::now_seconds();
    }

    public(friend) fun record_approval(user: address) acquires ReputationRegistry {
        let registry = borrow_global_mut<ReputationRegistry>(@lendpay);
        let entry = borrow_or_create_entry_in_registry(registry, user);
        entry.loans_approved = entry.loans_approved + 1;
        entry.last_updated = timestamp::now_seconds();
    }

    public(friend) fun record_on_time_payment(user: address) acquires ReputationRegistry {
        let registry = borrow_global_mut<ReputationRegistry>(@lendpay);
        let entry = borrow_or_create_entry_in_registry(registry, user);
        entry.on_time_payments = entry.on_time_payments + 1;
        entry.last_updated = timestamp::now_seconds();
    }

    public(friend) fun record_late_payment(user: address) acquires ReputationRegistry {
        let registry = borrow_global_mut<ReputationRegistry>(@lendpay);
        let entry = borrow_or_create_entry_in_registry(registry, user);
        entry.late_payments = entry.late_payments + 1;
        entry.last_updated = timestamp::now_seconds();
    }

    public(friend) fun record_full_repayment(user: address) acquires ReputationRegistry {
        let registry = borrow_global_mut<ReputationRegistry>(@lendpay);
        let entry = borrow_or_create_entry_in_registry(registry, user);
        entry.loans_repaid = entry.loans_repaid + 1;
        entry.last_updated = timestamp::now_seconds();
    }

    public(friend) fun record_default(user: address) acquires ReputationRegistry {
        let registry = borrow_global_mut<ReputationRegistry>(@lendpay);
        let entry = borrow_or_create_entry_in_registry(registry, user);
        entry.loans_defaulted = entry.loans_defaulted + 1;
        entry.last_updated = timestamp::now_seconds();
    }

    #[view]
    public fun get_entry(user: address): ReputationEntry acquires ReputationRegistry {
        let registry = borrow_global<ReputationRegistry>(@lendpay);
        let len = vector::length(&registry.entries);
        let i = 0;

        while (i < len) {
            let entry = vector::borrow(&registry.entries, i);
            if (entry.user == user) {
                return *entry
            };
            i = i + 1;
        };

        ReputationEntry {
            user,
            loans_requested: 0,
            loans_approved: 0,
            loans_repaid: 0,
            loans_defaulted: 0,
            on_time_payments: 0,
            late_payments: 0,
            username_hash: x"",
            username_verified: false,
            last_updated: 0,
        }
    }

    #[view]
    public fun has_verified_username(user: address): bool acquires ReputationRegistry {
        get_entry(user).username_verified
    }

    #[view]
    public fun username_hash_of(user: address): vector<u8> acquires ReputationRegistry {
        get_entry(user).username_hash
    }

    #[view]
    public fun platform_actions_of(user: address): u64 acquires ReputationRegistry {
        let entry = get_entry(user);
        entry.loans_requested +
            entry.loans_approved +
            entry.loans_repaid +
            entry.on_time_payments +
            entry.late_payments
    }

    #[view]
    public fun loans_requested_of(user: address): u64 acquires ReputationRegistry {
        get_entry(user).loans_requested
    }

    #[view]
    public fun loans_approved_of(user: address): u64 acquires ReputationRegistry {
        get_entry(user).loans_approved
    }

    fun borrow_or_create_entry_in_registry(
        registry: &mut ReputationRegistry,
        user: address,
    ): &mut ReputationEntry {
        let len = vector::length(&registry.entries);
        let i = 0;

        while (i < len) {
            if (vector::borrow(&registry.entries, i).user == user) {
                return vector::borrow_mut(&mut registry.entries, i)
            };
            i = i + 1;
        };

        vector::push_back(
            &mut registry.entries,
            ReputationEntry {
                user,
                loans_requested: 0,
                loans_approved: 0,
                loans_repaid: 0,
                loans_defaulted: 0,
                on_time_payments: 0,
                late_payments: 0,
                username_hash: x"",
                username_verified: false,
                last_updated: 0,
            },
        );

        let new_len = vector::length(&registry.entries);
        vector::borrow_mut(&mut registry.entries, new_len - 1)
    }
}
