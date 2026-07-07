import { expect, test } from "bun:test";
import { extractMediaHits, pickMedia } from "./mediaSearch";
import type { SearchExecuteResponse } from "./search";

function res(results: SearchExecuteResponse["results"]): SearchExecuteResponse {
  return { results, timing: 1, total: results.length };
}

function result(
  over: Partial<SearchExecuteResponse["results"][number]> & {
    metadata: Record<string, unknown> | null;
    score: number;
  },
): SearchExecuteResponse["results"][number] {
  return {
    documentId: "d",
    title: "t",
    createdAt: "",
    updatedAt: "",
    type: "image",
    chunks: [],
    ...over,
  };
}

test("extractMediaHits keeps entries with url+type, drops the rest", () => {
  const hits = extractMediaHits(
    res([
      result({
        score: 0.9,
        metadata: {
          url: "https://cdn/lobby.jpg",
          type: "image",
          tags: "lobby, desk",
        },
        chunks: [{ content: "reception desk", isRelevant: true, score: 0.9 }],
      }),
      result({ score: 0.8, metadata: { type: "image" } }), // no url -> dropped
      result({ score: 0.7, metadata: { url: "x", type: "audio" } }), // bad type
    ]),
  );
  expect(hits).toHaveLength(1);
  expect(hits[0]!.url).toBe("https://cdn/lobby.jpg");
  expect(hits[0]!.type).toBe("image");
  expect(hits[0]!.tags).toEqual(["lobby", "desk"]);
  expect(hits[0]!.description).toBe("reception desk");
  expect(hits[0]!.source).toBe("library");
});

test("pickMedia returns best hit above threshold, else null", () => {
  const hits = extractMediaHits(
    res([
      result({ score: 0.4, metadata: { url: "a", type: "image" } }),
      result({ score: 0.7, metadata: { url: "b", type: "image" } }),
    ]),
  );
  expect(pickMedia(hits, 0.5)!.url).toBe("b");
  expect(pickMedia(hits, 0.9)).toBeNull();
});
