# Aria Kiosk — Implementation Plan

**RAG Provider:** [Supermemory](https://supermemory.ai) (managed RAG + memory API)

---

## 1. What Supermemory Replaces in the Original Design

The earlier architecture proposed a self-managed vector DB (Qdrant/pgvector) for media retrieval. Supermemory replaces that layer entirely:

| Previously planned            | Now handled by Supermemory                          |
| ----------------------------- | --------------------------------------------------- |
| Vector DB (Qdrant/pgvector)   | Managed hybrid search (vector + keyword + rerank)   |
| Custom chunking pipeline      | Automatic content-type-aware chunking               |
| Manual embedding generation   | Built-in embedding on ingest                        |
| Separate media metadata store | `containerTags` + structured content on each memory |

This removes an entire infrastructure component (self-hosted vector DB) from the build.

## 2. Updated Architecture

```
Visitor (voice / touch)
   → Wake trigger (camera · button · sensor)
   → Gemini Live API — streaming STT + LLM + TTS
        ├─ Audio response  → drives avatar lip-sync
        └─ Live transcript → orchestrator
               → Supermemory.search() — hybrid RAG over:
                    · Company knowledge base (FAQs, services, directions)
                    · Media library (image/video descriptions, tagged)
               → if confident match found → render matched media
               → else → web image/video search fallback
   → Timeout → idle / attract mode
```

Two Supermemory namespaces (via `containerTags`):

- `kiosk_knowledge` — text knowledge base (company info, FAQs) used to ground LLM answers
- `kiosk_media` — media library entries: each image/video stored with a rich text description so semantic search can match it against spoken content

## 3. Data Model in Supermemory

**Knowledge entries** (`containerTags: ["kiosk_knowledge"]`)

```ts
await client.add({
  content:
    "Aria Kiosk is located at the 3rd floor lobby. Visiting hours are 9am-6pm...",
  containerTags: ["kiosk_knowledge"],
  metadata: { category: "hours", updatedAt: "2026-07-01" },
});
```

**Media entries** (`containerTags: ["kiosk_media"]`)

```ts
await client.add({
  content: "Photo of the main lobby reception desk, wide angle, daytime",
  containerTags: ["kiosk_media"],
  metadata: {
    type: "image",
    url: "https://cdn.../lobby.jpg",
    tags: ["lobby", "reception"],
  },
});
```

At query time, the transcript keyword/phrase is searched against `kiosk_media` first; a hit above a relevance threshold returns the `metadata.url` to render. No hit → fallback to web image search.

## 4. Implementation Phases

### Phase 0 — Foundations (Week 1)

- [x] Scaffold `aria-kiosk` Bun workspace monorepo with Turborepo (`turbo.json` pipeline for `dev`/`build`/`lint`/`test`/`typecheck`)
- [x] Set up `apps/kiosk-frontend`, `apps/orchestrator`, `packages/avatar-engine`, `packages/media-search` with stub scripts so all participate in the Turborepo pipeline
- [x] Install Supermemory SDK (`supermemory`) + client factory — _account creation & API key are a manual/ops step (set `SUPERMEMORY_API_KEY` in `.env`)_
- [x] Define `containerTags` schema (`kiosk_knowledge`, `kiosk_media`) — `packages/media-search/src/schema.ts`
- [x] Ephemeral token issuing endpoint (`POST /api/gemini-token`) via `@google/genai` — _obtaining `GEMINI_API_KEY` / Live API access is a manual step_

### Phase 1 — Core Conversation Loop (Week 2–3)

- [x] Orchestrator: issue ephemeral Gemini token to frontend (`POST /api/gemini-token` — live-verified)
- [x] Frontend: WebSocket client to Gemini Live (mic in, audio out) — `apps/kiosk-frontend/src/gemini/{liveClient,audio,model}.ts` _(needs on-device Chrome verification: mic capture + audio playback can't be driven headless)_
- [x] Orchestrator: ground each utterance/query against `kiosk_knowledge` via Supermemory v3 `search.execute` (managed hybrid — replaces the old `searchMode:"hybrid"` flag), inject via `POST /api/ground` → frontend `sendClientContent` — live-verified against Supermemory
- [x] Basic text-only fallback input (typed questions) through the same grounding path (`AriaLiveSession.sendText`, text box in `App.tsx`)

### Phase 2 — Avatar & Lip-Sync (Week 3–4)

- [x] Avatar engine with a pluggable `AvatarRenderer` — working procedural `CanvasAvatar` (dependency-free), plus a documented `Live2DRenderer` scaffold _(real Cubism needs the proprietary SDK + a `.model3.json` model — not bundleable; param mapping is wired ready)_
- [x] Map Gemini's audio output to viseme/mouth-shape timing — output PCM → `MouthEnvelope` (RMS → smoothed openness, attack/release) → viseme buckets. Amplitude-based (Gemini Live gives no phoneme timings), same approach as Live2D built-in lip-sync
- [x] Idle animation loop for attract mode — `AvatarController` runs continuously (blink + breathing); when no audio the envelope decays shut and only idle plays = attract mode
- [x] Wired into frontend: `AudioPlayer` taps decoded chunks → `App` feeds shared `MouthEnvelope` → `AvatarStage` renders; barge-in resets the mouth

### Phase 3 — Contextual Media Retrieval (Week 4–5)

- [x] Batch ingest into `kiosk_media` — `ingestMediaLibrary()` + runnable `bun run ingest:media [manifest.json]` (`apps/orchestrator/scripts/`, sample `media-seed.json`). _Auto-description generation not wired — manifest supplies descriptions; run with real assets (not run against the live account yet)_
- [x] Per-sentence visual-intent extraction — `deriveMediaQuery()` prefers `[visual: …]` tags (§5), falls back to the spoken sentence (Live audio-only emits no tags natively)
- [x] Query `kiosk_media` with `rerank: true` + relevance threshold — `searchMedia` / `pickMedia` (`DEFAULT_MEDIA_THRESHOLD = 0.5`, overridable via `MEDIA_THRESHOLD`)
- [x] Below threshold → web fallback (`PexelsProvider`, pluggable `WebMediaProvider`, keyed by `WEB_IMAGE_SEARCH_API_KEY`) via `POST /api/media` — library → web → none, live-verified
- [x] Frontend media panel that fades in/out — `MediaPanel` (fade + auto-hide), driven per spoken sentence; approximates speech sync _(frame-accurate sync needs per-word timestamps Live doesn't expose)_

### Phase 4 — Wake Detection & Kiosk Hardening (Week 5–6)

- [x] Wake trigger — touch button ("Tap to talk") drives `idle → connecting`; camera/proximity left as documented stretch goal
- [x] Idle → conversation → timeout state machine — pure `kioskMachine` reducer (`idle/connecting/active/reconnecting/goodbye`) + `useKiosk` hook owning inactivity timeout (45s) and goodbye hold; state lives in `src/state/` per AGENTS.md, timeout-reset covered by tests
- [x] Chrome kiosk-mode config + wake-lock + watchdog — `kiosk/launch-kiosk.sh` (kiosk flags + relaunch loop) & `kiosk/README.md`; `ScreenWakeLock` (re-acquires on visibility); `installWatchdog` (reload on uncaught fault)
- [x] Error handling — `AriaLiveSession` auto-reconnects Gemini Live (backoff, ≤5 attempts) on unexpected drops; Supermemory failures degrade to a "let me check on that" injected note + web media fallback

### Phase 5 — Content Ops & Testing (Week 6–7)

- [ ] Admin script/UI to add/update `kiosk_knowledge` and `kiosk_media` entries without redeploying
- [ ] On-site testing: mic sensitivity in ambient noise, screen visibility, response latency
- [ ] Load test conversation timeout / recovery behavior
- [ ] Pilot install + feedback loop

## 5. Getting the "Visual Keyword" Into Supermemory Queries

Prompt Gemini to tag visual cues inline in its streamed response (as discussed earlier):

```
[speak] "Mount Fuji is the tallest volcano in Japan"
[visual: Mount Fuji]
```

The orchestrator extracts the `[visual: ...]` tag and uses it directly as the Supermemory search query — no separate NLP step needed.

## 6. Environment Variables

```
GEMINI_API_KEY=
SUPERMEMORY_API_KEY=
WEB_IMAGE_SEARCH_API_KEY=       # fallback provider (e.g. Bing/Google/Pexels)
```

## 7. Open Decisions

- [x] Web image/video fallback provider — **Pexels** (licensed stock, free tier); pluggable via `WebMediaProvider` if we switch
- [x] Relevance-score threshold for "use own media" vs. "fallback to web" — default **0.5** (`MEDIA_THRESHOLD` env override); revisit against real content
- [x] Wake trigger for v1 launch — **touch button** for v1; camera-based proximity deferred as a stretch goal

## 8. Milestone Summary

| Week | Milestone                                                   |
| ---- | ----------------------------------------------------------- |
| 1    | Repo scaffolded, Supermemory + Gemini Live connected        |
| 3    | End-to-end voice conversation grounded in company knowledge |
| 4    | Avatar speaking with lip-sync                               |
| 5    | Contextual media showing during conversation                |
| 6    | Kiosk-mode hardened, wake/idle state machine complete       |
| 7    | On-site pilot                                               |
