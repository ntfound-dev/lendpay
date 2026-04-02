#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/local-stack-common.sh"

ensure_dirs
load_backend_env

NODE_BIN_DIR="$(resolve_node_bin_dir || true)"
MINITIAD_PATH="$(resolve_minitiad_bin || true)"
ROLLUP_HOME_PATH="$(resolve_rollup_home || true)"

if [[ -z "$NODE_BIN_DIR" ]]; then
  echo "Node.js 20+ was not found. Install Node 20 or make it available in PATH." >&2
  exit 1
fi

if [[ -z "$MINITIAD_PATH" ]]; then
  echo "minitiad binary was not found. Set MINITIAD_BIN in backend/.env or install MiniMove." >&2
  exit 1
fi

if [[ -z "$ROLLUP_HOME_PATH" ]]; then
  echo "Rollup home was not found. Set ROLLUP_HOME in backend/.env." >&2
  exit 1
fi

MINITIAD_DIR="$(dirname "$MINITIAD_PATH")"

if ! rollup_rpc_up || ! rollup_rest_up; then
  start_detached \
    "rollup" \
    "$ROOT_DIR" \
    "$ROLLUP_PID_FILE" \
    "$ROLLUP_LOG_FILE" \
    /usr/bin/env \
    "LD_LIBRARY_PATH=$MINITIAD_DIR:${LD_LIBRARY_PATH:-}" \
    "$MINITIAD_PATH" start --home "$ROLLUP_HOME_PATH"

  wait_for_check "rollup RPC" 30 1 rollup_rpc_up
  wait_for_check "rollup REST" 30 1 rollup_rest_up
else
  echo "rollup already listening on 26657 and 1317."
fi

if ! backend_up; then
  start_detached \
    "backend" \
    "$ROOT_DIR/backend" \
    "$BACKEND_PID_FILE" \
    "$BACKEND_LOG_FILE" \
    /usr/bin/env \
    "PATH=$NODE_BIN_DIR:$PATH" \
    "MINITIAD_BIN=$MINITIAD_PATH" \
    "ROLLUP_HOME=$ROLLUP_HOME_PATH" \
    ./node_modules/.bin/tsx watch src/server.ts

  wait_for_check "backend" 45 1 backend_up
else
  echo "backend already listening on 8080."
fi

if ! frontend_up; then
  start_detached \
    "frontend" \
    "$ROOT_DIR/frontend" \
    "$FRONTEND_PID_FILE" \
    "$FRONTEND_LOG_FILE" \
    /usr/bin/env \
    "PATH=$NODE_BIN_DIR:$PATH" \
    ./node_modules/.bin/vite --host 0.0.0.0

  wait_for_check "frontend" 45 1 frontend_up
else
  echo "frontend already listening on 5173."
fi

cat <<EOF

Local LendPay stack is up.

- Rollup RPC:  http://127.0.0.1:26657
- Rollup REST: http://127.0.0.1:1317
- Backend API: http://127.0.0.1:8080/api/v1/health
- Frontend:    http://127.0.0.1:5173

Logs:
- $ROLLUP_LOG_FILE
- $BACKEND_LOG_FILE
- $FRONTEND_LOG_FILE

Use:
- ./scripts/local-stack-status.sh
- ./scripts/local-stack-down.sh
EOF
