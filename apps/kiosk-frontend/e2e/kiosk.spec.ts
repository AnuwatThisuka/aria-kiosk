import { expect, test, type Page } from "@playwright/test";

/** Mock the orchestrator API so specs run without a backend or API keys. */
async function mockApi(page: Page): Promise<void> {
  await page.route("**/api/gemini-token", (route) =>
    route.fulfill({
      json: { token: "auth_tokens/fake", expiresAt: "2099-01-01T00:00:00Z" },
    }),
  );
  await page.route("**/api/ground", (route) =>
    route.fulfill({ json: { grounding: "", hits: [], degraded: false } }),
  );
  await page.route("**/api/media", (route) =>
    route.fulfill({ json: { source: "none", media: null, degraded: false } }),
  );
}

test("attract mode shows the wake button and avatar", async ({ page }) => {
  await mockApi(page);
  await page.goto("/");
  await expect(page.locator("main.kiosk")).toHaveAttribute(
    "data-state",
    "idle",
  );
  await expect(
    page.getByRole("button", { name: /tap to talk/i }),
  ).toBeVisible();
  await expect(page.locator("canvas")).toBeVisible();
});

test("avatar canvas actually paints the idle animation", async ({ page }) => {
  await mockApi(page);
  await page.goto("/");
  await page.waitForTimeout(300); // let a few rAF frames run
  const painted = await page.evaluate(() => {
    const c = document.querySelector("canvas") as HTMLCanvasElement | null;
    if (!c) return false;
    const ctx = c.getContext("2d");
    if (!ctx) return false;
    const { data } = ctx.getImageData(0, 0, c.width, c.height);
    // Any non-transparent pixel means the face was drawn.
    for (let i = 3; i < data.length; i += 4) if (data[i] > 0) return true;
    return false;
  });
  expect(painted).toBe(true);
});

test("tapping wake leaves attract mode and starts connecting", async ({
  page,
}) => {
  await mockApi(page);
  await page.goto("/");
  await page
    .getByRole("button", { name: /tap to talk/i })
    .click({ force: true });
  // Fake token can't open a real Live session, so we land in connecting and
  // then reconnecting — either proves we left idle and the wiring runs.
  await expect(page.locator("main.kiosk")).not.toHaveAttribute(
    "data-state",
    "idle",
  );
  await expect(page.getByRole("button", { name: /tap to talk/i })).toHaveCount(
    0,
  );
});

test("typed-question input is present but disabled until the session is active", async ({
  page,
}) => {
  await mockApi(page);
  await page.goto("/");
  await page
    .getByRole("button", { name: /tap to talk/i })
    .click({ force: true });
  const input = page.getByLabel("Type your question");
  await expect(input).toBeVisible();
  // Not "active" (no real Live open), so the input stays disabled.
  await expect(input).toBeDisabled();
});
