# AGENTS.md

Instructions for AI coding agents (Claude Code, Cursor, OpenCode, etc.) working in this repository.

## Project

**Aria Kiosk** — a real-time AI receptionist avatar for vertical display kiosks. Visitors speak to an on-screen avatar (Gemini Live API for STT/LLM/TTS), which responds with lip-synced audio while contextually relevant images/video surface via Supermemory RAG (with a web-search fallback).

See `README.md` for the product overview and `IMPLEMENTATION_PLAN.md` for the phased build plan — read both before starting work if present.

## Tech stack

- **Package manager / runtime:** Bun (not Node/npm — use Bun APIs and `bun` commands throughout)
- **Monorepo tooling:** Turborepo (task orchestration, caching) on top of Bun workspaces
- **Frontend:** React + TypeScript, runs in Chrome kiosk mode on a portrait display
- **Orchestrator backend:** Hono + TypeScript, running on Bun
- **Real-time AI:** Gemini Live API (WebSocket, streaming STT+LLM+TTS)
- **RAG / knowledge & media retrieval:** Supermemory (`supermemory` package)
- **Avatar:** Live2D / viseme-driven lip-sync
- **Web fallback search:** external image/video search API (provider TBD — see IMPLEMENTATION_PLAN.md open decisions)

## Repository structure

```
aria-kiosk/
├── apps/
│   ├── kiosk-frontend/       # React app for the vertical display
│   └── orchestrator/         # Hono backend: token issuing, Supermemory queries, media search
├── packages/
│   ├── avatar-engine/        # Viseme mapping and lip-sync rendering
│   └── media-search/         # Supermemory client + web fallback search
├── docs/
│   └── architecture.md
├── turbo.json                # Turborepo pipeline definitions
├── bunfig.toml                # Bun workspace/lockfile config
└── package.json               # root — Bun workspaces config
```

## Setup & commands

```bash
bun install                       # install all workspace dependencies
bun run dev                       # turbo run dev — starts frontend + orchestrator in watch mode
bun run build                     # turbo run build — builds all apps/packages (cached)
bun run lint                      # turbo run lint — lints all workspaces (cached)
bun test                          # turbo run test — runs tests across workspaces (cached)
bun run typecheck                 # turbo run typecheck — project-wide TypeScript check

# Scope a command to a single workspace when iterating:
bun run build --filter=kiosk-frontend
bun run test --filter=./packages/media-search
```

Always run `bun run lint`, `bun run typecheck`, and `bun test` before considering a task done. These are Turborepo pipeline tasks — Turborepo will skip re-running unaffected packages using its cache, so prefer these root scripts over `cd`-ing into a package and running its script directly.

Use Bun workspaces (`"workspaces": ["apps/*", "packages/*"]` in root `package.json`) — no `pnpm`, no `npm`, no `yarn` anywhere in scripts or docs. Task orchestration and caching go through Turborepo (`turbo.json`) — every package's `dev`/`build`/`lint`/`test`/`typecheck` script must exist so it participates in the pipeline, even if it's a no-op stub early on.

## Environment variables

Required in `.env` (see `.env.example`):

```
GEMINI_API_KEY=
SUPERMEMORY_API_KEY=
WEB_IMAGE_SEARCH_API_KEY=
```

Never commit real API keys. Never print/log `.env` values in code or console output.

## Conventions

- **Language:** TypeScript everywhere, strict mode on. No implicit `any`.
- **Formatting:** Prettier defaults; run `bun run lint --fix` before committing.
- **Components:** Functional React components + hooks only, no class components.
- **Supermemory tagging:** Every `client.add()` call must set an explicit `containerTags` value — use `kiosk_knowledge` for text knowledge base entries and `kiosk_media` for image/video library entries. Never mix tags.
- **Media entries:** must always include `metadata.url` and `metadata.type` (`"image" | "video"`).
- **Fallback logic:** any Supermemory or Gemini Live call must have a graceful fallback path (see IMPLEMENTATION_PLAN.md §4/Phase 4) — the kiosk runs unattended and must never show a broken/frozen state to a visitor.
- **State machine:** the frontend's idle → wake → conversation → timeout states live in one place (`apps/kiosk-frontend/src/state/`) — don't scatter timeout/idle logic across components.

## Testing expectations

- Unit tests for orchestrator logic (Supermemory query building, relevance threshold, fallback routing) are required for any change touching `packages/media-search`.
- Frontend state machine transitions (idle/wake/conversation/timeout) must have tests covering timeout-triggered resets.
- Do not add end-to-end tests that require a live Gemini Live or Supermemory connection — mock these services in tests.

## Things not to do

- Don't add a new app or package without adding matching `dev`/`build`/`lint`/`test`/`typecheck` scripts to its `package.json` — Turborepo's pipeline in `turbo.json` expects every workspace to expose these, even as stubs.
- Don't bypass Turborepo by wiring up custom shell scripts to run multiple packages — add/adjust the pipeline in `turbo.json` instead.
- Don't introduce a second vector DB or RAG provider — Supermemory is the single retrieval layer per the implementation plan.
- Don't hardcode kiosk content (FAQs, media descriptions) in frontend code — it belongs in Supermemory so non-engineers can update it without a redeploy.
- Don't remove the web-search fallback path even if the media library seems complete — it's a required safety net for unattended operation.
