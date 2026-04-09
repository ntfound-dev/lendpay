# Railway Deploy

This folder holds the Docker-based deploy path for the local `lendpay-4` runtime on Railway.

## What it expects

1. A staged `minitiad` runtime under `deploy/railway/deploy/runtime/bin`
2. A staged rollup home under `deploy/railway/deploy/runtime/home-seed`
3. A Railway volume mounted at `/data`

## Prepare the runtime from your local machine

From the repo root:

```bash
make railway-deploy-prepare
```

That copies:

- the local `minitiad` binary and shared libraries
- the local rollup home for `lendpay-4`

Important:

- the staged home includes validator and node keys
- `deploy/railway/deploy/runtime` is intentionally gitignored
- do not commit those staged files

## Build locally

```bash
make railway-deploy-build
```

## Railway service setup

1. Create an empty Railway service from this repo.
2. In `Config-as-code`, add the file path `deploy/railway/deploy/railway.json`.
3. If you prefer manual setup, set `RAILWAY_DOCKERFILE_PATH=deploy/railway/deploy/Dockerfile`.
4. Attach a volume at `/data`.
5. Deploy.

Recommended variables:

- `ROLLUP_HOME=/data/rollup-home`
- `MINITIAD_BIN=/opt/minitiad/minitiad`

Useful checks after deploy:

- RPC: `/status` on port `26657`
- REST: `/cosmos/base/tendermint/v1beta1/node_info` on port `1317`

## Notes

- The first boot seeds the Railway volume from the staged `home-seed`.
- Later boots reuse the volume state and do not overwrite an existing seeded home.
- This is meant for the chain runtime itself. Frontend and backend should stay separate services.
