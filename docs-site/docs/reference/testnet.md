# Testnet Evidence

Live rollup evidence for the active `lendpay-4` package.

## Current Runtime

| Field | Value |
| --- | --- |
| Chain ID | `lendpay-4` |
| RPC | `http://localhost:26657` |
| REST | `http://localhost:1317` |
| Package address | `0x5972A1C7118A8977852DC3307621535D5C1CDA63` |
| Base denom | `ulend` |

## Transaction Hashes

| Action | Hash |
| --- | --- |
| Deploy | `F93B0FA4D598833E7664DE8F0A88B5DCC7F921D2CB0EFB3F0C3D95C2D1D66D78` |
| Bootstrap | `FEC142843CECAE4011E4ECAEB32A5019A9E66E099EAC875BD82DBF953D3AFF1D` |
| Approval | `E4E34699EE84E54C9A9552013970F392EE2E03EA8D6C4B1C4E651C5D6EA5E722` |
| Request | `48A044189CC75E1877E455D208E2F22BD6706DDF25DF410D62144D4DB9E3D5A2` |
| Viral drop buy | `578AB95B519EE25A7E60D52E0A876C5DB81D4B658871BD066938F4E4863A4286` |

## Bridge Module Proof

| Action | Hash |
| --- | --- |
| Package upgrade (`bridge.move` included) | `A36F31E75969F9D285EEA503F6046D065AA3A0B56561B5E04F2EB9DAB8D251FA` |
| `bridge::initialize` | `8C7F9944ABB35AA2F5BFF2C7F596D1A6F21D7CE7B7C8D5F3BDD7F4C82561AE30` |
| `bridge::register_route` | `A2D0DF04150D326D951A0EE13AA4600EBD22D6F03C62F6440DB5913B05A54C53` |

Registered route: source `lendpay-4 / ulend` → destination `evm-1 / erc20/LEND`, venue `InitiaDEX`, pool `LEND/INIT`. Current state: `preview` — the official MiniEVM mapping is not yet published.

## Artifact Locations

- `smarcontract/artifacts/testnet/lendpay-4`
- `.initia/submission.json`
