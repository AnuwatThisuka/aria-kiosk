# Aria Kiosk — Implementation Plan

**RAG Provider:** [Supermemory](https://supermemory.ai) (managed RAG + memory API)

---

## 1. What Supermemory Replaces in the Original Design

The earlier architecture proposed a self-managed vector DB (Qdrant/pgvector) for media retrieval. Supermemory replaces that layer entirely:

| Previously planned | Now handled by Supermemory |
|---|---|
| Vector DB (Qdrant/pgvector) | Managed hybrid search (vector + keyword + rerank) |
| Custom chunking pipeline | Automatic content-type-aware chunking |
| Manual embedding generation | Built-in embedding on ingest |
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
  content: "Aria Kiosk is located at the 3rd floor lobby. Visiting hours are 9am-6pm...",
  containerTags: ["kiosk_knowledge"],
  metadata: { category: "hours", updatedAt: "2026-07-01" }
});
```

**Media entries** (`containerTags: ["kiosk_media"]`)
```ts
await client.add({
  content: "Photo of the main lobby reception desk, wide angle, daytime",
  containerTags: ["kiosk_media"],
  metadata: { type: "image", url: "https://cdn.../lobby.jpg", tags: ["lobby","reception"] }
});
```

At query time, the transcript keyword/phrase is searched against `kiosk_media` first; a hit above a relevance threshold returns the `metadata.url` to render. No hit → fallback to web image search.

## 4. Implementation Phases

### Phase 0 — Foundations (Week 1)
- [ ] Scaffold `aria-kiosk` monorepo (`apps/kiosk-frontend`, `apps/orchestrator`)
- [ ] Set up Supermemory account, API key, install SDK (`npm install supermemory`)
- [ ] Define `containerTags` schema (`kiosk_knowledge`, `kiosk_media`)
- [ ] Set up Gemini Live API access + ephemeral token issuing endpoint

### Phase 1 — Core Conversation Loop (Week 2–3)
- [ ] Orchestrator: issue ephemeral Gemini token to frontend
- [ ] Frontend: WebSocket client to Gemini Live (mic in, audio out)
- [ ] Orchestrator: on each transcript chunk, call `client.search()` against `kiosk_knowledge` with `searchMode: "hybrid"`, inject top results into Gemini's system/context so answers are grounded in company data
- [ ] Basic text-only fallback input (typed questions) using the same search path

### Phase 2 — Avatar & Lip-Sync (Week 3–4)
- [ ] Integrate Live2D (or chosen avatar engine)
- [ ] Map Gemini's audio output to viseme/mouth-shape timing
- [ ] Idle animation loop for attract mode

### Phase 3 — Contextual Media Retrieval (Week 4–5)
- [ ] Ingest initial media library into `kiosk_media` (batch script: image/video + generated description)
- [ ] On each transcript sentence, extract a short visual-intent phrase (can reuse the LLM's own output stream — see Section 5)
- [ ] Query `kiosk_media` with `rerank: true` for precision; define a relevance-score threshold
- [ ] Below threshold → call web image/video search API as fallback
- [ ] Frontend: media panel that fades in/out synced to speech timestamps

### Phase 4 — Wake Detection & Kiosk Hardening (Week 5–6)
- [ ] Implement wake trigger (start with touch button; camera/sensor as stretch goal)
- [ ] Idle → conversation → timeout state machine
- [ ] Chrome kiosk-mode deployment config, wake-lock, watchdog auto-reload
- [ ] Error handling: Gemini disconnect/reconnect, Supermemory request failures (fail gracefully to "let me check on that" + web fallback)

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

- [ ] Web image/video fallback provider (Bing Image Search vs. Pexels/Unsplash for licensed stock)
- [ ] Relevance-score threshold for "use own media" vs. "fallback to web"
- [ ] Wake trigger for v1 launch: touch button only, or camera-based proximity detection

## 8. Milestone Summary

| Week | Milestone |
|---|---|
| 1 | Repo scaffolded, Supermemory + Gemini Live connected |
| 3 | End-to-end voice conversation grounded in company knowledge |
| 4 | Avatar speaking with lip-sync |
| 5 | Contextual media showing during conversation |
| 6 | Kiosk-mode hardened, wake/idle state machine complete |
| 7 | On-site pilot |
