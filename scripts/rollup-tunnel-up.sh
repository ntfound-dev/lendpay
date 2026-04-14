#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_ENV_FILE="$ROOT_DIR/backend-go/.env"
RUN_DIR="$ROOT_DIR/.run/rollup-tunnel"
ROLLUP_LOG="$RUN_DIR/rollup.log"
ROLLUP_PID_FILE="$RUN_DIR/rollup.pid"
REST_LOG="$RUN_DIR/rest-tunnel.log"
REST_PID_FILE="$RUN_DIR/rest-tunnel.pid"
RPC_LOG="$RUN_DIR/rpc-tunnel.log"
RPC_PID_FILE="$RUN_DIR/rpc-tunnel.pid"

mkdir -p "$RUN_DIR"

if [[ -f "$BACKEND_ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$BACKEND_ENV_FILE"
  set +a
fi

MINITIAD_BIN="${MINITIAD_BIN:-$HOME/.weave/data/minimove@v1.1.11/minitiad}"
ROLLUP_HOME="${ROLLUP_HOME:-$HOME/.minitia-testnet4}"
CLOUDFLARED_BIN="${CLOUDFLARED_BIN:-$(command -v cloudflared || true)}"

rollup_rpc_up() {
  curl -fsS --max-time 2 http://127.0.0.1:26657/status >/dev/null 2>&1
}

rollup_rest_up() {
  curl -fsS --max-time 2 http://127.0.0.1:1317/cosmos/base/tendermint/v1beta1/node_info >/dev/null 2>&1
}

stop_pid_file() {
  local pid_file="$1"
  if [[ -f "$pid_file" ]]; then
    local pid
    pid="$(cat "$pid_file" 2>/dev/null || true)"
    if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
    fi
    rm -f "$pid_file"
  fi
}

wait_for() {
  local label="$1"
  local attempts="$2"
  local cmd="$3"

  local i
  for ((i=0; i<attempts; i++)); do
    if eval "$cmd"; then
      return 0
    fi
    sleep 1
  done

  echo "$label did not become ready in time." >&2
  return 1
}

extract_tunnel_url() {
  local log_file="$1"
  grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' "$log_file" | tail -n 1
}

start_rollup() {
  if [[ ! -x "$MINITIAD_BIN" ]]; then
    echo "minitiad was not found at: $MINITIAD_BIN" >&2
    exit 1
  fi

  if [[ ! -d "$ROLLUP_HOME" ]]; then
    echo "rollup home was not found at: $ROLLUP_HOME" >&2
    exit 1
  fi

  if rollup_rpc_up && rollup_rest_up; then
    return 0
  fi

  stop_pid_file "$ROLLUP_PID_FILE"
  : >"$ROLLUP_LOG"
  nohup env \
    LD_LIBRARY_PATH="$(dirname "$MINITIAD_BIN")${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}" \
    "$MINITIAD_BIN" start --home "$ROLLUP_HOME" >"$ROLLUP_LOG" 2>&1 &
  echo $! >"$ROLLUP_PID_FILE"

  wait_for "rollup RPC" 45 "rollup_rpc_up"
  wait_for "rollup REST" 45 "rollup_rest_up"
}

start_tunnel() {
  local name="$1"
  local port="$2"
  local pid_file="$3"
  local log_file="$4"

  if [[ -z "$CLOUDFLARED_BIN" ]]; then
    echo "cloudflared was not found in PATH." >&2
    exit 1
  fi

  stop_pid_file "$pid_file"
  : >"$log_file"
  nohup "$CLOUDFLARED_BIN" tunnel --no-autoupdate --url "http://127.0.0.1:$port" >"$log_file" 2>&1 &
  echo $! >"$pid_file"

  wait_for "$name tunnel URL" 30 "[[ -n \"\$(extract_tunnel_url \"$log_file\")\" ]]"
}

start_rollup
start_tunnel "REST" 1317 "$REST_PID_FILE" "$REST_LOG"
start_tunnel "RPC" 26657 "$RPC_PID_FILE" "$RPC_LOG"

REST_URL="$(extract_tunnel_url "$REST_LOG")"
RPC_URL="$(extract_tunnel_url "$RPC_LOG")"

cat <<EOF
Rollup local tunnel is up.

ROLLUP_REST_URL=$REST_URL
ROLLUP_RPC_URL=$RPC_URL

Files:
- rollup log      : $ROLLUP_LOG
- rest tunnel log : $REST_LOG
- rpc tunnel log  : $RPC_LOG
EOF
