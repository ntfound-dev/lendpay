#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/common.sh"

echo "Running Move tests from ${ROOT_DIR}"
"${MINITIAD_BIN}" move test --path "${ROOT_DIR}" --dev
