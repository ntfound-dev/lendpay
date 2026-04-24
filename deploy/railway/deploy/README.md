# Railway Deploy

This folder holds the Docker-based deploy path for the local `lendpay-4` runtime on Railway.

The GitHub-tracked version of this folder only keeps the Docker recipe and an empty runtime skeleton. Real runtime files stay local and must be staged separately.

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
- two tar.gz archives under `.run/railway-deploy`

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
- `MINITIAD_ARCHIVE_URL=<private tar.gz URL for minitiad + libs>`
- `ROLLUP_HOME_SEED_ARCHIVE_URL=<private tar.gz URL for the rollup home seed>`

Archive URL notes:

- use a direct `http://` or `https://` download URL reachable from Railway
- do not paste a local filesystem path such as `/mnt/...`
- do not wrap the URL in quotes
- do not use a GitHub HTML page, Drive share page, or any non-direct download page
- if you use a presigned S3-compatible URL, remember that `X-Amz-Expires=604800` means the link expires 7 days after `X-Amz-Date`
- when a signed URL expires, re-upload the archive and update the Railway variable before redeploying

Useful checks after deploy:

- RPC: `/status` on port `26657`
- REST: `/cosmos/base/tendermint/v1beta1/node_info` on port `1317`

## Notes

- The first boot seeds the Railway volume from the staged `home-seed` if it exists in the image, or from `ROLLUP_HOME_SEED_ARCHIVE_URL` if you provide one.
- If the image does not include `minitiad`, the container can download it from `MINITIAD_ARCHIVE_URL`.
- Later boots reuse the volume state and do not overwrite an existing seeded home.
- This is meant for the chain runtime itself. Frontend and backend should stay separate services.
