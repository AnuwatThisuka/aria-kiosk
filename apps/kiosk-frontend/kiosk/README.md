# Kiosk deployment

Runs the Aria Kiosk frontend fullscreen on a portrait Chrome display for
unattended operation.

## Build & serve

```bash
bun run build --filter=@aria/kiosk-frontend   # outputs apps/kiosk-frontend/dist
bunx vite preview --port 4173                 # or any static server for dist/
```

The orchestrator must be reachable at `/api/*` (Vite dev proxies it; in
production serve the frontend behind a reverse proxy that forwards `/api` to
the orchestrator, or set the API base accordingly).

## Launch in kiosk mode

```bash
KIOSK_URL=http://localhost:4173 ./launch-kiosk.sh
```

`launch-kiosk.sh` starts Chrome with kiosk flags and **relaunches it if it
exits** (process-level watchdog). Key flags:

- `--kiosk` — fullscreen, no chrome UI
- `--autoplay-policy=no-user-gesture-required` — avatar audio can play
- `--disable-session-crashed-bubble` / `--noerrdialogs` — no blocking dialogs
- `--check-for-update-interval` — suppress mid-shift update prompts

## Reliability layers

| Layer              | Mechanism                                                           |
| ------------------ | ------------------------------------------------------------------- |
| Screen stays on    | `ScreenWakeLock` (Screen Wake Lock API), re-acquired on visibility  |
| Page self-heals    | `installWatchdog()` reloads on uncaught error / unhandled rejection |
| Browser self-heals | `launch-kiosk.sh` relaunch loop                                     |
| Session self-heals | `AriaLiveSession` auto-reconnects Gemini Live with backoff          |
| Idle reset         | `useKiosk` inactivity timeout → goodbye → attract mode              |

## Autostart

Run `launch-kiosk.sh` from your init system on boot. Example systemd unit
(Linux kiosk):

```ini
[Unit]
Description=Aria Kiosk
After=graphical.target

[Service]
Environment=KIOSK_URL=http://localhost:4173
ExecStart=/path/to/apps/kiosk-frontend/kiosk/launch-kiosk.sh
Restart=always

[Install]
WantedBy=graphical.target
```

On macOS use a LaunchAgent invoking the same script.
