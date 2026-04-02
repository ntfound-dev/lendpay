# LendPay Move Package

This package now uses real Initia fungible assets for:

- loan liquidity custody via a protocol vault store
- native `LEND` issuance via Initia coin metadata
- protocol `LEND` reserve custody
- staking custody for staked `LEND`

## Current Local Rollup

The package is already deployed on the local MiniMove rollup:

- chain id: `lendpay-local-1`
- RPC: `http://localhost:26657`
- module address: `0x52683DF957C5538C0FA362B068804A120E408D2B`
- loan asset metadata: `0x25c4855dbee8a475c72526cc888c20562befd9cac8ceb78367ed490e1b0dab3`
- deploy tx: `47C0DF5AE56C885F5565BB07FE00332FD227BCAC5678C9A049B1C8E510F16276`
- bootstrap tx: `75FAC78441FF0CDEBE657FE72A2DA8E7B6519809DB279FDC8FC734AF71DBD823`
- fund liquidity tx: `186826C23EB72A5C3FD97214263FE59AA5DAC4DCEE564F73A19F3EA2524ED367`
- mint reserve tx: `4368AAB6902C76D4E43F7E045A5FEA0CCE9505845281786D57A553824D9C7ADC`

## Local Validation

Run local tests in dev mode:

```bash
./scripts/rollup/test.sh
```

Build in dev mode:

```bash
./scripts/rollup/build.sh
```

To build against a real deployed package address:

```bash
LENDPAY_PACKAGE_ADDRESS=0x... ./scripts/rollup/build.sh
```

## Rollup Deployment Flow

1. Export rollup env and publish the package:

```bash
source ./scripts/rollup/.env.example
./scripts/rollup/deploy.sh
```

This follows the official MoveVM flow: `minitiad move deploy --upgrade-policy COMPATIBLE`
with a concrete named address for `lendpay`. If `LENDPAY_PACKAGE_ADDRESS` is blank,
the scripts derive the module address from the deployer key:

```bash
minitiad keys parse $(minitiad keys show $ROLLUP_KEY_NAME --address)
```

2. Set `LENDPAY_PACKAGE_ADDRESS` to that derived hex module address if you want to
pin it explicitly. If you keep using the same deploy key, the scripts can derive it
automatically.

3. Bootstrap the protocol:

```bash
TREASURY_ADMIN_ADDRESS=init1...
LOAN_ASSET_METADATA=0x...
./scripts/rollup/bootstrap.sh
```

4. Fund the loan liquidity vault with the configured loan asset:

```bash
AMOUNT=1000000 ./scripts/rollup/fund-liquidity.sh
```

5. Mint `LEND` into the protocol reserve:

```bash
AMOUNT=500000 ./scripts/rollup/mint-lend-reserve.sh
```

## Demo Borrower Flow

For the current local rollup, the example env file is already prefilled with the
live local chain values:

```bash
source ./scripts/rollup/.env.example
```

Then run the full borrower lifecycle:

```bash
./scripts/rollup/demo-flow.sh
```

The demo uses the existing local `Validator` key as borrower by default, then executes:

1. fund borrower with `umin`
2. attest `.init`-style username bytes onchain
3. request a profiled micro-loan
4. approve the loan as operator
5. repay all installments
6. claim earned `LEND`
7. pay outstanding origination fees in `LEND`
8. stake the remaining `LEND`
9. claim staking rewards

Artifacts land under:

```bash
artifacts/rollup/demo/
```

The final summary file is:

```bash
artifacts/rollup/demo/summary.json
```

## Important Runtime Notes

- For real deployment, `lendpay` must resolve to a concrete hex address. The deploy
  script passes it via `--named-addresses` so you do not need to edit `Move.toml`
  by hand.
- The shared rollup helper now auto-adds `LD_LIBRARY_PATH` when `MINITIAD_BIN`
  points to a local MiniMove binary directory that contains `libmovevm.x86_64.so`.
- `loan_asset_metadata` must be the metadata object address of the asset used for principal and repayment.
- `LEND` is initialized by the package itself during `bootstrap::initialize_protocol`.
- Loan disbursement and repayment now move real assets instead of updating accounting only.
- Rewards, fee collection, burns, and staking now move real `LEND`.
