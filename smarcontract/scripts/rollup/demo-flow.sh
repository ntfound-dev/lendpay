#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/common.sh"

require_rollup_tx_env
require_package_address

if ! command -v jq >/dev/null 2>&1; then
  echo "jq is required for demo-flow.sh" >&2
  exit 1
fi

DEMO_OUTPUT_DIR="${DEMO_OUTPUT_DIR:-${ROLLUP_OUTPUT_DIR}/demo}"
BORROWER_KEY_NAME="${BORROWER_KEY_NAME:-Validator}"
BORROWER_KEYRING_BACKEND="${BORROWER_KEYRING_BACKEND:-${ROLLUP_KEYRING_BACKEND}}"
LOAN_DENOM="${LOAN_DENOM:-umin}"
BORROWER_FUND_AMOUNT="${BORROWER_FUND_AMOUNT:-1000000}"
USERNAME_TEXT="${USERNAME_TEXT:-borrower.init}"
PROFILE_ID="${PROFILE_ID:-1}"
REQUEST_AMOUNT="${REQUEST_AMOUNT:-300}"
TENOR_MONTHS="${TENOR_MONTHS:-3}"
APR_BPS="${APR_BPS:-1200}"
INSTALLMENT_AMOUNT="${INSTALLMENT_AMOUNT:-100}"
INSTALLMENTS_TOTAL="${INSTALLMENTS_TOTAL:-3}"
GRACE_PERIOD_SECONDS="${GRACE_PERIOD_SECONDS:-604800}"
STAKE_AMOUNT="${STAKE_AMOUNT:-1}"

mkdir -p "${DEMO_OUTPUT_DIR}"

MODULE_ADDRESS="$(module_address)"
OPERATOR_ADDRESS="$(human_address_for "${ROLLUP_KEY_NAME}" "${ROLLUP_KEYRING_BACKEND}")"
OPERATOR_HEX="$(hex_address_for "${ROLLUP_KEY_NAME}" "${ROLLUP_KEYRING_BACKEND}")"
BORROWER_ADDRESS="$(human_address_for "${BORROWER_KEY_NAME}" "${BORROWER_KEYRING_BACKEND}")"
BORROWER_HEX="$(hex_address_for "${BORROWER_KEY_NAME}" "${BORROWER_KEYRING_BACKEND}")"
USERNAME_VECTOR_U8="$(
  printf '%s' "${USERNAME_TEXT}" |
    od -An -t u1 -v |
    tr -s ' ' ',' |
    sed 's/^,//; s/,$//'
)"

mapfile -t OPERATOR_TX_FLAGS < <(tx_flags_for "${ROLLUP_KEY_NAME}" "${ROLLUP_KEYRING_BACKEND}")
mapfile -t BORROWER_TX_FLAGS < <(tx_flags_for "${BORROWER_KEY_NAME}" "${BORROWER_KEYRING_BACKEND}")

move_view() {
  local module_name="${1:?module name is required}"
  local function_name="${2:?function name is required}"
  local args="${3:-[]}"

  "${MINITIAD_BIN}" query move view "${MODULE_ADDRESS}" "${module_name}" "${function_name}" \
    --args "${args}" \
    --node "${ROLLUP_RPC_URL}" \
    --output json
}

view_scalar() {
  local module_name="${1:?module name is required}"
  local function_name="${2:?function name is required}"
  local args="${3:-[]}"

  move_view "${module_name}" "${function_name}" "${args}" | jq -r '.data | fromjson'
}

view_to_file() {
  local module_name="${1:?module name is required}"
  local function_name="${2:?function name is required}"
  local args="${3:-[]}"
  local output_file="${4:?output file is required}"

  move_view "${module_name}" "${function_name}" "${args}" | jq '.data |= fromjson' > "${output_file}"
}

wait_for_tx() {
  local tx_hash="${1:?tx hash is required}"
  local attempts="${2:-30}"
  local delay_seconds="${3:-1}"
  local attempt=1

  while [[ "${attempt}" -le "${attempts}" ]]; do
    if "${MINITIAD_BIN}" query tx "${tx_hash}" --node "${ROLLUP_RPC_URL}" --output json >/dev/null 2>&1; then
      return 0
    fi

    sleep "${delay_seconds}"
    attempt=$((attempt + 1))
  done

  echo "Timed out waiting for tx ${tx_hash} to commit" >&2
  return 1
}

wait_for_tx_file() {
  local output_file="${1:?output file is required}"
  local tx_hash

  tx_hash="$(jq -r '.txhash' "${output_file}")"
  wait_for_tx "${tx_hash}"
}

echo "Running local borrower demo against ${ROLLUP_CHAIN_ID} (${ROLLUP_RPC_URL})"
echo "Module address: ${MODULE_ADDRESS}"
echo "Operator: ${OPERATOR_ADDRESS}"
echo "Borrower (${BORROWER_KEY_NAME}): ${BORROWER_ADDRESS}"

echo
echo "1. Funding borrower gas + loan denomination balance"
FUND_OUTPUT="${DEMO_OUTPUT_DIR}/01-fund-borrower.json"
"${MINITIAD_BIN}" tx bank send \
  "${OPERATOR_ADDRESS}" \
  "${BORROWER_ADDRESS}" \
  "${BORROWER_FUND_AMOUNT}${LOAN_DENOM}" \
  "${OPERATOR_TX_FLAGS[@]}" | tee "${FUND_OUTPUT}"
wait_for_tx_file "${FUND_OUTPUT}"

echo
echo "2. Attesting username for borrower"
ATTEST_OUTPUT="${DEMO_OUTPUT_DIR}/02-attest-username.json"
"${MINITIAD_BIN}" tx move execute "${MODULE_ADDRESS}" reputation attest_username \
  --args "[\"address:${BORROWER_HEX}\", \"vector<u8>:${USERNAME_VECTOR_U8}\"]" \
  "${OPERATOR_TX_FLAGS[@]}" | tee "${ATTEST_OUTPUT}"
wait_for_tx_file "${ATTEST_OUTPUT}"

REQUEST_ID="$(view_scalar loan_book next_request_id)"

echo
echo "3. Creating profiled loan request #${REQUEST_ID}"
REQUEST_OUTPUT="${DEMO_OUTPUT_DIR}/03-request-loan.json"
"${MINITIAD_BIN}" tx move execute "${MODULE_ADDRESS}" loan_book request_profiled_loan \
  --args "[\"u8:${PROFILE_ID}\", \"u64:${REQUEST_AMOUNT}\", \"u8:${TENOR_MONTHS}\"]" \
  "${BORROWER_TX_FLAGS[@]}" | tee "${REQUEST_OUTPUT}"
wait_for_tx_file "${REQUEST_OUTPUT}"

LOAN_ID="$(view_scalar loan_book next_loan_id)"

echo
echo "4. Approving request #${REQUEST_ID} into loan #${LOAN_ID}"
APPROVE_OUTPUT="${DEMO_OUTPUT_DIR}/04-approve-loan.json"
"${MINITIAD_BIN}" tx move execute "${MODULE_ADDRESS}" loan_book approve_request \
  --args "[\"u64:${REQUEST_ID}\", \"u64:${APR_BPS}\", \"u64:${INSTALLMENT_AMOUNT}\", \"u64:${INSTALLMENTS_TOTAL}\", \"u64:${GRACE_PERIOD_SECONDS}\"]" \
  "${OPERATOR_TX_FLAGS[@]}" | tee "${APPROVE_OUTPUT}"
wait_for_tx_file "${APPROVE_OUTPUT}"

installment_number=1
while [[ "${installment_number}" -le "${INSTALLMENTS_TOTAL}" ]]; do
  echo
  echo "5.${installment_number} Repaying installment ${installment_number}/${INSTALLMENTS_TOTAL}"
  REPAY_OUTPUT="${DEMO_OUTPUT_DIR}/05-repay-${installment_number}.json"
  "${MINITIAD_BIN}" tx move execute "${MODULE_ADDRESS}" loan_book repay_installment \
    --args "[\"u64:${LOAN_ID}\"]" \
    "${BORROWER_TX_FLAGS[@]}" | tee "${REPAY_OUTPUT}"
  wait_for_tx_file "${REPAY_OUTPUT}"
  installment_number=$((installment_number + 1))
done

echo
echo "6. Claiming earned LEND"
CLAIM_LEND_OUTPUT="${DEMO_OUTPUT_DIR}/06-claim-lend.json"
"${MINITIAD_BIN}" tx move execute "${MODULE_ADDRESS}" rewards claim_lend \
  "${BORROWER_TX_FLAGS[@]}" | tee "${CLAIM_LEND_OUTPUT}"
wait_for_tx_file "${CLAIM_LEND_OUTPUT}"

echo
echo "7. Paying outstanding protocol fees in LEND"
PAY_FEE_OUTPUT="${DEMO_OUTPUT_DIR}/07-pay-fees-in-lend.json"
"${MINITIAD_BIN}" tx move execute "${MODULE_ADDRESS}" fee_engine pay_outstanding_fees_in_lend \
  --args "[\"u64:${LOAN_ID}\"]" \
  "${BORROWER_TX_FLAGS[@]}" | tee "${PAY_FEE_OUTPUT}"
wait_for_tx_file "${PAY_FEE_OUTPUT}"

CURRENT_LEND_BALANCE="$(view_scalar lend_token balance_of "[\"address:${BORROWER_HEX}\"]")"
if [[ "${STAKE_AMOUNT}" -gt 0 && "${CURRENT_LEND_BALANCE}" -ge "${STAKE_AMOUNT}" ]]; then
  echo
  echo "8. Staking ${STAKE_AMOUNT} LEND"
  STAKE_OUTPUT="${DEMO_OUTPUT_DIR}/08-stake.json"
  "${MINITIAD_BIN}" tx move execute "${MODULE_ADDRESS}" staking stake \
    --args "[\"u64:${STAKE_AMOUNT}\"]" \
    "${BORROWER_TX_FLAGS[@]}" | tee "${STAKE_OUTPUT}"
  wait_for_tx_file "${STAKE_OUTPUT}"

  CLAIMABLE_STAKING="$(view_scalar staking quote_claimable "[\"address:${BORROWER_HEX}\"]")"
  if [[ "${CLAIMABLE_STAKING}" -gt 0 ]]; then
    echo
    echo "9. Claiming ${CLAIMABLE_STAKING} LEND staking rewards"
    CLAIM_STAKING_OUTPUT="${DEMO_OUTPUT_DIR}/09-claim-staking-rewards.json"
    "${MINITIAD_BIN}" tx move execute "${MODULE_ADDRESS}" staking claim_rewards \
      "${BORROWER_TX_FLAGS[@]}" | tee "${CLAIM_STAKING_OUTPUT}"
    wait_for_tx_file "${CLAIM_STAKING_OUTPUT}"
  fi
fi

view_to_file reputation get_entry "[\"address:${BORROWER_HEX}\"]" "${DEMO_OUTPUT_DIR}/view-reputation.json"
view_to_file rewards get_account "[\"address:${BORROWER_HEX}\"]" "${DEMO_OUTPUT_DIR}/view-rewards.json"
view_to_file loan_book get_request "[\"u64:${REQUEST_ID}\"]" "${DEMO_OUTPUT_DIR}/view-request.json"
view_to_file loan_book get_loan "[\"u64:${LOAN_ID}\"]" "${DEMO_OUTPUT_DIR}/view-loan.json"
view_to_file fee_engine get_fee_state "[\"u64:${LOAN_ID}\"]" "${DEMO_OUTPUT_DIR}/view-fees.json"

FINAL_LEND_BALANCE="$(view_scalar lend_token balance_of "[\"address:${BORROWER_HEX}\"]")"
FINAL_STAKED_BALANCE="$(view_scalar lend_token staked_balance_of "[\"address:${BORROWER_HEX}\"]")"
FINAL_POINTS="$(view_scalar rewards points_balance_of "[\"address:${BORROWER_HEX}\"]")"
FINAL_REWARD_RESERVE="$(view_scalar treasury reward_reserve)"
FINAL_LIQUIDITY_BALANCE="$(view_scalar treasury liquidity_balance)"
FINAL_TOTAL_REPAID="$(view_scalar treasury total_repaid)"

jq -n \
  --arg chain_id "${ROLLUP_CHAIN_ID}" \
  --arg rpc_url "${ROLLUP_RPC_URL}" \
  --arg module_address "${MODULE_ADDRESS}" \
  --arg operator_address "${OPERATOR_ADDRESS}" \
  --arg operator_hex "${OPERATOR_HEX}" \
  --arg borrower_key_name "${BORROWER_KEY_NAME}" \
  --arg borrower_address "${BORROWER_ADDRESS}" \
  --arg borrower_hex "${BORROWER_HEX}" \
  --arg username "${USERNAME_TEXT}" \
  --arg loan_denom "${LOAN_DENOM}" \
  --argjson request_id "${REQUEST_ID}" \
  --argjson loan_id "${LOAN_ID}" \
  --argjson profile_id "${PROFILE_ID}" \
  --argjson request_amount "${REQUEST_AMOUNT}" \
  --argjson tenor_months "${TENOR_MONTHS}" \
  --argjson installment_amount "${INSTALLMENT_AMOUNT}" \
  --argjson installments_total "${INSTALLMENTS_TOTAL}" \
  --argjson apr_bps "${APR_BPS}" \
  --argjson final_points "${FINAL_POINTS}" \
  --argjson final_lend_balance "${FINAL_LEND_BALANCE}" \
  --argjson final_staked_balance "${FINAL_STAKED_BALANCE}" \
  --argjson final_reward_reserve "${FINAL_REWARD_RESERVE}" \
  --argjson final_liquidity_balance "${FINAL_LIQUIDITY_BALANCE}" \
  --argjson final_total_repaid "${FINAL_TOTAL_REPAID}" \
  '{
    chain_id: $chain_id,
    rpc_url: $rpc_url,
    module_address: $module_address,
    operator: {
      address: $operator_address,
      hex: $operator_hex
    },
    borrower: {
      key_name: $borrower_key_name,
      address: $borrower_address,
      hex: $borrower_hex,
      username: $username
    },
    loan: {
      profile_id: $profile_id,
      request_id: $request_id,
      loan_id: $loan_id,
      request_amount: $request_amount,
      tenor_months: $tenor_months,
      installment_amount: $installment_amount,
      installments_total: $installments_total,
      apr_bps: $apr_bps,
      loan_denom: $loan_denom
    },
    final_state: {
      points: $final_points,
      lend_balance: $final_lend_balance,
      staked_lend_balance: $final_staked_balance,
      treasury_reward_reserve: $final_reward_reserve,
      treasury_liquidity_balance: $final_liquidity_balance,
      treasury_total_repaid: $final_total_repaid
    }
  }' > "${DEMO_OUTPUT_DIR}/summary.json"

echo
echo "Saved demo artifacts to ${DEMO_OUTPUT_DIR}"
echo "Summary: ${DEMO_OUTPUT_DIR}/summary.json"
