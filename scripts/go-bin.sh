#!/usr/bin/env bash

set -euo pipefail

GO_BIN="${GO_BIN:-$(command -v go || true)}"

if [[ -z "$GO_BIN" && -x /tmp/go/bin/go ]]; then
  GO_BIN=/tmp/go/bin/go
fi

if [[ -z "$GO_BIN" ]]; then
  echo "Go was not found in PATH. Install Go 1.23+ or export GO_BIN to the Go binary you want to use." >&2
  exit 1
fi

exec "$GO_BIN" "$@"
