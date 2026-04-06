module lendpay::errors {
    const E_ALREADY_INITIALIZED: u64 = 1;
    const E_NOT_INITIALIZED: u64 = 2;
    const E_NOT_PACKAGE_OWNER: u64 = 3;
    const E_NOT_ADMIN: u64 = 4;
    const E_NOT_TREASURY_ADMIN: u64 = 5;
    const E_PACKAGE_PAUSED: u64 = 6;
    const E_INVALID_AMOUNT: u64 = 7;
    const E_INVALID_TENOR: u64 = 8;
    const E_REQUEST_NOT_FOUND: u64 = 9;
    const E_LOAN_NOT_FOUND: u64 = 10;
    const E_REQUEST_NOT_PENDING: u64 = 11;
    const E_LOAN_NOT_ACTIVE: u64 = 12;
    const E_NOT_BORROWER: u64 = 13;
    const E_INSUFFICIENT_LIQUIDITY: u64 = 14;
    const E_INSUFFICIENT_REWARD_RESERVE: u64 = 15;
    const E_NOTHING_TO_CLAIM: u64 = 16;
    const E_GRACE_PERIOD_NOT_EXPIRED: u64 = 17;
    const E_INVALID_INSTALLMENT_PLAN: u64 = 18;
    const E_MATH_OVERFLOW: u64 = 19;
    const E_INVALID_STATUS: u64 = 20;
    const E_INVALID_POLICY: u64 = 21;
    const E_INSUFFICIENT_POINTS: u64 = 22;
    const E_INSUFFICIENT_LEND_BALANCE: u64 = 23;
    const E_INSUFFICIENT_STAKED_BALANCE: u64 = 24;
    const E_FEE_RECORD_NOT_FOUND: u64 = 25;
    const E_NOTHING_TO_PAY: u64 = 26;
    const E_NOTHING_TO_STAKE: u64 = 27;
    const E_NOTHING_TO_UNSTAKE: u64 = 28;
    const E_NOTHING_TO_CLAIM_STAKING: u64 = 29;
    const E_PROPOSAL_NOT_FOUND: u64 = 30;
    const E_DUPLICATE_VOTE: u64 = 31;
    const E_PROPOSAL_NOT_OPEN: u64 = 32;
    const E_PROPOSAL_NOT_ENDED: u64 = 33;
    const E_INSUFFICIENT_VOTING_POWER: u64 = 34;
    const E_CAMPAIGN_NOT_FOUND: u64 = 35;
    const E_CLAIM_NOT_FOUND: u64 = 36;
    const E_ALREADY_CLAIMED: u64 = 37;
    const E_INVALID_SHARE_SPLIT: u64 = 38;
    const E_PROFILE_REQUIREMENTS_NOT_MET: u64 = 39;
    const E_COLLATERAL_REQUIRED: u64 = 40;
    const E_USERNAME_REQUIRED: u64 = 41;
    const E_INSUFFICIENT_PLATFORM_ACTIVITY: u64 = 42;
    const E_INSUFFICIENT_COLLATERAL: u64 = 43;
    const E_COLLATERAL_NOT_ACTIVE: u64 = 44;
    const E_ITEM_NOT_FOUND: u64 = 45;
    const E_ITEM_NOT_ACTIVE: u64 = 46;
    const E_MERCHANT_NOT_ACTIVE: u64 = 47;
    const E_MERCHANT_DESTINATION_MISMATCH: u64 = 48;
    const E_REFERRAL_ALREADY_APPLIED: u64 = 49;
    const E_REFERRAL_CODE_NOT_FOUND: u64 = 50;
    const E_SELF_REFERRAL_NOT_ALLOWED: u64 = 51;
    const E_REFERRAL_WINDOW_CLOSED: u64 = 52;
    const E_VAULT_NOT_FOUND: u64 = 53;
    const E_POSITION_NOT_FOUND: u64 = 54;
    const E_POSITION_NOT_OPEN: u64 = 55;
    const E_DELIVERY_NOT_FOUND: u64 = 56;
    const E_COLLECTIBLE_LOCKED: u64 = 57;
    const E_DELIVERY_REGISTRY_NOT_INITIALIZED: u64 = 58;

    public fun already_initialized(): u64 { E_ALREADY_INITIALIZED }
    public fun not_initialized(): u64 { E_NOT_INITIALIZED }
    public fun not_package_owner(): u64 { E_NOT_PACKAGE_OWNER }
    public fun not_admin(): u64 { E_NOT_ADMIN }
    public fun not_treasury_admin(): u64 { E_NOT_TREASURY_ADMIN }
    public fun package_paused(): u64 { E_PACKAGE_PAUSED }
    public fun invalid_amount(): u64 { E_INVALID_AMOUNT }
    public fun invalid_tenor(): u64 { E_INVALID_TENOR }
    public fun request_not_found(): u64 { E_REQUEST_NOT_FOUND }
    public fun loan_not_found(): u64 { E_LOAN_NOT_FOUND }
    public fun request_not_pending(): u64 { E_REQUEST_NOT_PENDING }
    public fun loan_not_active(): u64 { E_LOAN_NOT_ACTIVE }
    public fun not_borrower(): u64 { E_NOT_BORROWER }
    public fun insufficient_liquidity(): u64 { E_INSUFFICIENT_LIQUIDITY }
    public fun insufficient_reward_reserve(): u64 { E_INSUFFICIENT_REWARD_RESERVE }
    public fun nothing_to_claim(): u64 { E_NOTHING_TO_CLAIM }
    public fun grace_period_not_expired(): u64 { E_GRACE_PERIOD_NOT_EXPIRED }
    public fun invalid_installment_plan(): u64 { E_INVALID_INSTALLMENT_PLAN }
    public fun math_overflow(): u64 { E_MATH_OVERFLOW }
    public fun invalid_status(): u64 { E_INVALID_STATUS }
    public fun invalid_policy(): u64 { E_INVALID_POLICY }
    public fun insufficient_points(): u64 { E_INSUFFICIENT_POINTS }
    public fun insufficient_lend_balance(): u64 { E_INSUFFICIENT_LEND_BALANCE }
    public fun insufficient_staked_balance(): u64 { E_INSUFFICIENT_STAKED_BALANCE }
    public fun fee_record_not_found(): u64 { E_FEE_RECORD_NOT_FOUND }
    public fun nothing_to_pay(): u64 { E_NOTHING_TO_PAY }
    public fun nothing_to_stake(): u64 { E_NOTHING_TO_STAKE }
    public fun nothing_to_unstake(): u64 { E_NOTHING_TO_UNSTAKE }
    public fun nothing_to_claim_staking(): u64 { E_NOTHING_TO_CLAIM_STAKING }
    public fun proposal_not_found(): u64 { E_PROPOSAL_NOT_FOUND }
    public fun duplicate_vote(): u64 { E_DUPLICATE_VOTE }
    public fun proposal_not_open(): u64 { E_PROPOSAL_NOT_OPEN }
    public fun proposal_not_ended(): u64 { E_PROPOSAL_NOT_ENDED }
    public fun insufficient_voting_power(): u64 { E_INSUFFICIENT_VOTING_POWER }
    public fun campaign_not_found(): u64 { E_CAMPAIGN_NOT_FOUND }
    public fun claim_not_found(): u64 { E_CLAIM_NOT_FOUND }
    public fun already_claimed(): u64 { E_ALREADY_CLAIMED }
    public fun invalid_share_split(): u64 { E_INVALID_SHARE_SPLIT }
    public fun profile_requirements_not_met(): u64 { E_PROFILE_REQUIREMENTS_NOT_MET }
    public fun collateral_required(): u64 { E_COLLATERAL_REQUIRED }
    public fun username_required(): u64 { E_USERNAME_REQUIRED }
    public fun insufficient_platform_activity(): u64 { E_INSUFFICIENT_PLATFORM_ACTIVITY }
    public fun insufficient_collateral(): u64 { E_INSUFFICIENT_COLLATERAL }
    public fun collateral_not_active(): u64 { E_COLLATERAL_NOT_ACTIVE }
    public fun item_not_found(): u64 { E_ITEM_NOT_FOUND }
    public fun item_not_active(): u64 { E_ITEM_NOT_ACTIVE }
    public fun merchant_not_active(): u64 { E_MERCHANT_NOT_ACTIVE }
    public fun merchant_destination_mismatch(): u64 { E_MERCHANT_DESTINATION_MISMATCH }
    public fun referral_already_applied(): u64 { E_REFERRAL_ALREADY_APPLIED }
    public fun referral_code_not_found(): u64 { E_REFERRAL_CODE_NOT_FOUND }
    public fun self_referral_not_allowed(): u64 { E_SELF_REFERRAL_NOT_ALLOWED }
    public fun referral_window_closed(): u64 { E_REFERRAL_WINDOW_CLOSED }
    public fun vault_not_found(): u64 { E_VAULT_NOT_FOUND }
    public fun position_not_found(): u64 { E_POSITION_NOT_FOUND }
    public fun position_not_open(): u64 { E_POSITION_NOT_OPEN }
    public fun delivery_not_found(): u64 { E_DELIVERY_NOT_FOUND }
    public fun collectible_locked(): u64 { E_COLLECTIBLE_LOCKED }
    public fun delivery_registry_not_initialized(): u64 { E_DELIVERY_REGISTRY_NOT_INITIALIZED }
}
