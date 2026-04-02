#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/local-stack-common.sh"

ensure_dirs

stop_detached "frontend" "$FRONTEND_PID_FILE"
stop_detached "backend" "$BACKEND_PID_FILE"
stop_detached "rollup" "$ROLLUP_PID_FILE"

echo "Local LendPay stack shutdown complete."
