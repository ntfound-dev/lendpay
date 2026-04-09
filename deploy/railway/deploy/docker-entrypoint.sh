#!/usr/bin/env bash

set -euo pipefail

MINITIAD_BIN="${MINITIAD_BIN:-/opt/minitiad/minitiad}"
ROLLUP_HOME="${ROLLUP_HOME:-/data/rollup-home}"
ROLLUP_SEED_HOME="${ROLLUP_SEED_HOME:-/opt/lendpay-rollup/home-seed}"
MINITIAD_ARCHIVE_URL="${MINITIAD_ARCHIVE_URL:-}"
ROLLUP_HOME_SEED_ARCHIVE_URL="${ROLLUP_HOME_SEED_ARCHIVE_URL:-}"

download_archive() {
  local url="$1"
  local destination="$2"

  mkdir -p "$destination"
  curl -fsSL "$url" | tar -xzf - -C "$destination"
}

ensure_minitiad_runtime() {
  if [[ -x "$MINITIAD_BIN" ]]; then
    return
  fi

  if [[ -n "$MINITIAD_ARCHIVE_URL" ]]; then
    echo "Downloading minitiad runtime from MINITIAD_ARCHIVE_URL"
    download_archive "$MINITIAD_ARCHIVE_URL" "$(dirname "$MINITIAD_BIN")"
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
    download_archive "$ROLLUP_HOME_SEED_ARCHIVE_URL" "$ROLLUP_SEED_HOME"
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

export LD_LIBRARY_PATH="/opt/minitiad${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"

exec "$MINITIAD_BIN" start --home "$ROLLUP_HOME"
