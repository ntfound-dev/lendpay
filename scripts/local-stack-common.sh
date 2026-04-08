#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STACK_DIR="$ROOT_DIR/.run/local-stack"
PID_DIR="$STACK_DIR/pids"
LOG_DIR="$STACK_DIR/logs"

ROLLUP_PID_FILE="$PID_DIR/rollup.pid"
BACKEND_PID_FILE="$PID_DIR/backend.pid"
FRONTEND_PID_FILE="$PID_DIR/frontend.pid"
DOCS_PID_FILE="$PID_DIR/docs.pid"
POSTGRES_COMPOSE_FILE="$ROOT_DIR/docker-compose.local-stack.yml"
POSTGRES_SERVICE_NAME="postgres"

ROLLUP_LOG_FILE="$LOG_DIR/rollup.log"
BACKEND_LOG_FILE="$LOG_DIR/backend.log"
FRONTEND_LOG_FILE="$LOG_DIR/frontend.log"
DOCS_LOG_FILE="$LOG_DIR/docs.log"

BACKEND_ENV_FILE="$ROOT_DIR/backend/.env"
FRONTEND_ENV_FILE="$ROOT_DIR/frontend/.env"

ensure_dirs() {
  mkdir -p "$PID_DIR" "$LOG_DIR"
}

load_backend_env() {
  if [[ -f "$BACKEND_ENV_FILE" ]]; then
    set -a
    # shellcheck disable=SC1090
    source "$BACKEND_ENV_FILE"
    set +a
  fi
}

node_major() {
  local node_bin="$1"
  "$node_bin" -p 'Number(process.versions.node.split(".")[0])' 2>/dev/null || echo 0
}

resolve_node_bin_dir() {
  local current_node=""
  current_node="$(command -v node || true)"
  if [[ -n "$current_node" ]] && [[ "$(node_major "$current_node")" -ge 20 ]]; then
    dirname "$current_node"
    return 0
  fi

  local candidate=""
  local candidates=()
  shopt -s nullglob
  candidates=("$HOME"/.nvm/versions/node/v20*/bin "$HOME"/.nvm/versions/node/v22*/bin)
  shopt -u nullglob

  for candidate in $(printf '%s\n' "${candidates[@]}" | sort -Vr); do
    if [[ -x "$candidate/node" ]] && [[ "$(node_major "$candidate/node")" -ge 20 ]]; then
      echo "$candidate"
      return 0
    fi
  done

  return 1
}

resolve_minitiad_bin() {
  if [[ -n "${MINITIAD_BIN:-}" ]] && [[ -x "${MINITIAD_BIN:-}" ]]; then
    echo "$MINITIAD_BIN"
    return 0
  fi

  local candidate=""
  for candidate in \
    "/tmp/lendpay-minimove-bin-o1QzOW/minitiad" \
    "$HOME/.weave/data/minimove@v1.1.11/minitiad"; do
    if [[ -x "$candidate" ]]; then
      echo "$candidate"
      return 0
    fi
  done

  return 1
}

resolve_rollup_home() {
  local candidate=""
  for candidate in \
    "${ROLLUP_HOME:-}" \
    "$HOME/.minitia-testnet3" \
    "$HOME/.minitia" \
    "/tmp/lendpay-minitia-home"; do
    if [[ -d "$candidate" ]]; then
      echo "$candidate"
      return 0
    fi
  done

  return 1
}

read_pid() {
  local pid_file="$1"
  if [[ -f "$pid_file" ]]; then
    tr -d '[:space:]' <"$pid_file"
  fi
}

is_pid_alive() {
  local pid="${1:-}"
  [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null
}

pid_status() {
  local pid_file="$1"
  local pid=""
  pid="$(read_pid "$pid_file")"
  if is_pid_alive "$pid"; then
    printf '%s' "$pid"
  else
    printf '%s' ""
  fi
}

rollup_rpc_up() {
  curl -fsS --max-time 2 "http://127.0.0.1:26657/status" >/dev/null 2>&1
}

rollup_rest_up() {
  curl -fsS --max-time 2 "http://127.0.0.1:1317/cosmos/base/tendermint/v1beta1/node_info" >/dev/null 2>&1
}

rollup_up() {
  rollup_rpc_up && rollup_rest_up
}

backend_up() {
  curl -fsS --max-time 2 "http://127.0.0.1:8080/api/v1/health" >/dev/null 2>&1
}

frontend_up() {
  curl -fsSI --max-time 2 "http://127.0.0.1:5173" >/dev/null 2>&1
}

docs_up() {
  curl -fsSI --max-time 2 "http://127.0.0.1:4173" >/dev/null 2>&1
}

postgres_container_id() {
  docker compose -f "$POSTGRES_COMPOSE_FILE" ps -q "$POSTGRES_SERVICE_NAME" 2>/dev/null || true
}

postgres_up() {
  local container_id=""
  container_id="$(postgres_container_id)"
  if [[ -z "$container_id" ]]; then
    return 1
  fi

  local health=""
  health="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$container_id" 2>/dev/null || true)"
  [[ "$health" == "healthy" || "$health" == "running" ]]
}

wait_for_check() {
  local name="$1"
  local attempts="$2"
  local sleep_seconds="$3"
  local check_fn="$4"
  local log_file="${5:-}"
  local i=0

  while (( i < attempts )); do
    if "$check_fn"; then
      return 0
    fi
    sleep "$sleep_seconds"
    i=$((i + 1))
  done

  echo "$name did not become ready in time." >&2
  if [[ -n "$log_file" ]] && [[ -f "$log_file" ]]; then
    echo "Recent $name log:" >&2
    tail -n 60 "$log_file" >&2 || true
  fi
  return 1
}

restart_if_unhealthy() {
  local name="$1"
  local pid_file="$2"
  local check_fn="$3"
  local pid=""

  pid="$(pid_status "$pid_file")"
  if [[ -n "$pid" ]] && ! "$check_fn"; then
    echo "$name has a stale or unhealthy process (pid $pid). Restarting."
    stop_detached "$name" "$pid_file"
  fi
}

start_detached() {
  local name="$1"
  local workdir="$2"
  local pid_file="$3"
  local log_file="$4"
  shift 4

  local existing_pid=""
  existing_pid="$(pid_status "$pid_file")"
  if [[ -n "$existing_pid" ]]; then
    echo "$name already running with pid $existing_pid."
    return 0
  fi

  : >"$log_file"
  (
    cd "$workdir"
    setsid "$@" >>"$log_file" 2>&1 &
    echo $! >"$pid_file"
  )

  sleep 1
  local started_pid=""
  started_pid="$(pid_status "$pid_file")"
  if [[ -z "$started_pid" ]]; then
    echo "Failed to start $name. Recent log:" >&2
    tail -n 40 "$log_file" >&2 || true
    return 1
  fi

  echo "$name started with pid $started_pid."
}

stop_detached() {
  local name="$1"
  local pid_file="$2"

  local pid=""
  pid="$(read_pid "$pid_file")"
  if [[ -z "$pid" ]]; then
    echo "$name pid file not found."
    return 0
  fi

  if ! is_pid_alive "$pid"; then
    rm -f "$pid_file"
    echo "$name already stopped."
    return 0
  fi

  kill -TERM "-$pid" 2>/dev/null || kill -TERM "$pid" 2>/dev/null || true
  sleep 1

  if is_pid_alive "$pid"; then
    kill -KILL "-$pid" 2>/dev/null || kill -KILL "$pid" 2>/dev/null || true
  fi

  rm -f "$pid_file"
  echo "$name stopped."
}
