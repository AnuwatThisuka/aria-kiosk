import { expect, test } from "bun:test";
import { createApp } from "./app";

test("GET /health returns ok", async () => {
  const app = createApp();
  const res = await app.request("/health");
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ status: "ok" });
});

test("POST /api/gemini-token returns 503 when no GEMINI_API_KEY is set", async () => {
  const prev = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  try {
    const app = createApp();
    const res = await app.request("/api/gemini-token", { method: "POST" });
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "token_unavailable" });
  } finally {
    if (prev !== undefined) process.env.GEMINI_API_KEY = prev;
  }
});

test("POST /api/ground rejects an empty query with 400", async () => {
  const app = createApp({
    ground: async () => ({ grounding: "", hits: [], degraded: false }),
  });
  const res = await app.request("/api/ground", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query: "   " }),
  });
  expect(res.status).toBe(400);
});

test("POST /api/ground returns the grounder result", async () => {
  const app = createApp({
    ground: async (query) => ({
      grounding: `ctx for ${query}`,
      hits: [
        {
          documentId: "d1",
          title: "Hours",
          score: 0.9,
          text: "9-6",
          metadata: null,
        },
      ],
      degraded: false,
    }),
  });
  const res = await app.request("/api/ground", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query: "what are your hours" }),
  });
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.grounding).toBe("ctx for what are your hours");
  expect(body.hits).toHaveLength(1);
  expect(body.degraded).toBe(false);
});

test("POST /api/media returns the finder result", async () => {
  const app = createApp({
    findMedia: async (query) => ({
      source: "library",
      media: {
        url: "https://cdn/lobby.jpg",
        type: "image",
        title: query,
        description: "lobby",
        score: 0.9,
        source: "library",
        tags: [],
      },
      degraded: false,
    }),
  });
  const res = await app.request("/api/media", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query: "lobby" }),
  });
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.source).toBe("library");
  expect(body.media.url).toBe("https://cdn/lobby.jpg");
});

test("POST /api/media rejects an empty query with 400", async () => {
  const app = createApp({
    findMedia: async () => ({ source: "none", media: null, degraded: false }),
  });
  const res = await app.request("/api/media", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query: "" }),
  });
  expect(res.status).toBe(400);
});
