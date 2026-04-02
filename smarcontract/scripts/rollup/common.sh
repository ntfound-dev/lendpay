#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
MINITIAD_BIN="${MINITIAD_BIN:-minitiad}"
ROLLUP_HOME="${ROLLUP_HOME:-}"
ROLLUP_CHAIN_ID="${ROLLUP_CHAIN_ID:-}"
ROLLUP_RPC_URL="${ROLLUP_RPC_URL:-}"
ROLLUP_KEY_NAME="${ROLLUP_KEY_NAME:-}"
ROLLUP_KEYRING_BACKEND="${ROLLUP_KEYRING_BACKEND:-test}"
ROLLUP_GAS_PRICES="${ROLLUP_GAS_PRICES:-0.015uinit}"
ROLLUP_GAS="${ROLLUP_GAS:-auto}"
ROLLUP_GAS_ADJUSTMENT="${ROLLUP_GAS_ADJUSTMENT:-1.5}"
ROLLUP_OUTPUT_DIR="${ROLLUP_OUTPUT_DIR:-${ROOT_DIR}/artifacts/rollup}"
LENDPAY_PACKAGE_ADDRESS="${LENDPAY_PACKAGE_ADDRESS:-}"

mkdir -p "${ROLLUP_OUTPUT_DIR}"

resolve_minitiad_bin() {
  local resolved="${MINITIAD_BIN}"
  if [[ "${resolved}" != */* ]]; then
    resolved="$(command -v "${resolved}" || true)"
  fi

  if [[ -n "${resolved}" ]]; then
    printf '%s\n' "${resolved}"
  else
    printf '%s\n' "${MINITIAD_BIN}"
  fi
}

MINITIAD_BIN="$(resolve_minitiad_bin)"

if [[ "${MINITIAD_BIN}" == */* ]]; then
  MINITIAD_DIR="$(cd "$(dirname "${MINITIAD_BIN}")" && pwd)"
  if [[ -f "${MINITIAD_DIR}/libmovevm.x86_64.so" ]]; then
    export LD_LIBRARY_PATH="${MINITIAD_DIR}${LD_LIBRARY_PATH:+:${LD_LIBRARY_PATH}}"
  fi
fi

require_rollup_tx_env() {
  : "${ROLLUP_CHAIN_ID:?ROLLUP_CHAIN_ID is required}"
  : "${ROLLUP_RPC_URL:?ROLLUP_RPC_URL is required}"
  : "${ROLLUP_KEY_NAME:?ROLLUP_KEY_NAME is required}"
}

require_package_address() {
  module_address >/dev/null
}

tx_flags() {
  tx_flags_for "${ROLLUP_KEY_NAME}" "${ROLLUP_KEYRING_BACKEND}"
}

tx_flags_for() {
  local from_key_name="${1:?from key name is required}"
  local keyring_backend="${2:-${ROLLUP_KEYRING_BACKEND}}"
  if [[ -n "${ROLLUP_HOME}" ]]; then
    printf '%s\n' \
      --home "${ROLLUP_HOME}" \
      --from "${from_key_name}" \
      --keyring-backend "${keyring_backend}" \
      --node "${ROLLUP_RPC_URL}" \
      --chain-id "${ROLLUP_CHAIN_ID}" \
      --gas "${ROLLUP_GAS}" \
      --gas-adjustment "${ROLLUP_GAS_ADJUSTMENT}" \
      --gas-prices "${ROLLUP_GAS_PRICES}" \
      --yes \
      --output json
  else
    printf '%s\n' \
      --from "${from_key_name}" \
      --keyring-backend "${keyring_backend}" \
      --node "${ROLLUP_RPC_URL}" \
      --chain-id "${ROLLUP_CHAIN_ID}" \
      --gas "${ROLLUP_GAS}" \
      --gas-adjustment "${ROLLUP_GAS_ADJUSTMENT}" \
      --gas-prices "${ROLLUP_GAS_PRICES}" \
      --yes \
      --output json
  fi
}

key_args() {
  key_args_for "${ROLLUP_KEY_NAME}" "${ROLLUP_KEYRING_BACKEND}"
}

key_args_for() {
  local _key_name="${1:-${ROLLUP_KEY_NAME}}"
  local keyring_backend="${2:-${ROLLUP_KEYRING_BACKEND}}"
  if [[ -n "${ROLLUP_HOME}" ]]; then
    printf '%s\n' --home "${ROLLUP_HOME}" --keyring-backend "${keyring_backend}"
  else
    printf '%s\n' --keyring-backend "${keyring_backend}"
  fi
}

human_address_for() {
  local key_name="${1:?key name is required}"
  local keyring_backend="${2:-${ROLLUP_KEYRING_BACKEND}}"
  mapfile -t KEY_ARGS < <(key_args_for "${key_name}" "${keyring_backend}")
  "${MINITIAD_BIN}" keys show "${key_name}" --address "${KEY_ARGS[@]}"
}

hex_address_for() {
  local key_name="${1:?key name is required}"
  local keyring_backend="${2:-${ROLLUP_KEYRING_BACKEND}}"
  local key_addr parsed

  key_addr="$(human_address_for "${key_name}" "${keyring_backend}")"
  parsed="$("${MINITIAD_BIN}" keys parse "${key_addr}")"

  awk '/^bytes:/ { print "0x" $2 }' <<<"${parsed}"
}

deployer_hex_address() {
  hex_address_for "${ROLLUP_KEY_NAME}" "${ROLLUP_KEYRING_BACKEND}"
}

module_address() {
  if [[ -n "${LENDPAY_PACKAGE_ADDRESS}" ]]; then
    printf '%s\n' "${LENDPAY_PACKAGE_ADDRESS}"
  else
    deployer_hex_address
  fi
}
