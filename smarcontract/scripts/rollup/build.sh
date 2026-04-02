#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
MINITIAD_BIN="${MINITIAD_BIN:-minitiad}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/common.sh"

BUILD_ARGS=(move build --path "${ROOT_DIR}")

if [[ -n "${ROLLUP_KEY_NAME:-}" || -n "${LENDPAY_PACKAGE_ADDRESS:-}" ]]; then
  BUILD_ARGS+=(--named-addresses "lendpay=$(module_address)")
else
  BUILD_ARGS+=(--dev)
fi

echo "Building Move package from ${ROOT_DIR}"
"${MINITIAD_BIN}" "${BUILD_ARGS[@]}"
