module lendpay::referral {
    use std::bcs;
    use std::event;
    use std::signer;
    use std::string::{Self, String};
    use std::timestamp;
    use std::vector;
    use initia_std::hex;
    use lendpay::config;
    use lendpay::errors;
    use lendpay::reputation;
    use lendpay::rewards;

    friend lendpay::loan_book;

    const STATUS_PENDING: u8 = 0;
    const STATUS_ACTIVE: u8 = 1;
    const STATUS_DEFAULTED: u8 = 2;

    const FIRST_LOAN_REWARD_POINTS: u64 = 50;
    const INSTALLMENT_REWARD_POINTS: u64 = 20;

    struct ReferralRecord has copy, drop, store {
        owner: address,
        code: String,
        referred_by: address,
        has_referrer: bool,
        total_referrals: u64,
        active_referrals: u64,
        points_earned: u64,
    }

    struct ReferralLink has copy, drop, store {
        referrer: address,
        referee: address,
        status: u8,
        points_generated: u64,
        joined_at: u64,
        first_loan_rewarded: bool,
    }

    struct ReferralRegistry has key {
        records: vector<ReferralRecord>,
        links: vector<ReferralLink>,
    }

    #[event]
    struct ReferralApplied has drop, store {
        referrer: address,
        referee: address,
        code: String,
        timestamp: u64,
    }

    #[event]
    struct ReferralRewarded has drop, store {
        referrer: address,
        referee: address,
        points: u64,
        reason: String,
    }

    public entry fun initialize(admin: &signer) {
        config::assert_admin(signer::address_of(admin));
        assert!(!exists<ReferralRegistry>(@lendpay), errors::already_initialized());
        move_to(admin, ReferralRegistry {
            records: vector::empty(),
            links: vector::empty(),
        });
    }

    public entry fun generate_code(sender: &signer) acquires ReferralRegistry {
        config::assert_not_paused();
        let owner = signer::address_of(sender);
        let registry = borrow_global_mut<ReferralRegistry>(@lendpay);
        let _record = borrow_or_create_record_in_registry(registry, owner);
    }

    public entry fun apply_code(sender: &signer, code: String) acquires ReferralRegistry {
        config::assert_not_paused();

        let referee = signer::address_of(sender);
        assert!(
            reputation::loans_requested_of(referee) == 0 &&
            reputation::loans_approved_of(referee) == 0,
            errors::referral_window_closed(),
        );

        let registry = borrow_global_mut<ReferralRegistry>(@lendpay);
        {
            let record = borrow_or_create_record_in_registry(registry, referee);
            assert!(!record.has_referrer, errors::referral_already_applied());
        };

        let referrer_index = find_record_index_by_code(registry, copy code);
        let referrer = vector::borrow(&registry.records, referrer_index).owner;
        assert!(referrer != referee, errors::self_referral_not_allowed());

        {
            let record = borrow_or_create_record_in_registry(registry, referee);
            record.referred_by = referrer;
            record.has_referrer = true;
        };

        {
            let referrer_record = borrow_or_create_record_in_registry(registry, referrer);
            referrer_record.total_referrals = referrer_record.total_referrals + 1;
        };

        vector::push_back(
            &mut registry.links,
            ReferralLink {
                referrer,
                referee,
                status: STATUS_PENDING,
                points_generated: 0,
                joined_at: timestamp::now_seconds(),
                first_loan_rewarded: false,
            },
        );

        event::emit(ReferralApplied {
            referrer,
            referee,
            code,
            timestamp: timestamp::now_seconds(),
        });
    }

    public entry fun reward_referrer(
        admin: &signer,
        referee: address,
        reason: String,
    ) acquires ReferralRegistry {
        config::assert_admin(signer::address_of(admin));

        if (reason == string::utf8(b"first_loan")) {
            reward_first_loan_internal(referee);
        } else {
            reward_installment_internal(referee);
        };
    }

    public(friend) fun reward_referrer_for_first_loan(referee: address) acquires ReferralRegistry {
        reward_first_loan_internal(referee);
    }

    public(friend) fun reward_referrer_for_installment(referee: address) acquires ReferralRegistry {
        reward_installment_internal(referee);
    }

    public(friend) fun mark_referral_default(referee: address) acquires ReferralRegistry {
        if (!exists<ReferralRegistry>(@lendpay)) {
            return
        };

        let registry = borrow_global_mut<ReferralRegistry>(@lendpay);
        let link_index = find_link_index_if_exists(registry, referee);
        let missing = vector::length(&registry.links);
        if (link_index == missing) {
            return
        };

        let (referrer, status) = {
            let link = vector::borrow(&registry.links, link_index);
            (link.referrer, link.status)
        };
        if (status == STATUS_DEFAULTED) {
            return
        };

        if (status == STATUS_ACTIVE) {
            let referrer_record = borrow_or_create_record_in_registry(registry, referrer);
            if (referrer_record.active_referrals > 0) {
                referrer_record.active_referrals = referrer_record.active_referrals - 1;
            };
        };

        let link = vector::borrow_mut(&mut registry.links, link_index);
        link.status = STATUS_DEFAULTED;
    }

    #[view]
    public fun get_referral_code(user: address): String acquires ReferralRegistry {
        if (!exists<ReferralRegistry>(@lendpay)) {
            return generate_code_for(user)
        };

        let registry = borrow_global<ReferralRegistry>(@lendpay);
        let record_index = find_record_index_if_exists(registry, user);
        let missing = vector::length(&registry.records);

        if (record_index == missing) {
            return generate_code_for(user)
        };

        let record = *vector::borrow(&registry.records, record_index);
        record.code
    }

    #[view]
    public fun get_referral_stats(user: address): (u64, u64, u64) acquires ReferralRegistry {
        if (!exists<ReferralRegistry>(@lendpay)) {
            return (0, 0, 0)
        };

        let registry = borrow_global<ReferralRegistry>(@lendpay);
        let record_index = find_record_index_if_exists(registry, user);
        let missing = vector::length(&registry.records);

        if (record_index == missing) {
            return (0, 0, 0)
        };

        let record = vector::borrow(&registry.records, record_index);
        (
            record.total_referrals,
            record.active_referrals,
            record.points_earned,
        )
    }

    fun reward_first_loan_internal(referee: address) acquires ReferralRegistry {
        reward_referrer_points(
            referee,
            FIRST_LOAN_REWARD_POINTS,
            true,
            string::utf8(b"first_loan"),
        );
    }

    fun reward_installment_internal(referee: address) acquires ReferralRegistry {
        reward_referrer_points(
            referee,
            INSTALLMENT_REWARD_POINTS,
            false,
            string::utf8(b"installment"),
        );
    }

    fun reward_referrer_points(
        referee: address,
        points: u64,
        mark_first_loan: bool,
        reason: String,
    ) acquires ReferralRegistry {
        if (!exists<ReferralRegistry>(@lendpay)) {
            return
        };

        let registry = borrow_global_mut<ReferralRegistry>(@lendpay);
        let link_index = find_link_index_if_exists(registry, referee);
        let missing = vector::length(&registry.links);
        if (link_index == missing) {
            return
        };

        let (referrer, should_activate_referral) = {
            let link = vector::borrow(&registry.links, link_index);
            if (mark_first_loan && link.first_loan_rewarded) {
                return
            };
            if (link.status == STATUS_DEFAULTED) {
                return
            };
            (
                link.referrer,
                mark_first_loan && link.status == STATUS_PENDING,
            )
        };

        {
            let link = vector::borrow_mut(&mut registry.links, link_index);
            if (mark_first_loan) {
                link.first_loan_rewarded = true;
                if (should_activate_referral) {
                    link.status = STATUS_ACTIVE;
                };
            };
            link.points_generated = link.points_generated + points;
        };

        {
            let referrer_record = borrow_or_create_record_in_registry(registry, referrer);
            if (should_activate_referral) {
                referrer_record.active_referrals = referrer_record.active_referrals + 1;
            };
            referrer_record.points_earned = referrer_record.points_earned + points;
        };

        rewards::reward_referral(referrer, points);

        event::emit(ReferralRewarded {
            referrer,
            referee,
            points,
            reason,
        });
    }

    fun generate_code_for(owner: address): String {
        let code = string::utf8(b"LEND");
        string::append(&mut code, hex::encode_to_string(&bcs::to_bytes(&owner)));
        code
    }

    fun borrow_or_create_record_in_registry(
        registry: &mut ReferralRegistry,
        user: address,
    ): &mut ReferralRecord {
        let len = vector::length(&registry.records);
        let i = 0;

        while (i < len) {
            if (vector::borrow(&registry.records, i).owner == user) {
                return vector::borrow_mut(&mut registry.records, i)
            };
            i = i + 1;
        };

        vector::push_back(
            &mut registry.records,
            ReferralRecord {
                owner: user,
                code: generate_code_for(user),
                referred_by: @0x0,
                has_referrer: false,
                total_referrals: 0,
                active_referrals: 0,
                points_earned: 0,
            },
        );

        let new_len = vector::length(&registry.records);
        vector::borrow_mut(&mut registry.records, new_len - 1)
    }

    fun find_record_index_by_code(registry: &ReferralRegistry, code: String): u64 {
        let len = vector::length(&registry.records);
        let i = 0;

        while (i < len) {
            if (vector::borrow(&registry.records, i).code == code) {
                return i
            };
            i = i + 1;
        };

        abort errors::referral_code_not_found()
    }

    fun find_record_index_if_exists(registry: &ReferralRegistry, user: address): u64 {
        let len = vector::length(&registry.records);
        let i = 0;

        while (i < len) {
            if (vector::borrow(&registry.records, i).owner == user) {
                return i
            };
            i = i + 1;
        };

        len
    }

    fun find_link_index_if_exists(registry: &ReferralRegistry, referee: address): u64 {
        let len = vector::length(&registry.links);
        let i = 0;

        while (i < len) {
            if (vector::borrow(&registry.links, i).referee == referee) {
                return i
            };
            i = i + 1;
        };

        len
    }
}
