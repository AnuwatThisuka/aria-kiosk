import { defineConfig, devices } from "@playwright/test";

/**
 * E2E config for the kiosk frontend.
 *
 * Scope: deterministic UI — attract mode, avatar canvas rendering, DOM/state
 * wiring, and graceful failure. All `/api/*` calls are route-mocked in the
 * specs, so no orchestrator or API keys are needed. The real Gemini Live
 * conversation (direct browser↔Google WebSocket, non-deterministic audio) is
 * out of scope here and verified on-device.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  reporter: "list",
  use: {
    baseURL: "http://localhost:5199",
    permissions: ["microphone"],
    // Stop the attract-button pulse so clicks aren't blocked on "not stable".
    reducedMotion: "reduce",
    launchOptions: {
      args: [
        "--use-fake-ui-for-media-stream",
        "--use-fake-device-for-media-stream",
        "--autoplay-policy=no-user-gesture-required",
      ],
    },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "bunx vite --port 5199 --strictPort",
    url: "http://localhost:5199",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
