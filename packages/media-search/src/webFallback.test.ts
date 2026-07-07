import { expect, test } from "bun:test";
import { PexelsProvider, createWebProvider } from "./webFallback";

test("PexelsProvider maps photos to MediaResults", async () => {
  const fakeFetch = (async () =>
    new Response(
      JSON.stringify({
        photos: [
          { alt: "a lobby", src: { large: "https://p/large.jpg" } },
          { src: {} }, // no usable src -> skipped
        ],
      }),
      { status: 200 },
    )) as unknown as typeof fetch;

  const provider = new PexelsProvider("KEY", fakeFetch);
  const results = await provider.search("lobby");
  expect(results).toHaveLength(1);
  expect(results[0]!.url).toBe("https://p/large.jpg");
  expect(results[0]!.source).toBe("web");
  expect(results[0]!.type).toBe("image");
});

test("PexelsProvider returns [] on non-ok / thrown fetch", async () => {
  const bad = (async () =>
    new Response("", { status: 500 })) as unknown as typeof fetch;
  expect(await new PexelsProvider("K", bad).search("x")).toEqual([]);
  const throws = (async () => {
    throw new Error("network");
  }) as unknown as typeof fetch;
  expect(await new PexelsProvider("K", throws).search("x")).toEqual([]);
});

test("createWebProvider is null without a key", () => {
  expect(createWebProvider(undefined)).toBeNull();
  expect(createWebProvider("KEY")).toBeInstanceOf(PexelsProvider);
});
