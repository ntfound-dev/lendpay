module lendpay::staking {
    use std::event;
    use std::signer;
    use std::timestamp;
    use std::vector;
    use lendpay::config;
    use lendpay::errors;
    use lendpay::lend_token;

    friend lendpay::fee_engine;

    const PRECISION_E12: u64 = 1_000_000_000_000;

    struct StakePosition has copy, drop, store {
        user: address,
        staked_amount: u64,
        reward_debt_e12: u64,
        pending_rewards: u64,
        lifetime_claimed_rewards: u64,
        last_staked_at: u64,
    }

    struct StakingRegistry has key {
        positions: vector<StakePosition>,
        total_staked: u64,
        reward_index_e12: u64,
        undistributed_rewards: u64,
        total_rewards_claimed: u64,
    }

    #[event]
    struct StakedEvent has drop, store {
        user: address,
        amount: u64,
        total_staked: u64,
    }

    #[event]
    struct UnstakedEvent has drop, store {
        user: address,
        amount: u64,
        total_staked: u64,
    }

    #[event]
    struct StakingRewardsClaimedEvent has drop, store {
        user: address,
        amount: u64,
        total_claimed: u64,
    }

    public entry fun initialize(admin: &signer) {
        config::assert_admin(signer::address_of(admin));
        assert!(!exists<StakingRegistry>(@lendpay), errors::already_initialized());

        move_to(admin, StakingRegistry {
            positions: vector::empty(),
            total_staked: 0,
            reward_index_e12: 0,
            undistributed_rewards: 0,
            total_rewards_claimed: 0,
        });
    }

    public entry fun stake(user: &signer, amount: u64) acquires StakingRegistry {
        config::assert_not_paused();
        assert!(amount > 0, errors::nothing_to_stake());

        let user_addr = signer::address_of(user);
        let registry = borrow_global_mut<StakingRegistry>(@lendpay);
        sync_registry_rewards(registry);
        let reward_index = registry.reward_index_e12;
        {
            let position = borrow_or_create_position_in_registry(registry, user_addr);
            accrue_position(position, reward_index);
            lend_token::move_to_staked(user, amount);
            position.staked_amount = position.staked_amount + amount;
            position.reward_debt_e12 = mul_div(position.staked_amount, reward_index, PRECISION_E12);
            position.last_staked_at = timestamp::now_seconds();
        };
        registry.total_staked = registry.total_staked + amount;
        sync_registry_rewards(registry);
        let new_total_staked = registry.total_staked;

        event::emit(StakedEvent {
            user: user_addr,
            amount,
            total_staked: new_total_staked,
        });
    }

    public entry fun unstake(user: &signer, amount: u64) acquires StakingRegistry {
        config::assert_not_paused();
        assert!(amount > 0, errors::nothing_to_unstake());

        let user_addr = signer::address_of(user);
        let registry = borrow_global_mut<StakingRegistry>(@lendpay);
        sync_registry_rewards(registry);
        let reward_index = registry.reward_index_e12;
        {
            let position = borrow_or_create_position_in_registry(registry, user_addr);
            accrue_position(position, reward_index);
            assert!(position.staked_amount >= amount, errors::insufficient_staked_balance());
            position.staked_amount = position.staked_amount - amount;
            position.reward_debt_e12 = mul_div(position.staked_amount, reward_index, PRECISION_E12);
        };
        lend_token::release_from_staked(user_addr, amount);
        registry.total_staked = registry.total_staked - amount;
        sync_registry_rewards(registry);
        let new_total_staked = registry.total_staked;

        event::emit(UnstakedEvent {
            user: user_addr,
            amount,
            total_staked: new_total_staked,
        });
    }

    public entry fun claim_rewards(user: &signer) acquires StakingRegistry {
        config::assert_not_paused();

        let user_addr = signer::address_of(user);
        let registry = borrow_global_mut<StakingRegistry>(@lendpay);
        sync_registry_rewards(registry);
        let reward_index = registry.reward_index_e12;
        let (amount, total_claimed_after) = {
            let position = borrow_or_create_position_in_registry(registry, user_addr);
            accrue_position(position, reward_index);
            let amount = position.pending_rewards;
            assert!(amount > 0, errors::nothing_to_claim_staking());
            position.pending_rewards = 0;
            position.lifetime_claimed_rewards = position.lifetime_claimed_rewards + amount;
            (amount, position.lifetime_claimed_rewards)
        };
        registry.total_rewards_claimed = registry.total_rewards_claimed + amount;

        lend_token::distribute_from_protocol(user_addr, amount);

        event::emit(StakingRewardsClaimedEvent {
            user: user_addr,
            amount,
            total_claimed: total_claimed_after,
        });
    }

    public(friend) fun fund_from_fee(amount: u64) acquires StakingRegistry {
        if (amount == 0) {
            return
        };

        let registry = borrow_global_mut<StakingRegistry>(@lendpay);
        registry.undistributed_rewards = registry.undistributed_rewards + amount;
        sync_registry_rewards(registry);
    }

    #[view]
    public fun quote_claimable(user: address): u64 acquires StakingRegistry {
        if (!exists<StakingRegistry>(@lendpay)) {
            0
        } else {
            let registry = borrow_global<StakingRegistry>(@lendpay);
            let position = get_position_or_zero_in_registry(registry, user);
            let projected_index = projected_reward_index(registry);
            let accrued_e12 = position.staked_amount * projected_index;
            let gross = accrued_e12 / PRECISION_E12;
            let current_debt = position.reward_debt_e12 / PRECISION_E12;

            if (gross <= current_debt) {
                position.pending_rewards
            } else {
                position.pending_rewards + (gross - current_debt)
            }
        }
    }

    #[view]
    public fun total_staked(): u64 acquires StakingRegistry {
        borrow_global<StakingRegistry>(@lendpay).total_staked
    }

    #[view]
    public fun undistributed_rewards(): u64 acquires StakingRegistry {
        borrow_global<StakingRegistry>(@lendpay).undistributed_rewards
    }

    fun sync_registry_rewards(registry: &mut StakingRegistry) {
        if (registry.total_staked > 0 && registry.undistributed_rewards > 0) {
            registry.reward_index_e12 =
                registry.reward_index_e12 +
                mul_div(registry.undistributed_rewards, PRECISION_E12, registry.total_staked);
            registry.undistributed_rewards = 0;
        };
    }

    fun accrue_position(position: &mut StakePosition, reward_index_e12: u64) {
        let gross_rewards = mul_div(position.staked_amount, reward_index_e12, PRECISION_E12);
        let previous_rewards = position.reward_debt_e12 / PRECISION_E12;

        if (gross_rewards > previous_rewards) {
            position.pending_rewards = position.pending_rewards + (gross_rewards - previous_rewards);
        };

        position.reward_debt_e12 = position.staked_amount * reward_index_e12;
    }

    fun projected_reward_index(registry: &StakingRegistry): u64 {
        if (registry.total_staked == 0 || registry.undistributed_rewards == 0) {
            registry.reward_index_e12
        } else {
            registry.reward_index_e12 +
                mul_div(registry.undistributed_rewards, PRECISION_E12, registry.total_staked)
        }
    }

    fun mul_div(a: u64, b: u64, c: u64): u64 {
        (a * b) / c
    }

    fun get_position_or_zero_in_registry(registry: &StakingRegistry, user: address): StakePosition {
        let len = vector::length(&registry.positions);
        let i = 0;

        while (i < len) {
            let position = vector::borrow(&registry.positions, i);
            if (position.user == user) {
                return *position
            };
            i = i + 1;
        };

        StakePosition {
            user,
            staked_amount: 0,
            reward_debt_e12: 0,
            pending_rewards: 0,
            lifetime_claimed_rewards: 0,
            last_staked_at: 0,
        }
    }

    fun borrow_or_create_position_in_registry(
        registry: &mut StakingRegistry,
        user: address,
    ): &mut StakePosition {
        let len = vector::length(&registry.positions);
        let i = 0;

        while (i < len) {
            if (vector::borrow(&registry.positions, i).user == user) {
                return vector::borrow_mut(&mut registry.positions, i)
            };
            i = i + 1;
        };

        vector::push_back(
            &mut registry.positions,
            StakePosition {
                user,
                staked_amount: 0,
                reward_debt_e12: 0,
                pending_rewards: 0,
                lifetime_claimed_rewards: 0,
                last_staked_at: 0,
            },
        );

        let new_len = vector::length(&registry.positions);
        vector::borrow_mut(&mut registry.positions, new_len - 1)
    }
}
