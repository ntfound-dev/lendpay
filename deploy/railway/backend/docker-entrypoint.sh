#!/usr/bin/env bash

set -euo pipefail

APP_BIN="${APP_BIN:-/app/lendpay-backend}"
ENABLE_LIVE_ROLLUP_WRITES="${ENABLE_LIVE_ROLLUP_WRITES:-false}"
MINITIAD_BIN="${MINITIAD_BIN:-/opt/minitiad/minitiad}"
MINITIAD_ARCHIVE_URL="${MINITIAD_ARCHIVE_URL:-}"
ROLLUP_HOME="${ROLLUP_HOME:-/data/rollup-home}"
ROLLUP_KEY_NAME="${ROLLUP_KEY_NAME:-}"
ROLLUP_KEYRING_BACKEND="${ROLLUP_KEYRING_BACKEND:-test}"
ROLLUP_OPERATOR_KEYRING_ARCHIVE_B64="${ROLLUP_OPERATOR_KEYRING_ARCHIVE_B64:-}"
ROLLUP_OPERATOR_MNEMONIC="${ROLLUP_OPERATOR_MNEMONIC:-}"
ROLLUP_OPERATOR_MNEMONIC_FILE="${ROLLUP_OPERATOR_MNEMONIC_FILE:-}"

cleanup_files=()

cleanup() {
  local path
  for path in "${cleanup_files[@]:-}"; do
    rm -f "$path"
  done
}

trap cleanup EXIT

is_truthy() {
  local value
  value="$(printf '%s' "$1" | tr '[:upper:]' '[:lower:]')"
  [[ "$value" == "1" || "$value" == "true" || "$value" == "yes" || "$value" == "on" ]]
}

is_placeholder_url() {
  local url="$1"
  [[ -z "$url" || "$url" == "..." || "$url" == *"://..." || "$url" == *"ganti-"* ]]
}

is_valid_archive_url() {
  local url="$1"
  [[ "$url" =~ ^https?://[^[:space:]\'\"]+$ ]]
}

download_archive() {
  local url="$1"
  local destination="$2"
  local label="$3"
  local archive_tmp

  if is_placeholder_url "$url"; then
    echo "$label is not set to a real archive URL." >&2
    exit 1
  fi

  if ! is_valid_archive_url "$url"; then
    echo "$label must be a direct http(s) archive URL." >&2
    exit 1
  fi

  mkdir -p "$destination"
  archive_tmp="$(mktemp)"
  cleanup_files+=("$archive_tmp")

  if ! curl -fsSL "$url" -o "$archive_tmp"; then
    echo "Failed to download $label from $url" >&2
    exit 1
  fi

  if ! tar -xzf "$archive_tmp" -C "$destination"; then
    echo "Downloaded $label, but the archive could not be extracted." >&2
    exit 1
  fi
}

ensure_minitiad_runtime() {
  if [[ -x "$MINITIAD_BIN" ]]; then
    return
  fi

  if [[ -n "$MINITIAD_ARCHIVE_URL" ]]; then
    echo "Downloading minitiad runtime from MINITIAD_ARCHIVE_URL"
    download_archive "$MINITIAD_ARCHIVE_URL" "$(dirname "$MINITIAD_BIN")" "MINITIAD_ARCHIVE_URL"
  fi

  if [[ -f "$MINITIAD_BIN" ]]; then
    chmod +x "$MINITIAD_BIN"
  fi

  if [[ ! -x "$MINITIAD_BIN" ]]; then
    echo "minitiad binary is missing at $MINITIAD_BIN" >&2
    echo "Provide a staged runtime in the image or set MINITIAD_ARCHIVE_URL." >&2
    exit 1
  fi
}

export_runtime_library_path() {
  local runtime_lib_dir
  runtime_lib_dir="$(dirname "$MINITIAD_BIN")"
  export LD_LIBRARY_PATH="${runtime_lib_dir}${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
}

key_exists() {
  "$MINITIAD_BIN" keys show "$ROLLUP_KEY_NAME" \
    --address \
    --home "$ROLLUP_HOME" \
    --keyring-backend "$ROLLUP_KEYRING_BACKEND" \
    >/dev/null 2>&1
}

resolve_mnemonic_source() {
  local mnemonic_file

  if [[ -n "$ROLLUP_OPERATOR_MNEMONIC_FILE" && -f "$ROLLUP_OPERATOR_MNEMONIC_FILE" ]]; then
    printf '%s\n' "$ROLLUP_OPERATOR_MNEMONIC_FILE"
    return
  fi

  if [[ -n "$ROLLUP_OPERATOR_MNEMONIC" && -f "$ROLLUP_OPERATOR_MNEMONIC" ]]; then
    printf '%s\n' "$ROLLUP_OPERATOR_MNEMONIC"
    return
  fi

  if [[ -z "${ROLLUP_OPERATOR_MNEMONIC// }" ]]; then
    printf '%s\n' ""
    return
  fi

  mnemonic_file="$(mktemp)"
  chmod 600 "$mnemonic_file"
  printf '%s\n' "$ROLLUP_OPERATOR_MNEMONIC" >"$mnemonic_file"
  cleanup_files+=("$mnemonic_file")
  printf '%s\n' "$mnemonic_file"
}

restore_keyring_archive() {
  local archive_tmp

  if [[ -z "${ROLLUP_OPERATOR_KEYRING_ARCHIVE_B64// }" ]]; then
    return
  fi

  archive_tmp="$(mktemp)"
  cleanup_files+=("$archive_tmp")

  if ! printf '%s' "$ROLLUP_OPERATOR_KEYRING_ARCHIVE_B64" | base64 -d >"$archive_tmp" 2>/dev/null; then
    echo "ROLLUP_OPERATOR_KEYRING_ARCHIVE_B64 is not valid base64." >&2
    exit 1
  fi

  if ! tar -xzf "$archive_tmp" -C "$ROLLUP_HOME"; then
    echo "ROLLUP_OPERATOR_KEYRING_ARCHIVE_B64 could not be extracted into $ROLLUP_HOME." >&2
    exit 1
  fi
}

ensure_operator_key() {
  local mnemonic_source

  if [[ -z "$ROLLUP_KEY_NAME" ]]; then
    echo "ROLLUP_KEY_NAME is required when live rollup writes are enabled." >&2
    exit 1
  fi

  mkdir -p "$ROLLUP_HOME"

  if key_exists; then
    return
  fi

  restore_keyring_archive
  if key_exists; then
    return
  fi

  mnemonic_source="$(resolve_mnemonic_source)"
  if [[ -z "$mnemonic_source" ]]; then
    echo "Live rollup writes were enabled, but the operator key is missing." >&2
    echo "Set ROLLUP_OPERATOR_KEYRING_ARCHIVE_B64, ROLLUP_OPERATOR_MNEMONIC, or ROLLUP_OPERATOR_MNEMONIC_FILE so Railway can import $ROLLUP_KEY_NAME." >&2
    exit 1
  fi

  echo "Importing rollup operator key $ROLLUP_KEY_NAME into $ROLLUP_HOME"
  "$MINITIAD_BIN" keys add "$ROLLUP_KEY_NAME" \
    --recover \
    --source "$mnemonic_source" \
    --home "$ROLLUP_HOME" \
    --keyring-backend "$ROLLUP_KEYRING_BACKEND" \
    --output json \
    >/dev/null

  if ! key_exists; then
    echo "Rollup operator key $ROLLUP_KEY_NAME could not be imported." >&2
    exit 1
  fi
}

if is_truthy "$ENABLE_LIVE_ROLLUP_WRITES"; then
  ensure_minitiad_runtime
  export_runtime_library_path
  ensure_operator_key
fi

exec "$APP_BIN"
