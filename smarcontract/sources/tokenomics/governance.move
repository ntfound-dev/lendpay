module lendpay::governance {
    use std::event;
    use std::signer;
    use std::timestamp;
    use std::vector;
    use lendpay::config;
    use lendpay::errors;
    use lendpay::lend_token;

    const PROPOSAL_OPEN: u8 = 0;
    const PROPOSAL_PASSED: u8 = 1;
    const PROPOSAL_REJECTED: u8 = 2;

    struct Proposal has copy, drop, store {
        id: u64,
        proposer: address,
        proposal_type: u8,
        title_hash: vector<u8>,
        body_hash: vector<u8>,
        created_at: u64,
        ends_at: u64,
        yes_votes: u64,
        no_votes: u64,
        status: u8,
    }

    struct VoteReceipt has copy, drop, store {
        proposal_id: u64,
        voter: address,
        support: bool,
        voting_power: u64,
    }

    struct GovernanceRegistry has key {
        next_proposal_id: u64,
        proposals: vector<Proposal>,
        votes: vector<VoteReceipt>,
    }

    #[event]
    struct ProposalCreatedEvent has drop, store {
        proposal_id: u64,
        proposer: address,
        proposal_type: u8,
    }

    #[event]
    struct ProposalVotedEvent has drop, store {
        proposal_id: u64,
        voter: address,
        support: bool,
        voting_power: u64,
    }

    #[event]
    struct ProposalFinalizedEvent has drop, store {
        proposal_id: u64,
        status: u8,
        yes_votes: u64,
        no_votes: u64,
    }

    public entry fun initialize(admin: &signer) {
        config::assert_admin(signer::address_of(admin));
        assert!(!exists<GovernanceRegistry>(@lendpay), errors::already_initialized());

        move_to(admin, GovernanceRegistry {
            next_proposal_id: 1,
            proposals: vector::empty(),
            votes: vector::empty(),
        });
    }

    public entry fun propose(
        proposer: &signer,
        proposal_type: u8,
        title_hash: vector<u8>,
        body_hash: vector<u8>,
    ) acquires GovernanceRegistry {
        config::assert_not_paused();

        let proposer_addr = signer::address_of(proposer);
        let voting_power = lend_token::voting_power_of(proposer_addr);
        assert!(
            voting_power >= config::governance_proposal_threshold_lend(),
            errors::insufficient_voting_power(),
        );

        let registry = borrow_global_mut<GovernanceRegistry>(@lendpay);
        let proposal_id = registry.next_proposal_id;
        registry.next_proposal_id = proposal_id + 1;

        vector::push_back(
            &mut registry.proposals,
            Proposal {
                id: proposal_id,
                proposer: proposer_addr,
                proposal_type,
                title_hash,
                body_hash,
                created_at: timestamp::now_seconds(),
                ends_at: timestamp::now_seconds() + config::governance_voting_period_seconds(),
                yes_votes: 0,
                no_votes: 0,
                status: PROPOSAL_OPEN,
            },
        );

        event::emit(ProposalCreatedEvent {
            proposal_id,
            proposer: proposer_addr,
            proposal_type,
        });
    }

    public entry fun vote(proposer: &signer, proposal_id: u64, support: bool) acquires GovernanceRegistry {
        config::assert_not_paused();

        let voter = signer::address_of(proposer);
        let voting_power = lend_token::voting_power_of(voter);
        assert!(voting_power > 0, errors::insufficient_voting_power());

        let registry = borrow_global_mut<GovernanceRegistry>(@lendpay);
        assert!(!has_vote_receipt(registry, proposal_id, voter), errors::duplicate_vote());

        let proposal_index = find_proposal_index(registry, proposal_id);
        {
            let proposal = vector::borrow_mut(&mut registry.proposals, proposal_index);
            assert!(proposal.status == PROPOSAL_OPEN, errors::proposal_not_open());
            assert!(timestamp::now_seconds() <= proposal.ends_at, errors::proposal_not_open());

            if (support) {
                proposal.yes_votes = proposal.yes_votes + voting_power;
            } else {
                proposal.no_votes = proposal.no_votes + voting_power;
            };
        };

        vector::push_back(
            &mut registry.votes,
            VoteReceipt {
                proposal_id,
                voter,
                support,
                voting_power,
            },
        );

        event::emit(ProposalVotedEvent {
            proposal_id,
            voter,
            support,
            voting_power,
        });
    }

    public entry fun finalize(_actor: &signer, proposal_id: u64) acquires GovernanceRegistry {
        let registry = borrow_global_mut<GovernanceRegistry>(@lendpay);
        let proposal_index = find_proposal_index(registry, proposal_id);
        let proposal = vector::borrow_mut(&mut registry.proposals, proposal_index);

        assert!(proposal.status == PROPOSAL_OPEN, errors::proposal_not_open());
        assert!(timestamp::now_seconds() > proposal.ends_at, errors::proposal_not_ended());

        let total_votes = proposal.yes_votes + proposal.no_votes;
        let total_supply = lend_token::circulating_supply();
        let quorum_reached = if (total_supply == 0) {
            false
        } else {
            (total_votes * 10_000) / total_supply >= config::governance_quorum_bps()
        };

        if (quorum_reached && proposal.yes_votes > proposal.no_votes) {
            proposal.status = PROPOSAL_PASSED;
        } else {
            proposal.status = PROPOSAL_REJECTED;
        };

        event::emit(ProposalFinalizedEvent {
            proposal_id,
            status: proposal.status,
            yes_votes: proposal.yes_votes,
            no_votes: proposal.no_votes,
        });
    }

    #[view]
    public fun get_proposal(proposal_id: u64): Proposal acquires GovernanceRegistry {
        let registry = borrow_global<GovernanceRegistry>(@lendpay);
        let index = find_proposal_index_ref(registry, proposal_id);
        *vector::borrow(&registry.proposals, index)
    }

    #[view]
    public fun next_proposal_id(): u64 acquires GovernanceRegistry {
        borrow_global<GovernanceRegistry>(@lendpay).next_proposal_id
    }

    #[view]
    public fun has_user_voted(voter: address, proposal_id: u64): bool acquires GovernanceRegistry {
        has_vote_receipt(borrow_global<GovernanceRegistry>(@lendpay), proposal_id, voter)
    }

    fun has_vote_receipt(registry: &GovernanceRegistry, proposal_id: u64, voter: address): bool {
        let len = vector::length(&registry.votes);
        let i = 0;

        while (i < len) {
            let receipt = vector::borrow(&registry.votes, i);
            if (receipt.proposal_id == proposal_id && receipt.voter == voter) {
                return true
            };
            i = i + 1;
        };

        false
    }

    fun find_proposal_index(registry: &GovernanceRegistry, proposal_id: u64): u64 {
        let len = vector::length(&registry.proposals);
        let i = 0;

        while (i < len) {
            if (vector::borrow(&registry.proposals, i).id == proposal_id) {
                return i
            };
            i = i + 1;
        };

        abort errors::proposal_not_found()
    }

    fun find_proposal_index_ref(registry: &GovernanceRegistry, proposal_id: u64): u64 {
        find_proposal_index(registry, proposal_id)
    }
}
