import { expect, test, type Page } from "@playwright/test";

/**
 * Drives a fully deterministic conversation by replacing the Gemini-backed
 * session with a fake via `window.__ARIA_SESSION_FACTORY__` (see
 * `createLiveSession`). The fake captures the kiosk's handlers on
 * `window.__aria` so the test can emit transcripts/media/state at will — no
 * real API, mic, or audio involved.
 */
async function installFakeSession(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as unknown as {
      __ARIA_SESSION_FACTORY__: unknown;
      __aria: unknown;
    };
    w.__ARIA_SESSION_FACTORY__ = (
      handlers: Record<string, ((...a: unknown[]) => void) | undefined>,
    ) => {
      w.__aria = handlers;
      return {
        connect: async () => handlers.onStateChange?.("live"),
        sendText: async (t: string) =>
          handlers.onModelTranscript?.(`Echo: ${t}`, true),
        close: () => handlers.onStateChange?.("closed"),
      };
    };
  });
}

/** Emit through the captured handlers. */
async function emit(page: Page, method: string, ...args: unknown[]) {
  await page.evaluate(
    ([m, a]) => {
      const h = (
        window as unknown as {
          __aria: Record<string, (...x: unknown[]) => void>;
        }
      ).__aria;
      h[m as string]?.(...(a as unknown[]));
    },
    [method, args] as const,
  );
}

const TINY_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

test.beforeEach(async ({ page }) => {
  await installFakeSession(page);
  await page.goto("/");
  await page
    .getByRole("button", { name: /tap to talk/i })
    .click({ force: true });
  // Fake connect() reports "live" -> machine goes active.
  await expect(page.locator("main.kiosk")).toHaveAttribute(
    "data-state",
    "active",
  );
});

test("renders visitor and Aria transcripts", async ({ page }) => {
  await emit(page, "onUserTranscript", "where is the lobby", true);
  await emit(page, "onModelTranscript", "The lobby is on floor 3.", true);
  await expect(page.locator(".transcript .you")).toContainText(
    "where is the lobby",
  );
  await expect(page.locator(".transcript .aria")).toContainText("floor 3");
});

test("shows a contextual media panel when media arrives", async ({ page }) => {
  await emit(page, "onMedia", {
    url: TINY_PNG,
    type: "image",
    title: "Main lobby",
    description: "lobby",
    score: 0.9,
    source: "library",
    tags: [],
  });
  const panel = page.locator(".media-panel");
  await expect(panel).toHaveClass(/show/);
  await expect(panel.locator("img")).toBeVisible();
  await expect(panel.locator(".media-caption")).toHaveText("Main lobby");
});

test("typed question flows through and Aria replies", async ({ page }) => {
  const input = page.getByLabel("Type your question");
  await expect(input).toBeEnabled();
  await input.fill("what are your hours");
  await page.getByRole("button", { name: "Ask" }).click();
  await expect(page.locator(".transcript .aria")).toContainText(
    "Echo: what are your hours",
  );
});

test("transport disconnect surfaces the reconnecting state", async ({
  page,
}) => {
  await emit(page, "onStateChange", "reconnecting");
  await expect(page.locator("main.kiosk")).toHaveAttribute(
    "data-state",
    "reconnecting",
  );
  await expect(page.locator(".status")).toContainText(/reconnecting/i);
});

test("ending the conversation shows goodbye, then returns to attract mode", async ({
  page,
}) => {
  await page.getByRole("button", { name: "End" }).click();
  await expect(page.locator(".goodbye")).toBeVisible();
  // GOODBYE_HOLD_MS (4s) later it resets to idle/attract.
  await expect(page.locator("main.kiosk")).toHaveAttribute(
    "data-state",
    "idle",
    {
      timeout: 7000,
    },
  );
  await expect(
    page.getByRole("button", { name: /tap to talk/i }),
  ).toBeVisible();
});
