#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/local-stack-common.sh"

ensure_dirs

print_service() {
  local name="$1"
  local pid_file="$2"
  local check_fn="$3"
  local pid=""
  local health="down"

  pid="$(pid_status "$pid_file")"
  if "$check_fn"; then
    health="up"
  fi

  if [[ -n "$pid" ]]; then
    printf '%-10s pid=%-8s health=%s\n' "$name" "$pid" "$health"
  else
    printf '%-10s pid=%-8s health=%s\n' "$name" "-" "$health"
  fi
}

echo "LendPay local stack status"
if postgres_up; then
  printf '%-10s pid=%-8s health=%s\n' "postgres" "-" "up"
else
  printf '%-10s pid=%-8s health=%s\n' "postgres" "-" "down"
fi
print_service "rollup" "$ROLLUP_PID_FILE" rollup_rpc_up
print_service "backend" "$BACKEND_PID_FILE" backend_up
print_service "frontend" "$FRONTEND_PID_FILE" frontend_up
print_service "docs" "$DOCS_PID_FILE" docs_up

echo
echo "Endpoints"
echo "- postgres   : postgresql://postgres:postgres@127.0.0.1:55432/lendpay_dev"
echo "- rollup rpc : http://127.0.0.1:26657"
echo "- rollup rest: http://127.0.0.1:1317"
echo "- backend    : http://127.0.0.1:8080"
echo "- frontend   : http://127.0.0.1:5173"
echo "- docs       : http://127.0.0.1:4173"
