# Hackathon Readiness

Where is the proof that LendPay is a real Initia submission?

## Requirement Summary

| Requirement | Status | Evidence |
| --- | --- | --- |
| Own Initia appchain / rollup | Satisfied | Chain ID `lendpay-4`, live package, deployment hashes, bridge module upgrade proof |
| InterwovenKit for wallet and transactions | Satisfied | Frontend wallet and transaction flow uses InterwovenKit as the primary handler |
| At least one Initia-native feature | Satisfied | `.init` usernames live; temporary auto-sign session UX live; Interwoven Bridge surface wired with onchain route registry |

---

## 1. Own Initia Appchain

LendPay runs on its own MiniMove rollup runtime.

| Field | Value |
| --- | --- |
| Chain ID | `lendpay-4` |
| Package address | `0x5972A1C7118A8977852DC3307621535D5C1CDA63` |
| Artifacts | `smarcontract/artifacts/testnet/lendpay-4` |

| Action | Hash |
| --- | --- |
| Deploy | `F93B0FA4D598833E7664DE8F0A88B5DCC7F921D2CB0EFB3F0C3D95C2D1D66D78` |
| Bootstrap | `FEC142843CECAE4011E4ECAEB32A5019A9E66E099EAC875BD82DBF953D3AFF1D` |
| Request flow | `48A044189CC75E1877E455D208E2F22BD6706DDF25DF410D62144D4DB9E3D5A2` |
| Approval flow | `E4E34699EE84E54C9A9552013970F392EE2E03EA8D6C4B1C4E651C5D6EA5E722` |

Bridge module proof:

| Action | Hash |
| --- | --- |
| Package upgrade + `bridge.move` | `A36F31E75969F9D285EEA503F6046D065AA3A0B56561B5E04F2EB9DAB8D251FA` |
| `bridge::initialize` | `8C7F9944ABB35AA2F5BFF2C7F596D1A6F21D7CE7B7C8D5F3BDD7F4C82561AE30` |
| `bridge::register_route` | `A2D0DF04150D326D951A0EE13AA4600EBD22D6F03C62F6440DB5913B05A54C53` |

See: [Testnet Evidence](/reference/testnet), `.initia/submission.json`, [Rollup](/app/rollup)

---

## 2. InterwovenKit Usage

InterwovenKit is the primary wallet UX and transaction surface — not decorative, not a library badge.

What InterwovenKit handles in LendPay:
- Wallet connection
- Transaction approval flow
- Transaction submission for Move actions
- Session-friendly UX for repeated supported actions

Where it is wired: `frontend/src/main.tsx`, `frontend/src/App.tsx`, `frontend/src/config/chain.ts`, `frontend/src/hooks/useAutoSignPermission.ts`.

See: [Frontend](/app/frontend), [Architecture](/guide/architecture)

---

## 3. Initia-Native Features

| Native feature | Status | How LendPay uses it |
| --- | --- | --- |
| `.init` Usernames | Live | Borrower identity layer, profile readability, reputation surface |
| Auto-sign / session UX | Live (scoped) | Temporary wallet-managed permission for supported Move actions |
| Interwoven Bridge | Wired, sell route preview-only | Ecosystem page reads bridge-route metadata from onchain registry; route registered and provable |

### `.init` Usernames

Wallets become readable borrower identities. Identity continuity is visible across dashboard and ecosystem surfaces. Credit feels more human when the borrower context is recognizable.

Strongest for judges: identity is central to borrower trust and reputation. `.init` fits the credit story naturally, not artificially.

### Auto-Sign / Session UX

The wallet can temporarily trust a narrow class of supported actions. Users do not need to manually approve every repeated step during the session window. This is not unlimited approval — it is a temporary wallet-managed permission window. Unsupported or expired actions fall back to normal wallet approval.

### Bridge Surface

The Interwoven Bridge surface is wired and route metadata is now published onchain locally. The final sell path should only be called live when the official MiniEVM mapping is testable. Do not market sell readiness as already live. Keep `.init` identity and session UX as the clearest native features for fast judge comprehension.

---

## Submission Artifacts

`.initia/submission.json` contains:
- Project name and track
- Chain ID `lendpay-4`
- Native integrations
- Demo flow
- Artifact paths and deployment notes

---

## Recommended Judge Narrative

1. LendPay runs on its own MiniMove rollup, `lendpay-4`.
2. The frontend uses InterwovenKit as the real wallet and transaction layer.
3. The app implements Initia-native identity through `.init` usernames and supports temporary auto-sign session UX for supported Move actions.
4. The bridge surface is integrated and its route metadata is published onchain locally — the final MiniEVM sell path still waits for the official mapping.

---

## Related Docs

- [Scoring Criteria](/guide/scoring-criteria)
- [Quickstart](/guide/quickstart)
- [Architecture](/guide/architecture)
- [Frontend](/app/frontend)
- [Rollup](/app/rollup)
- [Testnet Evidence](/reference/testnet)
