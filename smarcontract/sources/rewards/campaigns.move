module lendpay::campaigns {
    use std::event;
    use std::signer;
    use std::vector;
    use lendpay::config;
    use lendpay::errors;
    use lendpay::lend_token;
    use lendpay::reputation;

    const CAMPAIGN_OPEN: u8 = 0;
    const CAMPAIGN_CLOSED: u8 = 1;

    struct Campaign has copy, drop, store {
        id: u64,
        phase: u8,
        total_allocation: u64,
        total_claimed: u64,
        requires_username: bool,
        minimum_platform_actions: u64,
        status: u8,
    }

    struct ClaimAllocation has copy, drop, store {
        campaign_id: u64,
        user: address,
        amount: u64,
        claimed: bool,
    }

    struct CampaignRegistry has key {
        next_campaign_id: u64,
        campaigns: vector<Campaign>,
        allocations: vector<ClaimAllocation>,
    }

    #[event]
    struct CampaignCreatedEvent has drop, store {
        campaign_id: u64,
        phase: u8,
        total_allocation: u64,
    }

    #[event]
    struct CampaignClaimedEvent has drop, store {
        campaign_id: u64,
        user: address,
        amount: u64,
    }

    #[event]
    struct CampaignClosedEvent has drop, store {
        campaign_id: u64,
    }

    public entry fun initialize(admin: &signer) {
        config::assert_admin(signer::address_of(admin));
        assert!(!exists<CampaignRegistry>(@lendpay), errors::already_initialized());

        move_to(admin, CampaignRegistry {
            next_campaign_id: 1,
            campaigns: vector::empty(),
            allocations: vector::empty(),
        });
    }

    public entry fun create_campaign(
        admin: &signer,
        phase: u8,
        total_allocation: u64,
        requires_username: bool,
        minimum_platform_actions: u64,
    ) acquires CampaignRegistry {
        config::assert_admin(signer::address_of(admin));
        assert!(total_allocation > 0, errors::invalid_amount());

        let registry = borrow_global_mut<CampaignRegistry>(@lendpay);
        let campaign_id = registry.next_campaign_id;
        registry.next_campaign_id = campaign_id + 1;

        vector::push_back(
            &mut registry.campaigns,
            Campaign {
                id: campaign_id,
                phase,
                total_allocation,
                total_claimed: 0,
                requires_username,
                minimum_platform_actions,
                status: CAMPAIGN_OPEN,
            },
        );

        event::emit(CampaignCreatedEvent {
            campaign_id,
            phase,
            total_allocation,
        });
    }

    public entry fun allocate_claim(
        admin: &signer,
        campaign_id: u64,
        user: address,
        amount: u64,
    ) acquires CampaignRegistry {
        config::assert_admin(signer::address_of(admin));
        assert!(amount > 0, errors::invalid_amount());

        let registry = borrow_global_mut<CampaignRegistry>(@lendpay);
        let campaign_index = find_campaign_index(registry, campaign_id);
        let campaign = vector::borrow(&registry.campaigns, campaign_index);
        assert!(campaign.status == CAMPAIGN_OPEN, errors::invalid_status());
        assert!(
            !has_unclaimed_allocation(registry, campaign_id, user),
            errors::duplicate_claim_allocation(),
        );
        assert!(
            allocated_amount_for_campaign(registry, campaign_id) + amount <= campaign.total_allocation,
            errors::invalid_policy(),
        );

        vector::push_back(
            &mut registry.allocations,
            ClaimAllocation {
                campaign_id,
                user,
                amount,
                claimed: false,
            },
        );
    }

    public entry fun close_campaign(admin: &signer, campaign_id: u64) acquires CampaignRegistry {
        config::assert_admin(signer::address_of(admin));

        let registry = borrow_global_mut<CampaignRegistry>(@lendpay);
        let campaign_index = find_campaign_index(registry, campaign_id);
        vector::borrow_mut(&mut registry.campaigns, campaign_index).status = CAMPAIGN_CLOSED;

        event::emit(CampaignClosedEvent { campaign_id });
    }

    public entry fun claim_campaign(user: &signer, campaign_id: u64) acquires CampaignRegistry {
        config::assert_not_paused();

        let user_addr = signer::address_of(user);
        let amount = {
            let registry = borrow_global_mut<CampaignRegistry>(@lendpay);
            let allocation_index = find_unclaimed_allocation_index(registry, campaign_id, user_addr);
            let amount = {
                let allocation = vector::borrow_mut(&mut registry.allocations, allocation_index);
                assert!(!allocation.claimed, errors::already_claimed());
                allocation.claimed = true;
                allocation.amount
            };

            let campaign_index = find_campaign_index(registry, campaign_id);
            let campaign = vector::borrow_mut(&mut registry.campaigns, campaign_index);
            assert!(campaign.status == CAMPAIGN_OPEN, errors::invalid_status());
            assert!(
                !campaign.requires_username || reputation::has_verified_username(user_addr),
                errors::username_required(),
            );
            assert!(
                reputation::platform_actions_of(user_addr) >= campaign.minimum_platform_actions,
                errors::insufficient_platform_activity(),
            );
            campaign.total_claimed = campaign.total_claimed + amount;
            amount
        };

        lend_token::distribute_from_protocol(user_addr, amount);

        event::emit(CampaignClaimedEvent {
            campaign_id,
            user: user_addr,
            amount,
        });
    }

    #[view]
    public fun get_campaign(campaign_id: u64): Campaign acquires CampaignRegistry {
        let registry = borrow_global<CampaignRegistry>(@lendpay);
        let index = find_campaign_index_ref(registry, campaign_id);
        *vector::borrow(&registry.campaigns, index)
    }

    #[view]
    public fun next_campaign_id(): u64 acquires CampaignRegistry {
        borrow_global<CampaignRegistry>(@lendpay).next_campaign_id
    }

    #[view]
    public fun claimable_amount(campaign_id: u64, user: address): u64 acquires CampaignRegistry {
        let registry = borrow_global<CampaignRegistry>(@lendpay);
        let len = vector::length(&registry.allocations);
        let i = 0;

        while (i < len) {
            let allocation = vector::borrow(&registry.allocations, i);
            if (allocation.campaign_id == campaign_id && allocation.user == user && !allocation.claimed) {
                return allocation.amount
            };
            i = i + 1;
        };

        0
    }

    #[view]
    public fun can_claim(user: address, campaign_id: u64): bool acquires CampaignRegistry {
        let campaign = get_campaign(campaign_id);
        if (campaign.status != CAMPAIGN_OPEN) {
            return false
        };
        if (campaign.requires_username && !reputation::has_verified_username(user)) {
            return false
        };
        if (reputation::platform_actions_of(user) < campaign.minimum_platform_actions) {
            return false
        };

        claimable_amount(campaign_id, user) > 0
    }

    fun find_campaign_index(registry: &CampaignRegistry, campaign_id: u64): u64 {
        let len = vector::length(&registry.campaigns);
        let i = 0;

        while (i < len) {
            if (vector::borrow(&registry.campaigns, i).id == campaign_id) {
                return i
            };
            i = i + 1;
        };

        abort errors::campaign_not_found()
    }

    fun find_campaign_index_ref(registry: &CampaignRegistry, campaign_id: u64): u64 {
        find_campaign_index(registry, campaign_id)
    }

    fun allocated_amount_for_campaign(registry: &CampaignRegistry, campaign_id: u64): u64 {
        let len = vector::length(&registry.allocations);
        let i = 0;
        let total = 0;

        while (i < len) {
            let allocation = vector::borrow(&registry.allocations, i);
            if (allocation.campaign_id == campaign_id) {
                total = total + allocation.amount;
            };
            i = i + 1;
        };

        total
    }

    fun find_unclaimed_allocation_index(registry: &CampaignRegistry, campaign_id: u64, user: address): u64 {
        let len = vector::length(&registry.allocations);
        let i = 0;

        while (i < len) {
            let allocation = vector::borrow(&registry.allocations, i);
            if (allocation.campaign_id == campaign_id && allocation.user == user && !allocation.claimed) {
                return i
            };
            i = i + 1;
        };

        abort errors::claim_not_found()
    }

    fun has_unclaimed_allocation(registry: &CampaignRegistry, campaign_id: u64, user: address): bool {
        let len = vector::length(&registry.allocations);
        let i = 0;

        while (i < len) {
            let allocation = vector::borrow(&registry.allocations, i);
            if (allocation.campaign_id == campaign_id && allocation.user == user && !allocation.claimed) {
                return true
            };
            i = i + 1;
        };

        false
    }
}
