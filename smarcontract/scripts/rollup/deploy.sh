#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/common.sh"

require_rollup_tx_env

DEPLOY_OUTPUT_FILE="${DEPLOY_OUTPUT_FILE:-${ROLLUP_OUTPUT_DIR}/deploy.json}"
MODULE_ADDRESS="$(module_address)"

mapfile -t TX_FLAGS < <(tx_flags)

echo "Deploying Move package from ${ROOT_DIR}"
echo "Using named address lendpay=${MODULE_ADDRESS}"
"${MINITIAD_BIN}" move deploy \
  --path "${ROOT_DIR}" \
  --build \
  --named-addresses "lendpay=${MODULE_ADDRESS}" \
  --upgrade-policy COMPATIBLE \
  "${TX_FLAGS[@]}" | tee "${DEPLOY_OUTPUT_FILE}"

echo
echo "Saved deploy response to ${DEPLOY_OUTPUT_FILE}"
echo "Module address is ${MODULE_ADDRESS}"
echo "Set LENDPAY_PACKAGE_ADDRESS=${MODULE_ADDRESS} before bootstrapping, or reuse the same deploy key and let the scripts derive it."
