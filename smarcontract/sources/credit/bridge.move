module lendpay::bridge {
    use std::event;
    use std::signer;
    use std::string::{Self, String};
    use std::timestamp;
    use std::vector;
    use lendpay::config;
    use lendpay::errors;

    const TRANSFER_METHOD_IBC_HOOKS: u8 = 1;

    const LIQUIDITY_STATUS_UNKNOWN: u8 = 0;
    const LIQUIDITY_STATUS_COMING_SOON: u8 = 1;
    const LIQUIDITY_STATUS_LIVE: u8 = 2;
    const LIQUIDITY_STATUS_PAUSED: u8 = 3;

    const INTENT_PENDING: u8 = 0;
    const INTENT_COMPLETED: u8 = 1;
    const INTENT_CANCELLED: u8 = 2;
    const INTENT_FAILED: u8 = 3;

    struct BridgeRoute has copy, drop, store {
        id: u64,
        source_chain_id: String,
        source_denom: String,
        destination_chain_id: String,
        destination_denom: String,
        transfer_method: u8,
        active: bool,
        mapping_published: bool,
        destination_asset_reference: String,
        liquidity_venue: String,
        pool_reference: String,
        liquidity_status: u8,
        swap_enabled: bool,
        notes: String,
        created_at: u64,
        updated_at: u64,
    }

    struct BridgeIntent has copy, drop, store {
        id: u64,
        route_id: u64,
        requester: address,
        amount: u64,
        recipient: String,
        status: u8,
        settlement_reference: String,
        note: String,
        opened_at: u64,
        updated_at: u64,
    }

    struct BridgeRegistry has key {
        next_route_id: u64,
        next_intent_id: u64,
        routes: vector<BridgeRoute>,
        intents: vector<BridgeIntent>,
    }

    #[event]
    struct BridgeRouteRegisteredEvent has drop, store {
        route_id: u64,
        source_chain_id: String,
        destination_chain_id: String,
        transfer_method: u8,
        active: bool,
        mapping_published: bool,
        liquidity_venue: String,
        liquidity_status: u8,
        swap_enabled: bool,
    }

    #[event]
    struct BridgeRouteStatusUpdatedEvent has drop, store {
        route_id: u64,
        active: bool,
        mapping_published: bool,
        destination_asset_reference: String,
    }

    #[event]
    struct BridgeRouteLiquidityUpdatedEvent has drop, store {
        route_id: u64,
        liquidity_venue: String,
        pool_reference: String,
        liquidity_status: u8,
        swap_enabled: bool,
    }

    #[event]
    struct BridgeIntentOpenedEvent has drop, store {
        intent_id: u64,
        route_id: u64,
        requester: address,
        amount: u64,
        recipient: String,
    }

    #[event]
    struct BridgeIntentResolvedEvent has drop, store {
        intent_id: u64,
        route_id: u64,
        requester: address,
        successful: bool,
        settlement_reference: String,
    }

    #[event]
    struct BridgeIntentCancelledEvent has drop, store {
        intent_id: u64,
        route_id: u64,
        requester: address,
    }

    public entry fun initialize(admin: &signer) {
        config::assert_admin(signer::address_of(admin));
        assert!(!exists<BridgeRegistry>(@lendpay), errors::already_initialized());

        move_to(admin, BridgeRegistry {
            next_route_id: 1,
            next_intent_id: 1,
            routes: vector::empty(),
            intents: vector::empty(),
        });
    }

    public entry fun register_route(
        admin: &signer,
        source_chain_id: String,
        source_denom: String,
        destination_chain_id: String,
        destination_denom: String,
        transfer_method: u8,
        active: bool,
        mapping_published: bool,
        destination_asset_reference: String,
        liquidity_venue: String,
        pool_reference: String,
        liquidity_status: u8,
        swap_enabled: bool,
        notes: String,
    ) acquires BridgeRegistry {
        config::assert_admin(signer::address_of(admin));
        config::assert_not_paused();
        assert_supported_transfer_method(transfer_method);
        assert_supported_liquidity_status(liquidity_status);

        let now = timestamp::now_seconds();
        let registry = borrow_global_mut<BridgeRegistry>(@lendpay);
        let route_id = registry.next_route_id;
        registry.next_route_id = route_id + 1;

        vector::push_back(
            &mut registry.routes,
            BridgeRoute {
                id: route_id,
                source_chain_id,
                source_denom,
                destination_chain_id,
                destination_denom,
                transfer_method,
                active,
                mapping_published,
                destination_asset_reference,
                liquidity_venue,
                pool_reference,
                liquidity_status,
                swap_enabled,
                notes,
                created_at: now,
                updated_at: now,
            },
        );

        let route = vector::borrow(&registry.routes, vector::length(&registry.routes) - 1);
        event::emit(BridgeRouteRegisteredEvent {
            route_id,
            source_chain_id: route.source_chain_id,
            destination_chain_id: route.destination_chain_id,
            transfer_method: route.transfer_method,
            active: route.active,
            mapping_published: route.mapping_published,
            liquidity_venue: route.liquidity_venue,
            liquidity_status: route.liquidity_status,
            swap_enabled: route.swap_enabled,
        });
    }

    public entry fun update_route_status(
        admin: &signer,
        route_id: u64,
        active: bool,
        mapping_published: bool,
        destination_asset_reference: String,
        notes: String,
    ) acquires BridgeRegistry {
        config::assert_admin(signer::address_of(admin));
        config::assert_not_paused();

        let registry = borrow_global_mut<BridgeRegistry>(@lendpay);
        let route_index = find_route_index(registry, route_id);
        let route = vector::borrow_mut(&mut registry.routes, route_index);
        route.active = active;
        route.mapping_published = mapping_published;
        route.destination_asset_reference = destination_asset_reference;
        route.notes = notes;
        route.updated_at = timestamp::now_seconds();

        event::emit(BridgeRouteStatusUpdatedEvent {
            route_id,
            active: route.active,
            mapping_published: route.mapping_published,
            destination_asset_reference: route.destination_asset_reference,
        });
    }

    public entry fun update_route_liquidity(
        admin: &signer,
        route_id: u64,
        liquidity_venue: String,
        pool_reference: String,
        liquidity_status: u8,
        swap_enabled: bool,
    ) acquires BridgeRegistry {
        config::assert_admin(signer::address_of(admin));
        config::assert_not_paused();
        assert_supported_liquidity_status(liquidity_status);

        let registry = borrow_global_mut<BridgeRegistry>(@lendpay);
        let route_index = find_route_index(registry, route_id);
        let route = vector::borrow_mut(&mut registry.routes, route_index);
        route.liquidity_venue = liquidity_venue;
        route.pool_reference = pool_reference;
        route.liquidity_status = liquidity_status;
        route.swap_enabled = swap_enabled;
        route.updated_at = timestamp::now_seconds();

        event::emit(BridgeRouteLiquidityUpdatedEvent {
            route_id,
            liquidity_venue: route.liquidity_venue,
            pool_reference: route.pool_reference,
            liquidity_status: route.liquidity_status,
            swap_enabled: route.swap_enabled,
        });
    }

    public entry fun open_bridge_intent(
        requester: &signer,
        route_id: u64,
        amount: u64,
        recipient: String,
    ) acquires BridgeRegistry {
        config::assert_not_paused();
        assert!(amount > 0, errors::invalid_amount());

        let requester_addr = signer::address_of(requester);
        let now = timestamp::now_seconds();
        let registry = borrow_global_mut<BridgeRegistry>(@lendpay);
        let route_index = find_route_index(registry, route_id);
        let route = vector::borrow(&registry.routes, route_index);
        assert!(route.active && route.mapping_published, errors::bridge_route_not_live());

        let intent_id = registry.next_intent_id;
        registry.next_intent_id = intent_id + 1;

        vector::push_back(
            &mut registry.intents,
            BridgeIntent {
                id: intent_id,
                route_id,
                requester: requester_addr,
                amount,
                recipient,
                status: INTENT_PENDING,
                settlement_reference: empty_string(),
                note: empty_string(),
                opened_at: now,
                updated_at: now,
            },
        );

        let intent = vector::borrow(&registry.intents, vector::length(&registry.intents) - 1);
        event::emit(BridgeIntentOpenedEvent {
            intent_id,
            route_id,
            requester: requester_addr,
            amount,
            recipient: intent.recipient,
        });
    }

    public entry fun cancel_bridge_intent(
        requester: &signer,
        intent_id: u64,
    ) acquires BridgeRegistry {
        config::assert_not_paused();

        let requester_addr = signer::address_of(requester);
        let registry = borrow_global_mut<BridgeRegistry>(@lendpay);
        let intent_index = find_intent_index(registry, intent_id);
        let intent = vector::borrow_mut(&mut registry.intents, intent_index);
        assert!(intent.requester == requester_addr, errors::not_borrower());
        assert!(intent.status == INTENT_PENDING, errors::bridge_intent_not_pending());

        intent.status = INTENT_CANCELLED;
        intent.updated_at = timestamp::now_seconds();

        event::emit(BridgeIntentCancelledEvent {
            intent_id,
            route_id: intent.route_id,
            requester: requester_addr,
        });
    }

    public entry fun resolve_bridge_intent(
        admin: &signer,
        intent_id: u64,
        successful: bool,
        settlement_reference: String,
        note: String,
    ) acquires BridgeRegistry {
        config::assert_admin(signer::address_of(admin));
        config::assert_not_paused();

        let registry = borrow_global_mut<BridgeRegistry>(@lendpay);
        let intent_index = find_intent_index(registry, intent_id);
        let intent = vector::borrow_mut(&mut registry.intents, intent_index);
        assert!(intent.status == INTENT_PENDING, errors::bridge_intent_not_pending());

        intent.status = if (successful) { INTENT_COMPLETED } else { INTENT_FAILED };
        intent.settlement_reference = settlement_reference;
        intent.note = note;
        intent.updated_at = timestamp::now_seconds();

        event::emit(BridgeIntentResolvedEvent {
            intent_id,
            route_id: intent.route_id,
            requester: intent.requester,
            successful,
            settlement_reference: intent.settlement_reference,
        });
    }

    #[view]
    public fun get_route(route_id: u64): BridgeRoute acquires BridgeRegistry {
        let registry = borrow_global<BridgeRegistry>(@lendpay);
        let route_index = find_route_index_ref(registry, route_id);
        *vector::borrow(&registry.routes, route_index)
    }

    #[view]
    public fun get_intent(intent_id: u64): BridgeIntent acquires BridgeRegistry {
        let registry = borrow_global<BridgeRegistry>(@lendpay);
        let intent_index = find_intent_index_ref(registry, intent_id);
        *vector::borrow(&registry.intents, intent_index)
    }

    #[view]
    public fun next_route_id(): u64 acquires BridgeRegistry {
        borrow_global<BridgeRegistry>(@lendpay).next_route_id
    }

    #[view]
    public fun next_intent_id(): u64 acquires BridgeRegistry {
        borrow_global<BridgeRegistry>(@lendpay).next_intent_id
    }

    #[view]
    public fun route_count(): u64 acquires BridgeRegistry {
        vector::length(&borrow_global<BridgeRegistry>(@lendpay).routes)
    }

    #[view]
    public fun intent_count(): u64 acquires BridgeRegistry {
        vector::length(&borrow_global<BridgeRegistry>(@lendpay).intents)
    }

    #[view]
    public fun route_is_live(route_id: u64): bool acquires BridgeRegistry {
        let route = get_route(route_id);
        route.active && route.mapping_published
    }

    #[view]
    public fun route_transfer_method(route_id: u64): u8 acquires BridgeRegistry {
        get_route(route_id).transfer_method
    }

    #[view]
    public fun route_mapping_published(route_id: u64): bool acquires BridgeRegistry {
        get_route(route_id).mapping_published
    }

    #[view]
    public fun route_destination_asset_reference(route_id: u64): String acquires BridgeRegistry {
        get_route(route_id).destination_asset_reference
    }

    #[view]
    public fun route_liquidity_venue(route_id: u64): String acquires BridgeRegistry {
        get_route(route_id).liquidity_venue
    }

    #[view]
    public fun route_pool_reference(route_id: u64): String acquires BridgeRegistry {
        get_route(route_id).pool_reference
    }

    #[view]
    public fun route_liquidity_status(route_id: u64): u8 acquires BridgeRegistry {
        get_route(route_id).liquidity_status
    }

    #[view]
    public fun route_swap_enabled(route_id: u64): bool acquires BridgeRegistry {
        get_route(route_id).swap_enabled
    }

    #[view]
    public fun route_is_sell_ready(route_id: u64): bool acquires BridgeRegistry {
        let route = get_route(route_id);
        route.active &&
            route.mapping_published &&
            route.swap_enabled &&
            route.liquidity_status == LIQUIDITY_STATUS_LIVE
    }

    #[view]
    public fun intent_route_id(intent_id: u64): u64 acquires BridgeRegistry {
        get_intent(intent_id).route_id
    }

    #[view]
    public fun intent_requester(intent_id: u64): address acquires BridgeRegistry {
        get_intent(intent_id).requester
    }

    #[view]
    public fun intent_amount(intent_id: u64): u64 acquires BridgeRegistry {
        get_intent(intent_id).amount
    }

    #[view]
    public fun intent_status(intent_id: u64): u8 acquires BridgeRegistry {
        get_intent(intent_id).status
    }

    #[view]
    public fun intent_recipient(intent_id: u64): String acquires BridgeRegistry {
        get_intent(intent_id).recipient
    }

    #[view]
    public fun intent_settlement_reference(intent_id: u64): String acquires BridgeRegistry {
        get_intent(intent_id).settlement_reference
    }

    #[view]
    public fun transfer_method_ibc_hooks(): u8 {
        TRANSFER_METHOD_IBC_HOOKS
    }

    #[view]
    public fun liquidity_status_unknown(): u8 {
        LIQUIDITY_STATUS_UNKNOWN
    }

    #[view]
    public fun liquidity_status_coming_soon(): u8 {
        LIQUIDITY_STATUS_COMING_SOON
    }

    #[view]
    public fun liquidity_status_live(): u8 {
        LIQUIDITY_STATUS_LIVE
    }

    #[view]
    public fun liquidity_status_paused(): u8 {
        LIQUIDITY_STATUS_PAUSED
    }

    #[view]
    public fun intent_status_pending(): u8 {
        INTENT_PENDING
    }

    #[view]
    public fun intent_status_completed(): u8 {
        INTENT_COMPLETED
    }

    #[view]
    public fun intent_status_cancelled(): u8 {
        INTENT_CANCELLED
    }

    #[view]
    public fun intent_status_failed(): u8 {
        INTENT_FAILED
    }

    fun assert_supported_transfer_method(transfer_method: u8) {
        assert!(transfer_method == TRANSFER_METHOD_IBC_HOOKS, errors::invalid_policy());
    }

    fun assert_supported_liquidity_status(liquidity_status: u8) {
        assert!(
            liquidity_status == LIQUIDITY_STATUS_UNKNOWN ||
                liquidity_status == LIQUIDITY_STATUS_COMING_SOON ||
                liquidity_status == LIQUIDITY_STATUS_LIVE ||
                liquidity_status == LIQUIDITY_STATUS_PAUSED,
            errors::invalid_policy(),
        );
    }

    fun empty_string(): String {
        string::utf8(b"")
    }

    fun find_route_index(registry: &BridgeRegistry, route_id: u64): u64 {
        let len = vector::length(&registry.routes);
        let i = 0;

        while (i < len) {
            if (vector::borrow(&registry.routes, i).id == route_id) {
                return i
            };
            i = i + 1;
        };

        abort errors::bridge_route_not_found()
    }

    fun find_route_index_ref(registry: &BridgeRegistry, route_id: u64): u64 {
        find_route_index(registry, route_id)
    }

    fun find_intent_index(registry: &BridgeRegistry, intent_id: u64): u64 {
        let len = vector::length(&registry.intents);
        let i = 0;

        while (i < len) {
            if (vector::borrow(&registry.intents, i).id == intent_id) {
                return i
            };
            i = i + 1;
        };

        abort errors::bridge_intent_not_found()
    }

    fun find_intent_index_ref(registry: &BridgeRegistry, intent_id: u64): u64 {
        find_intent_index(registry, intent_id)
    }
}
