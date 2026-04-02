#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/common.sh"

require_rollup_tx_env
require_package_address

AMOUNT="${AMOUNT:?AMOUNT is required}"
OUTPUT_FILE="${OUTPUT_FILE:-${ROLLUP_OUTPUT_DIR}/fund-liquidity.json}"
MODULE_ADDRESS="$(module_address)"

mapfile -t TX_FLAGS < <(tx_flags)

echo "Funding protocol liquidity vault with ${AMOUNT}"
"${MINITIAD_BIN}" tx move execute "${MODULE_ADDRESS}" treasury deposit_liquidity \
  --args "[\"u64:${AMOUNT}\"]" \
  "${TX_FLAGS[@]}" | tee "${OUTPUT_FILE}"

echo
echo "Saved liquidity funding response to ${OUTPUT_FILE}"
