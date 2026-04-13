#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/local-stack-common.sh"

ensure_dirs
load_backend_env

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

print_oracle_pair() {
  local pair="$1"
  local base="${pair%/*}"
  local quote="${pair#*/}"
  local pairs_json="$2"
  local price_json=""
  local raw_price="0"
  local decimals="?"
  local block_height="0"
  local block_timestamp=""

  if ! jq -e --arg base "$base" --arg quote "$quote" '.currency_pairs[]? | select(.Base == $base and .Quote == $quote)' >/dev/null <<<"$pairs_json"; then
    printf -- "- %-11s: not tracked on rollup\n" "$pair"
    return 0
  fi

  price_json="$(minitiad_with_env query oracle price "$base" "$quote" --output json 2>/dev/null || true)"
  if [[ -z "$price_json" ]]; then
    printf -- "- %-11s: tracked, but price query failed\n" "$pair"
    return 0
  fi

  raw_price="$(jq -r '.price.price // "0"' <<<"$price_json")"
  decimals="$(jq -r '.decimals // "?"' <<<"$price_json")"
  block_height="$(jq -r '.price.block_height // "0"' <<<"$price_json")"
  block_timestamp="$(jq -r '.price.block_timestamp // ""' <<<"$price_json")"

  if [[ "$raw_price" == "0" || "$block_height" == "0" ]]; then
    printf -- "- %-11s: tracked, no live update yet (raw=%s decimals=%s height=%s)\n" "$pair" "$raw_price" "$decimals" "$block_height"
  else
    printf -- "- %-11s: live (raw=%s decimals=%s height=%s at %s)\n" "$pair" "$raw_price" "$decimals" "$block_height" "$block_timestamp"
  fi
}

format_balances() {
  local endpoint="$1"
  local address="$2"
  local payload=""
  local summary=""

  payload="$(curl -fsS --max-time 3 "$endpoint/cosmos/bank/v1beta1/balances/$address" 2>/dev/null || true)"
  if [[ -z "$payload" ]]; then
    printf '%s' "unavailable"
    return 0
  fi

  summary="$(jq -r '[.balances[]? | "\(.amount)\(.denom)"] | if length == 0 then "empty" else join(", ") end' <<<"$payload" 2>/dev/null || true)"
  if [[ -z "$summary" ]]; then
    printf '%s' "unavailable"
    return 0
  fi

  printf '%s' "$summary"
}

print_system_key_balances() {
  local config_path="$HOME/.weave/data/minitia.config.json"
  local l1_rest="${INITIA_L1_REST_URL:-https://rest.testnet.initia.xyz}"
  local l2_rest="http://localhost:1317"
  local bridge_l1=""
  local bridge_l2=""
  local output_l1=""
  local output_l2=""
  local challenger_l1=""
  local challenger_l2=""

  if [[ ! -f "$config_path" ]]; then
    return 0
  fi

  if ! command -v jq >/dev/null 2>&1; then
    return 0
  fi

  bridge_l1="$(jq -r '.system_keys.bridge_executor.l1_address // ""' "$config_path")"
  bridge_l2="$(jq -r '.system_keys.bridge_executor.l2_address // ""' "$config_path")"
  output_l1="$(jq -r '.system_keys.output_submitter.l1_address // ""' "$config_path")"
  output_l2="$(jq -r '.system_keys.output_submitter.l2_address // ""' "$config_path")"
  challenger_l1="$(jq -r '.system_keys.challenger.l1_address // ""' "$config_path")"
  challenger_l2="$(jq -r '.system_keys.challenger.l2_address // ""' "$config_path")"

  echo
  echo "System keys"
  if [[ -n "$bridge_l1" || -n "$bridge_l2" ]]; then
    echo "- BridgeExecutor L1: $(format_balances "$l1_rest" "$bridge_l1")"
    echo "- BridgeExecutor L2: $(format_balances "$l2_rest" "$bridge_l2")"
  fi

  if [[ -n "$output_l1" || -n "$output_l2" ]]; then
    echo "- OutputSubmitter L1: $(format_balances "$l1_rest" "$output_l1")"
    echo "- OutputSubmitter L2: $(format_balances "$l2_rest" "$output_l2")"
  fi

  if [[ -n "$challenger_l1" || -n "$challenger_l2" ]]; then
    echo "- Challenger L1: $(format_balances "$l1_rest" "$challenger_l1")"
    echo "- Challenger L2: $(format_balances "$l2_rest" "$challenger_l2")"
  fi

  echo "- note             : having LEND on L2 is not enough; relayer and OPinit still need funded system keys and running services"
}

print_oracle_bridge() {
  local relayer_config="$HOME/.relayer/config.json"
  local opinit_dir="$HOME/.opinit"
  local pairs_json=""

  echo
  echo "Oracle bridge"
  if [[ -f "$relayer_config" ]]; then
    echo "- relayer config: present ($relayer_config)"
  else
    echo "- relayer config: missing ($relayer_config)"
  fi

  if [[ -d "$opinit_dir" ]]; then
    echo "- opinit config : present ($opinit_dir)"
  else
    echo "- opinit config : missing ($opinit_dir)"
  fi

  echo "- note          : make up does not start Rapid relayer or OPinit bots"

  if ! rollup_rpc_up; then
    echo "- rollup oracle : unavailable because rollup RPC is down"
    return 0
  fi

  if ! command -v jq >/dev/null 2>&1; then
    echo "- rollup oracle : jq is required for pair diagnostics"
    return 0
  fi

  pairs_json="$(minitiad_with_env query oracle currency-pairs --output json 2>/dev/null || true)"
  if [[ -z "$pairs_json" ]]; then
    echo "- rollup oracle : unavailable because minitiad or rollup home could not be resolved"
    return 0
  fi

  print_oracle_pair "INIT/USD" "$pairs_json"
  print_oracle_pair "BTC/USD" "$pairs_json"
  print_oracle_pair "ETH/USD" "$pairs_json"
}

echo "LendPay local stack status"
if manage_local_postgres; then
  if postgres_up; then
    printf '%-10s pid=%-8s health=%s\n' "postgres" "-" "up"
  else
    printf '%-10s pid=%-8s health=%s\n' "postgres" "-" "down"
  fi
else
  printf '%-10s pid=%-8s health=%s\n' "postgres" "-" "external"
fi
print_service "rollup" "$ROLLUP_PID_FILE" rollup_rpc_up
print_service "backend" "$BACKEND_PID_FILE" backend_up
print_service "frontend" "$FRONTEND_PID_FILE" frontend_up
print_service "docs" "$DOCS_PID_FILE" docs_up

echo
echo "Endpoints"
echo "- postgres   : $(postgres_target_summary)"
echo "- rollup rpc : http://localhost:26657"
echo "- rollup rest: http://localhost:1317"
echo "- backend    : http://localhost:8080"
echo "- frontend   : http://localhost:5173"
echo "- docs       : http://localhost:4173"
if looks_like_pooled_postgres_url "$(database_url)" && [[ -z "${DIRECT_DATABASE_URL:-}" ]]; then
  echo "- note       : pooled DATABASE_URL without DIRECT_DATABASE_URL skips backend schema bootstrap"
fi

print_system_key_balances
print_oracle_bridge
