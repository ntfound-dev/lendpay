# Hackathon Readiness

This page maps the core Initia hackathon requirements to what LendPay already ships and what evidence we can show.

It is meant to answer one practical question quickly:

- if a judge asks whether LendPay is a real Initia submission, where is the proof?

## Requirement Summary

| Requirement | LendPay status | Evidence |
| --- | --- | --- |
| Deploy as its own Initia appchain / rollup | satisfied | rollup chain ID `lendpay-4`, live package, recorded deployment hashes, and current local upgrade proof for the published `bridge` module |
| Use InterwovenKit for wallet connect and/or transaction handling | satisfied | frontend wallet and transaction flow uses InterwovenKit as the primary handler |
| Implement at least one Initia-native feature | satisfied | `.init` usernames are live, temporary auto-sign session UX is live for supported Move actions, and the Interwoven Bridge surface is wired into the product honestly |

## 1. Own Initia Appchain / Rollup

The submission requirement says the project must be deployed as its own Initia appchain or rollup.

LendPay satisfies this with its own MiniMove rollup runtime.

Current runtime evidence:

- rollup chain ID: `lendpay-4`
- package address: `0x5972A1C7118A8977852DC3307621535D5C1CDA63`
- deployment artifacts: `smarcontract/artifacts/testnet/lendpay-4`

Recorded example transaction hashes:

- deploy: `F93B0FA4D598833E7664DE8F0A88B5DCC7F921D2CB0EFB3F0C3D95C2D1D66D78`
- bootstrap: `FEC142843CECAE4011E4ECAEB32A5019A9E66E099EAC875BD82DBF953D3AFF1D`
- request flow: `48A044189CC75E1877E455D208E2F22BD6706DDF25DF410D62144D4DB9E3D5A2`
- approval flow: `E4E34699EE84E54C9A9552013970F392EE2E03EA8D6C4B1C4E651C5D6EA5E722`

Current local bridge-helper proof on the same package:

- package upgrade including `bridge.move`: `A36F31E75969F9D285EEA503F6046D065AA3A0B56561B5E04F2EB9DAB8D251FA`
- `bridge::initialize`: `8C7F9944ABB35AA2F5BFF2C7F596D1A6F21D7CE7B7C8D5F3BDD7F4C82561AE30`
- `bridge::register_route`: `A2D0DF04150D326D951A0EE13AA4600EBD22D6F03C62F6440DB5913B05A54C53`

Where this is documented:

- [Testnet Evidence](/reference/testnet)
- `.initia/submission.json`
- [Rollup](/app/rollup)

Important note:

- the active proof surface is the rollup chain ID plus real transaction hashes
- a public deployment URL can be added later, but it is not the only acceptable evidence format

## 2. InterwovenKit Usage

The submission requirement says the project must use `@initia/interwovenkit-react` for wallet connection and or transaction handling.

LendPay satisfies this directly in the frontend execution layer.

Why this requirement exists:

- Initia does not want wallet UX to be treated as an afterthought
- the requirement is there to prove the app is actually integrated into the Initia user experience stack
- in practice, it forces teams to show a real wallet connection and transaction path instead of a detached mock interface

What that means for LendPay:

- wallet connection is not a custom side path outside Initia UX
- transaction handling is not hand-waved away in screenshots
- the borrower flow really passes through the expected Initia wallet surface

What InterwovenKit is responsible for in LendPay:

- wallet connection
- wallet-aware transaction approval flow
- transaction submission handling around Move actions
- session-friendly UX for repeated supported actions

Where this is visible:

- `frontend/src/main.tsx`
- `frontend/src/App.tsx`
- `frontend/src/config/chain.ts`
- `frontend/src/hooks/useAutoSignPermission.ts`

Docs that explain it:

- [Frontend](/app/frontend)
- [Architecture](/guide/architecture)

Practical wording for judges:

- InterwovenKit is not decorative in this project
- it is the primary wallet UX and transaction surface

In short:

- this requirement exists to make sure the app feels like an Initia app
- LendPay meets it through real wallet connection and real transaction handling, not just a library mention

## 3. Initia-Native Feature Requirement

The submission requirement says the project must implement at least one Initia-native feature such as:

- auto-signing or session UX
- Interwoven Bridge
- Initia Usernames (`.init`)

LendPay already clears this requirement in more than one way.

Why this requirement exists:

- Initia wants submissions to feel native to its ecosystem, not portable demos that could have been dropped anywhere unchanged
- native features are the proof that the app is actually learning from and building on Initia-specific product surfaces
- for judges, this is the difference between "runs on Initia" and "belongs on Initia"

### Implemented Native Features

| Native feature | Status | How LendPay uses it |
| --- | --- | --- |
| Initia Usernames (`.init`) | live | borrower identity layer, profile readability, and ecosystem-facing borrower context |
| Auto-sign / session UX | partial but real | temporary wallet-managed permission flow for supported Move actions |
| Interwoven Bridge | integrated honestly, still preview for sell route | the Ecosystem page can open the bridge surface and now reads bridge-route metadata from the onchain registry on `lendpay-4` |

### What Each Native Feature Means

| Feature | What it is | Why it matters to UX | How LendPay positions it |
| --- | --- | --- | --- |
| Auto-sign / session UX | temporary permission flow for repeated supported actions | reduces repeated prompts and makes repayment or repeat actions smoother | implemented for supported Move actions and used honestly as a scoped UX improvement |
| Interwoven Bridge | native bridge and cross-environment routing surface | matters when assets or execution need to move across environments | integrated into the current product, but still described as preview while the official MiniEVM mapping is missing |
| Initia Usernames (`.init`) | human-readable identity layer on Initia | makes wallets easier to understand and display in-product | already part of the live borrower identity story |

### Initia Usernames

`.init` usernames are already part of the borrower identity story.

Why this counts:

- usernames are visible product functionality
- they improve borrower context, readability, and identity continuity
- they are not just mentioned in docs, they are part of the actual app model

Where this is documented:

- [Introduction](/guide/introduction)
- [Frontend](/app/frontend)
- `README.md`

### Auto-Sign / Session UX

LendPay also implements temporary auto-sign session UX for supported Move actions.

What this feature means in plain language:

- the wallet can temporarily trust a narrow class of supported actions
- the user does not need to manually approve every repeated step during that session window
- the result is a smoother borrower experience, especially for repeat flows like repayment

Important honesty note:

- this is not unlimited approval for every transaction
- it is a temporary wallet-managed permission window
- unsupported or expired actions fall back to normal wallet approval

Why this still counts:

- it is a real Initia UX integration
- it improves repeat action flow for supported repayment or borrower actions
- it is visible product behavior, not just a roadmap claim

Where this is documented:

- [Frontend](/app/frontend)
- [Architecture](/guide/architecture)

### Bridge Positioning

Interwoven Bridge is now part of the product surface, but it still needs to be described carefully.

What this feature means in plain language:

- Interwoven Bridge is about moving assets or value across the Initia environment cleanly
- it is already useful in LendPay because users need a truthful exit path for `LEND`
- the route registry for that path is now published onchain locally
- but the final sell path should only be called live when the official MiniEVM mapping is actually testable

Current rule:

- do not market sell readiness as if it were already live when mapping is still missing
- do use the bridge integration honestly: the Interwoven Bridge surface is wired, and the route metadata is now stored onchain
- keep `.init` identity and session UX as the clearest native features for fast judge comprehension

This keeps the submission honest and easier to defend.

### Why `.init` Usernames Matter

What this feature means in plain language:

- wallets become readable borrower identities instead of raw addresses everywhere
- identity continuity becomes easier across the dashboard and ecosystem surfaces
- credit feels more human and product-like when the borrower context is recognizable

Why this is a strong native feature for LendPay:

- identity is central to borrower trust and reputation
- `.init` fits the credit story naturally, not artificially
- it is easy for judges to see and understand during a demo

## Submission Artifacts

The repo already contains the baseline submission artifact expected for the hackathon.

Current artifact:

- `.initia/submission.json`

Important fields already present there:

- project name and track
- rollup chain ID `lendpay-4`
- native integrations
- demo flow
- artifact paths
- deployment notes and transaction hashes

## Recommended Judge Narrative

If we want the explanation to stay simple, the strongest phrasing is:

1. LendPay runs on its own MiniMove rollup, `lendpay-4`.
2. The frontend uses InterwovenKit as the real wallet and transaction layer.
3. The app already implements Initia-native identity through `.init` usernames and supports temporary auto-sign session UX for supported Move actions.
4. The bridge surface is integrated and its route metadata is now published onchain locally, even though the final MiniEVM sell path still waits for the official mapping.

That is enough to satisfy the core submission fit without overselling future bridge work.

## Related Docs

- [Scoring Criteria](/guide/scoring-criteria)
- [Quickstart](/guide/quickstart)
- [Architecture](/guide/architecture)
- [Frontend](/app/frontend)
- [Rollup](/app/rollup)
- [Testnet Evidence](/reference/testnet)
