#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
MINITIAD_BIN="${MINITIAD_BIN:-minitiad}"

echo "Running Move tests from ${ROOT_DIR}"
"${MINITIAD_BIN}" move test --path "${ROOT_DIR}" --dev
