import { expect, test } from "bun:test";
import {
  deriveMediaQuery,
  extractVisualIntents,
  stripVisualTags,
} from "./visualIntent";

test("extractVisualIntents pulls every tag", () => {
  expect(
    extractVisualIntents(
      "Fuji [visual: Mount Fuji] and [visual: cherry blossom]",
    ),
  ).toEqual(["Mount Fuji", "cherry blossom"]);
  expect(extractVisualIntents("no tags here")).toEqual([]);
});

test("stripVisualTags removes tags and tidies whitespace", () => {
  expect(stripVisualTags("Fuji [visual: Mount Fuji] is tall")).toBe(
    "Fuji is tall",
  );
});

test("deriveMediaQuery prefers tags, else the stripped sentence", () => {
  expect(deriveMediaQuery("The lobby [visual: reception desk] is here")).toBe(
    "reception desk",
  );
  expect(deriveMediaQuery("Where is the reception desk?")).toBe(
    "Where is the reception desk?",
  );
});
