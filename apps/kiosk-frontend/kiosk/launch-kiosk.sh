#!/usr/bin/env bash
#
# Launch Aria Kiosk in Chrome kiosk mode, relaunching if the browser exits
# (process-level watchdog to complement the in-page watchdog). Point KIOSK_URL
# at wherever the built frontend is served.
#
# Usage: KIOSK_URL=http://localhost:4173 ./launch-kiosk.sh
set -euo pipefail

KIOSK_URL="${KIOSK_URL:-http://localhost:4173}"
PROFILE_DIR="${KIOSK_PROFILE_DIR:-/tmp/aria-kiosk-profile}"

# Resolve a Chrome/Chromium binary.
CHROME="${CHROME_BIN:-}"
if [[ -z "${CHROME}" ]]; then
  for candidate in \
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
    "$(command -v google-chrome || true)" \
    "$(command -v chromium || true)" \
    "$(command -v chromium-browser || true)"; do
    if [[ -n "${candidate}" && -x "${candidate}" ]]; then
      CHROME="${candidate}"
      break
    fi
  done
fi
if [[ -z "${CHROME}" ]]; then
  echo "No Chrome/Chromium binary found. Set CHROME_BIN." >&2
  exit 1
fi

FLAGS=(
  --kiosk "${KIOSK_URL}"
  --user-data-dir="${PROFILE_DIR}"
  --incognito
  --noerrdialogs
  --disable-infobars
  --disable-session-crashed-bubble
  --disable-pinch
  --overscroll-history-navigation=0
  --autoplay-policy=no-user-gesture-required
  --disable-features=TranslateUI
  --check-for-update-interval=31536000
)

# Relaunch loop: if Chrome dies, wait briefly and bring it back.
while true; do
  "${CHROME}" "${FLAGS[@]}" || true
  echo "Chrome exited; relaunching in 3s…" >&2
  sleep 3
done
