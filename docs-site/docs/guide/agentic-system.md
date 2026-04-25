# Agentic Guide System

The backend agent guide turns borrower state into a concrete next best step. It drives panel copy, recommendations, and action labels while keeping all values grounded in backend and onchain truth.

## Planner Layer

Returned from `GET /api/v1/agent/guide` (and `POST` when the frontend has richer context).

Each response includes:

- `panelTitle`, `panelBody` — display copy for the current surface
- `recommendation` — the safest next move
- `actionKey`, `actionLabel` — wired to a concrete frontend action
- `confidence` — scoring confidence
- `checklist` — borrower-state summary

Surfaces: `overview`, `analyze`, `request`, `loan`, `rewards`, `admin`.

Common action keys: `analyze_profile`, `open_request`, `repay_now`, `open_repay`, `claim_rewards`.

## Flow

<AgenticFlowDiagram />

## Planner Inputs

- Latest score, risk band, APR, and limit
- Loan requests and their status
- Active loans and repayment schedule
- Claimable rewards and borrower tier

## Optional Ollama Rewrite

Set `AI_PROVIDER=ollama` with `OLLAMA_BASE_URL` and `OLLAMA_MODEL` to enable natural-language rewriting of guide copy. The rewrite layer is sanitized — if the model introduces new amounts, dates, or facts, the response is discarded and deterministic copy is used instead.

## Guardrails

- Planner output cannot invent new action keys
- Backend and chain remain the final source of truth

## Related Docs

- [Architecture](/guide/architecture)
- [Frontend](/app/frontend)
- [Backend](/app/backend)
