<div align="center">

# Aria Kiosk

**Real-time AI receptionist avatar for vertical display kiosks**

Conversational AI that greets visitors, answers questions, and shows contextual visuals — built for lobbies, retail, and events.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![Gemini Live API](https://img.shields.io/badge/Powered%20by-Gemini%20Live%20API-4285F4.svg)](https://ai.google.dev/gemini-api/docs/live-api)

</div>

---

## Overview

Aria Kiosk turns any portrait-oriented display into an interactive receptionist. Visitors speak naturally to an on-screen avatar, which responds with low-latency, human-like voice while relevant images and video surface alongside the conversation in real time.

```
Visitor (voice / touch)
   → Wake trigger (camera · button · proximity sensor)
   → Gemini Live API — streaming STT + LLM + TTS
        ├─ Audio response  → drives avatar lip-sync
        └─ Live transcript → keyword extraction
               → search internal media library (vector search)
               → fallback to web image/video search
               → render synced with avatar speech
   → Timeout → return to idle / attract mode
```

## Features

|                                |                                                                                          |
| ------------------------------ | ---------------------------------------------------------------------------------------- |
| 🎙️ **Real-time conversation**  | Streaming voice powered by Gemini Live API — natural turn-taking, barge-in, multilingual |
| 🧑‍💼 **Talking avatar**          | Viseme-driven lip-sync matched to live audio output                                      |
| 🖼️ **Contextual visuals**      | Pulls from your own media library first, falls back to web search                        |
| 📐 **Portrait-first layout**   | Purpose-built UI for vertical kiosk displays                                             |
| 👋 **Idle & wake detection**   | Attract-mode loop until a visitor approaches or taps the screen                          |
| ⏱️ **Kiosk-grade reliability** | Auto-timeout, watchdog reload, and unattended-operation safeguards                       |
| ⌨️ **Accessible fallback**     | On-screen text input for visitors who prefer not to speak                                |

## Architecture

| Layer                     | Technology                                     |
| ------------------------- | ---------------------------------------------- |
| Frontend                  | React + TypeScript                             |
| Real-time AI              | Gemini Live API (WebSocket)                    |
| Runtime / package manager | Bun                                            |
| Monorepo tooling          | Turborepo                                      |
| Orchestration backend     | Hono (on Bun)                                  |
| Media retrieval           | Supermemory (hybrid RAG) + web search fallback |
| Avatar rendering          | Live2D / viseme-based lip-sync                 |
| Deployment target         | Chrome kiosk mode                              |

## Project Structure

```
aria-kiosk/
├── apps/
│   ├── kiosk-frontend/       # React app for the vertical display
│   └── orchestrator/         # Token issuing, keyword extraction, media search
├── packages/
│   ├── avatar-engine/        # Viseme mapping and lip-sync rendering
│   └── media-search/         # Supermemory client + web fallback search
├── docs/
│   └── architecture.md
├── turbo.json                # Turborepo pipeline definitions
└── bunfig.toml                # Bun workspace/lockfile config
```

## Getting Started

```bash
git clone https://github.com/AnuwatThisuka/aria-kiosk.git
cd aria-kiosk
bun install
bun run dev
```

Configure `GEMINI_API_KEY` and `SUPERMEMORY_API_KEY` in `.env` before running — see `.env.example` for the full list of required variables.

## Roadmap

- [ ] Scaffold React kiosk frontend with Gemini Live WebSocket client
- [ ] Avatar lip-sync engine (viseme mapping)
- [ ] Media search service (Supermemory RAG + web fallback)
- [ ] Wake-trigger integration (camera / button / sensor)
- [ ] Kiosk-mode deployment with watchdog recovery

## Contributing

Issues and pull requests are welcome. Please open an issue to discuss significant changes before submitting a PR.

## License

Released under the [MIT License](LICENSE).
