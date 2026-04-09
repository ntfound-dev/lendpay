#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_ENV_FILE="$ROOT_DIR/backend/.env"
RUNTIME_DIR="$ROOT_DIR/deploy/railway/deploy/runtime"
BIN_DIR="$RUNTIME_DIR/bin"
HOME_SEED_DIR="$RUNTIME_DIR/home-seed"
ARCHIVE_DIR="$ROOT_DIR/.run/railway-deploy"
BIN_ARCHIVE="$ARCHIVE_DIR/minitiad-runtime.tgz"
HOME_SEED_ARCHIVE="$ARCHIVE_DIR/rollup-home-seed.tgz"

if [[ -f "$BACKEND_ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$BACKEND_ENV_FILE"
  set +a
fi

MINITIAD_SOURCE="${MINITIAD_BIN:-$HOME/.weave/data/minimove@v1.1.11/minitiad}"
ROLLUP_HOME_SOURCE="${ROLLUP_HOME:-$HOME/.minitia-testnet4}"
MINITIAD_SOURCE="$(realpath "$MINITIAD_SOURCE")"
ROLLUP_HOME_SOURCE="$(realpath "$ROLLUP_HOME_SOURCE")"
MINITIAD_SOURCE_DIR="$(dirname "$MINITIAD_SOURCE")"

if [[ ! -x "$MINITIAD_SOURCE" ]]; then
  echo "minitiad binary was not found at: $MINITIAD_SOURCE" >&2
  exit 1
fi

if [[ ! -d "$ROLLUP_HOME_SOURCE" ]]; then
  echo "rollup home was not found at: $ROLLUP_HOME_SOURCE" >&2
  exit 1
fi

mkdir -p "$BIN_DIR" "$HOME_SEED_DIR"
mkdir -p "$ARCHIVE_DIR"

cp "$MINITIAD_SOURCE" "$BIN_DIR/minitiad"

for library in libcompiler.x86_64.so libmovevm.x86_64.so; do
  if [[ -f "$MINITIAD_SOURCE_DIR/$library" ]]; then
    cp "$MINITIAD_SOURCE_DIR/$library" "$BIN_DIR/$library"
  fi
done

rsync -a --delete \
  --exclude 'app.log' \
  --exclude 'config/addrbook.json' \
  --exclude 'config/write-file-atomic-*' \
  --exclude 'data/cs.wal' \
  --exclude 'keyring-test/' \
  --exclude 'keyring-os/' \
  "$ROLLUP_HOME_SOURCE"/ "$HOME_SEED_DIR"/

chmod +x "$BIN_DIR/minitiad"

tar -czf "$BIN_ARCHIVE" -C "$BIN_DIR" .
tar -czf "$HOME_SEED_ARCHIVE" -C "$HOME_SEED_DIR" .

cat <<EOF
Railway deploy runtime staged.

- Binary source : $MINITIAD_SOURCE
- Rollup home   : $ROLLUP_HOME_SOURCE
- Runtime bin   : $BIN_DIR
- Runtime seed  : $HOME_SEED_DIR
- Bin archive   : $BIN_ARCHIVE
- Seed archive  : $HOME_SEED_ARCHIVE

Important:
- The staged home contains validator and node keys. Keep deploy/railway/deploy/runtime out of git.
- For GitHub-based Railway builds, upload the archives somewhere private and set MINITIAD_ARCHIVE_URL and ROLLUP_HOME_SEED_ARCHIVE_URL in Railway.
- On Railway, attach a volume to /data and keep ROLLUP_HOME=/data/rollup-home.
- Use the Dockerfile at deploy/railway/deploy/Dockerfile for the rollup service.
EOF
