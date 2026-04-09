#!/usr/bin/env bash

set -euo pipefail

MINITIAD_BIN="${MINITIAD_BIN:-/opt/minitiad/minitiad}"
ROLLUP_HOME="${ROLLUP_HOME:-/data/rollup-home}"
ROLLUP_SEED_HOME="${ROLLUP_SEED_HOME:-/opt/lendpay-rollup/home-seed}"

if [[ ! -x "$MINITIAD_BIN" ]]; then
  echo "minitiad binary is missing at $MINITIAD_BIN" >&2
  exit 1
fi

mkdir -p "$ROLLUP_HOME"

if [[ ! -f "$ROLLUP_HOME/config/genesis.json" ]]; then
  echo "Seeding rollup home into $ROLLUP_HOME"
  mkdir -p "$ROLLUP_HOME"
  cp -a "$ROLLUP_SEED_HOME"/. "$ROLLUP_HOME"/
fi

rm -f "$ROLLUP_HOME/app.log"
find "$ROLLUP_HOME/config" -maxdepth 1 -type f -name 'write-file-atomic-*' -delete 2>/dev/null || true

export LD_LIBRARY_PATH="/opt/minitiad${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"

exec "$MINITIAD_BIN" start --home "$ROLLUP_HOME"
