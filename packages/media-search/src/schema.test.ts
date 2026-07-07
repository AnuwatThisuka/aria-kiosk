import { expect, test } from "bun:test";
import {
  KIOSK_KNOWLEDGE,
  KIOSK_MEDIA,
  knowledgeEntry,
  mediaEntry,
} from "./schema";

test("knowledgeEntry tags with kiosk_knowledge only", () => {
  const e = knowledgeEntry("Hours are 9-6", {
    category: "hours",
    updatedAt: "2026-07-01",
  });
  expect(e.containerTags).toEqual([KIOSK_KNOWLEDGE]);
  expect(e.containerTags).not.toContain(KIOSK_MEDIA);
});

test("mediaEntry tags with kiosk_media and requires url + type", () => {
  const e = mediaEntry("Lobby reception desk", {
    type: "image",
    url: "https://cdn.example/lobby.jpg",
  });
  expect(e.containerTags).toEqual([KIOSK_MEDIA]);
  expect(e.metadata.url).toBe("https://cdn.example/lobby.jpg");
  expect(e.metadata.type).toBe("image");
});
