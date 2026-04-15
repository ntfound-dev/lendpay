# LendPay Docs Site

Standalone documentation website for LendPay.

This site documents the product and the agent-guided UX layer. The live app now pulls a server-side agent guide (`/api/v1/agent/guide`) that can be optionally rewritten by Ollama for tone, while actions remain deterministic in the backend.

## Run locally

```bash
make up
```

Then open `http://localhost:4173`.

If you only want the docs site:

```bash
cd docs-site
npm install
npm run dev
```

## Agent guide notes

- The agent guide is generated in the backend and can be enhanced by a local Ollama runtime.
- Model output is sanitized; the agent will never change actions, only narrative copy.
- To enable Ollama in dev, set `AI_PROVIDER=ollama` and configure `OLLAMA_BASE_URL` + `OLLAMA_MODEL` in the backend.

## Build

```bash
cd docs-site
npm run build
```

## Vercel

This docs app is separate from the main frontend app.

Use a second Vercel project for `docs-site` with:

- Root Directory: `docs-site`
- Build Command: `npm run build`
- Output Directory: `docs/.vitepress/dist`

This folder now includes [`vercel.json`](./vercel.json) for that setup.
