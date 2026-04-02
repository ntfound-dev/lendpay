#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/common.sh"

require_rollup_tx_env
require_package_address

AMOUNT="${AMOUNT:?AMOUNT is required}"
OUTPUT_FILE="${OUTPUT_FILE:-${ROLLUP_OUTPUT_DIR}/mint-lend-reserve.json}"
MODULE_ADDRESS="$(module_address)"

mapfile -t TX_FLAGS < <(tx_flags)

echo "Minting ${AMOUNT} LEND into the protocol reserve vault"
"${MINITIAD_BIN}" tx move execute "${MODULE_ADDRESS}" lend_token mint_to_protocol_reserve \
  --args "[\"u64:${AMOUNT}\"]" \
  "${TX_FLAGS[@]}" | tee "${OUTPUT_FILE}"

echo
echo "Saved reserve mint response to ${OUTPUT_FILE}"
