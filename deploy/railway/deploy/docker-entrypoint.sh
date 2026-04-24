#!/usr/bin/env bash

set -euo pipefail

MINITIAD_BIN="${MINITIAD_BIN:-/opt/minitiad/minitiad}"
ROLLUP_HOME="${ROLLUP_HOME:-/data/rollup-home}"
ROLLUP_SEED_HOME="${ROLLUP_SEED_HOME:-/opt/lendpay-rollup/home-seed}"
MINITIAD_ARCHIVE_URL="${MINITIAD_ARCHIVE_URL:-}"
ROLLUP_HOME_SEED_ARCHIVE_URL="${ROLLUP_HOME_SEED_ARCHIVE_URL:-}"

is_placeholder_url() {
  local url="$1"
  [[ -z "$url" || "$url" == "..." || "$url" == *"://..." || "$url" == *"ganti-"* ]]
}

is_valid_archive_url() {
  local url="$1"
  [[ "$url" =~ ^https?://[^[:space:]\'\"]+$ ]]
}

url_decode() {
  local value="${1//+/ }"
  printf '%b' "${value//%/\\x}"
}

query_param() {
  local url="$1"
  local key="$2"
  local query pair name value
  local -a pairs

  query="${url#*\?}"
  if [[ "$query" == "$url" ]]; then
    return 1
  fi

  IFS='&' read -r -a pairs <<< "$query"
  for pair in "${pairs[@]}"; do
    name="${pair%%=*}"
    value="${pair#*=}"
    if [[ "$name" == "$key" ]]; then
      url_decode "$value"
      return 0
    fi
  done

  return 1
}

presigned_url_expiry_epoch() {
  local url="$1"
  local amz_date expires issued_epoch

  amz_date="$(query_param "$url" "X-Amz-Date" 2>/dev/null || true)"
  expires="$(query_param "$url" "X-Amz-Expires" 2>/dev/null || true)"

  if [[ ! "$amz_date" =~ ^[0-9]{8}T[0-9]{6}Z$ || ! "$expires" =~ ^[0-9]+$ ]]; then
    return 1
  fi

  issued_epoch="$(date -u -d \
    "${amz_date:0:4}-${amz_date:4:2}-${amz_date:6:2} ${amz_date:9:2}:${amz_date:11:2}:${amz_date:13:2} UTC" \
    +%s 2>/dev/null || true)"

  if [[ -z "$issued_epoch" ]]; then
    return 1
  fi

  printf '%s\n' "$((issued_epoch + expires))"
}

print_signed_url_hint() {
  local url="$1"
  local expires_at now_epoch expires_utc

  expires_at="$(presigned_url_expiry_epoch "$url" 2>/dev/null || true)"
  if [[ -z "$expires_at" ]]; then
    return
  fi

  expires_utc="$(date -u -d "@$expires_at" '+%Y-%m-%d %H:%M:%S UTC' 2>/dev/null || true)"
  if [[ -z "$expires_utc" ]]; then
    return
  fi

  now_epoch="$(date -u +%s)"
  if (( now_epoch >= expires_at )); then
    echo "The signed archive URL expired at $expires_utc." >&2
    echo "Re-upload the archive and update the Railway variable with a fresh URL before redeploying." >&2
  else
    echo "The signed archive URL is valid until $expires_utc." >&2
  fi
}

download_archive() {
  local url="$1"
  local destination="$2"
  local label="$3"
  local archive_tmp

  if is_placeholder_url "$url"; then
    echo "$label is not set to a real archive URL." >&2
    echo "Replace the placeholder value before deploying the rollup service." >&2
    exit 1
  fi

  if ! is_valid_archive_url "$url"; then
    echo "$label is not a valid direct archive URL." >&2
    echo "Use an http(s) .tar.gz download URL reachable from Railway, without quotes or local file paths." >&2
    exit 1
  fi

  mkdir -p "$destination"
  archive_tmp="$(mktemp)"

  if ! curl -fsSL "$url" -o "$archive_tmp"; then
    rm -f "$archive_tmp"
    echo "Failed to download $label from $url." >&2
    print_signed_url_hint "$url"
    echo "Check that the archive URL is reachable from Railway." >&2
    exit 1
  fi

  if ! tar -xzf "$archive_tmp" -C "$destination"; then
    rm -f "$archive_tmp"
    echo "Downloaded $label, but the archive could not be extracted." >&2
    echo "Make sure it is a valid .tar.gz containing the expected runtime files." >&2
    exit 1
  fi

  rm -f "$archive_tmp"
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
    echo "Provide a staged runtime locally or set MINITIAD_ARCHIVE_URL to a tar.gz archive that extracts minitiad and its shared libraries." >&2
    exit 1
  fi
}

ensure_seed_home() {
  if [[ -f "$ROLLUP_SEED_HOME/config/genesis.json" ]]; then
    return
  fi

  if [[ -n "$ROLLUP_HOME_SEED_ARCHIVE_URL" ]]; then
    echo "Downloading rollup seed home from ROLLUP_HOME_SEED_ARCHIVE_URL"
    download_archive "$ROLLUP_HOME_SEED_ARCHIVE_URL" "$ROLLUP_SEED_HOME" "ROLLUP_HOME_SEED_ARCHIVE_URL"
  fi

  if [[ ! -f "$ROLLUP_SEED_HOME/config/genesis.json" ]]; then
    echo "rollup seed home is missing at $ROLLUP_SEED_HOME" >&2
    echo "Provide a staged seed home locally or set ROLLUP_HOME_SEED_ARCHIVE_URL to a tar.gz archive of the rollup home seed." >&2
    exit 1
  fi
}

ensure_minitiad_runtime

mkdir -p "$ROLLUP_HOME"

if [[ ! -f "$ROLLUP_HOME/config/genesis.json" ]]; then
  ensure_seed_home
  echo "Seeding rollup home into $ROLLUP_HOME"
  mkdir -p "$ROLLUP_HOME"
  cp -a "$ROLLUP_SEED_HOME"/. "$ROLLUP_HOME"/
fi

rm -f "$ROLLUP_HOME/app.log"
find "$ROLLUP_HOME/config" -maxdepth 1 -type f -name 'write-file-atomic-*' -delete 2>/dev/null || true

RUNTIME_LIB_DIR="$(dirname "$MINITIAD_BIN")"
export LD_LIBRARY_PATH="${RUNTIME_LIB_DIR}${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"

exec "$MINITIAD_BIN" start --home "$ROLLUP_HOME"
