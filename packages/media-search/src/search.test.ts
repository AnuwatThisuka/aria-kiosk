import { expect, test } from "bun:test";
import {
  buildGroundingContext,
  extractKnowledgeHits,
  GROUNDING_PREAMBLE,
  type SearchExecuteResponse,
} from "./search";

function fakeResponse(
  results: SearchExecuteResponse["results"],
): SearchExecuteResponse {
  return { results, timing: 1, total: results.length };
}

test("extractKnowledgeHits prefers relevant chunks", () => {
  const res = fakeResponse([
    {
      documentId: "doc1",
      title: "Hours",
      score: 0.9,
      metadata: { category: "hours" },
      createdAt: "",
      updatedAt: "",
      type: "text",
      chunks: [
        { content: "Open 9-6", isRelevant: true, score: 0.9 },
        { content: "noise", isRelevant: false, score: 0.1 },
      ],
    },
  ]);
  const hits = extractKnowledgeHits(res);
  expect(hits).toHaveLength(1);
  expect(hits[0]!.text).toBe("Open 9-6");
  expect(hits[0]!.title).toBe("Hours");
});

test("extractKnowledgeHits falls back to all chunks when none flagged relevant", () => {
  const res = fakeResponse([
    {
      documentId: "doc2",
      title: null,
      score: 0.5,
      metadata: null,
      createdAt: "",
      updatedAt: "",
      type: "text",
      chunks: [{ content: "only chunk", isRelevant: false, score: 0.5 }],
    },
  ]);
  expect(extractKnowledgeHits(res)[0]!.text).toBe("only chunk");
});

test("buildGroundingContext returns empty string when no usable hits", () => {
  expect(buildGroundingContext([])).toBe("");
  expect(
    buildGroundingContext([
      { documentId: "d", title: null, score: 1, text: "", metadata: null },
    ]),
  ).toBe("");
});

test("buildGroundingContext numbers hits and includes the preamble", () => {
  const ctx = buildGroundingContext([
    {
      documentId: "d1",
      title: "Hours",
      score: 0.9,
      text: "Open 9-6",
      metadata: null,
    },
    {
      documentId: "d2",
      title: null,
      score: 0.8,
      text: "3rd floor lobby",
      metadata: null,
    },
  ]);
  expect(ctx).toContain(GROUNDING_PREAMBLE);
  expect(ctx).toContain("[1] Hours\nOpen 9-6");
  expect(ctx).toContain("[2]\n3rd floor lobby");
});

test("buildGroundingContext respects the limit", () => {
  const hits = Array.from({ length: 8 }, (_, i) => ({
    documentId: `d${i}`,
    title: null,
    score: 1,
    text: `fact ${i}`,
    metadata: null,
  }));
  const ctx = buildGroundingContext(hits, { limit: 2 });
  expect(ctx).toContain("fact 0");
  expect(ctx).toContain("fact 1");
  expect(ctx).not.toContain("fact 2");
});
