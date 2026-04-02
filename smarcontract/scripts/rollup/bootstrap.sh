#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/common.sh"

require_rollup_tx_env
require_package_address

TREASURY_ADMIN_ADDRESS="${TREASURY_ADMIN_ADDRESS:?TREASURY_ADMIN_ADDRESS is required}"
LOAN_ASSET_METADATA="${LOAN_ASSET_METADATA:?LOAN_ASSET_METADATA is required}"
BOOTSTRAP_OUTPUT_FILE="${BOOTSTRAP_OUTPUT_FILE:-${ROLLUP_OUTPUT_DIR}/bootstrap.json}"
MODULE_ADDRESS="$(module_address)"

mapfile -t TX_FLAGS < <(tx_flags)

echo "Bootstrapping protocol on module ${MODULE_ADDRESS}"
"${MINITIAD_BIN}" tx move execute "${MODULE_ADDRESS}" bootstrap initialize_protocol \
  --args "[\"address:${TREASURY_ADMIN_ADDRESS}\", \"address:${LOAN_ASSET_METADATA}\"]" \
  "${TX_FLAGS[@]}" | tee "${BOOTSTRAP_OUTPUT_FILE}"

echo
echo "Saved bootstrap response to ${BOOTSTRAP_OUTPUT_FILE}"
