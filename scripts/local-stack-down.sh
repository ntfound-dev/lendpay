#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/local-stack-common.sh"

ensure_dirs
load_backend_env

stop_detached "docs" "$DOCS_PID_FILE"
stop_detached "frontend" "$FRONTEND_PID_FILE"
stop_detached "backend" "$BACKEND_PID_FILE"
stop_detached "rollup" "$ROLLUP_PID_FILE"
if manage_local_postgres; then
  docker compose -f "$POSTGRES_COMPOSE_FILE" stop "$POSTGRES_SERVICE_NAME" >/dev/null 2>&1 || true
fi

echo "Local LendPay stack shutdown complete."
