import { expect, test } from "bun:test";
import { ingestMediaLibrary, type MediaSeed } from "./ingest";
import type Supermemory from "supermemory";

type AddBody = {
  content: string;
  containerTags?: string[];
  metadata?: unknown;
};

function fakeClient(onAdd: (body: AddBody) => void, fail = false): Supermemory {
  return {
    add: async (body: AddBody) => {
      onAdd(body);
      if (fail) throw new Error("boom");
      return { id: "1", status: "ok" };
    },
  } as unknown as Supermemory;
}

const seeds: MediaSeed[] = [
  {
    description: "Lobby reception desk",
    url: "https://cdn/lobby.jpg",
    type: "image",
    tags: ["lobby", "reception"],
  },
];

test("ingestMediaLibrary tags kiosk_media and joins tags into metadata", async () => {
  const calls: AddBody[] = [];
  const report = await ingestMediaLibrary(
    fakeClient((b) => calls.push(b)),
    seeds,
  );
  expect(report.added).toBe(1);
  expect(report.failed).toBe(0);
  expect(calls[0]!.containerTags).toEqual(["kiosk_media"]);
  expect(calls[0]!.metadata).toEqual({
    type: "image",
    url: "https://cdn/lobby.jpg",
    tags: "lobby,reception",
  });
});

test("ingestMediaLibrary records failures and keeps going", async () => {
  const report = await ingestMediaLibrary(
    fakeClient(() => {}, true),
    seeds,
  );
  expect(report.added).toBe(0);
  expect(report.failed).toBe(1);
  expect(report.errors[0]!.url).toBe("https://cdn/lobby.jpg");
});
