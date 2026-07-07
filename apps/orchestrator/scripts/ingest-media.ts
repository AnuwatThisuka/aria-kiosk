#!/usr/bin/env bun
/**
 * Batch-ingest the media library into Supermemory (`kiosk_media`).
 *
 * Usage:
 *   bun run ingest:media                       # uses scripts/media-seed.json
 *   bun run ingest:media path/to/manifest.json
 *
 * The manifest is a JSON array of { description, url, type, tags? }. Each
 * entry's `description` is the rich text Supermemory embeds for semantic
 * matching against speech; `url`/`type` are stored in metadata for rendering.
 *
 * Requires SUPERMEMORY_API_KEY in the environment (.env).
 */
import { resolve } from "node:path";
import {
  createSupermemoryClient,
  ingestMediaLibrary,
  type MediaSeed,
} from "@aria/media-search";

async function main(): Promise<void> {
  const manifestPath = resolve(
    process.argv[2] ?? new URL("./media-seed.json", import.meta.url).pathname,
  );
  const file = Bun.file(manifestPath);
  if (!(await file.exists())) {
    console.error(`manifest not found: ${manifestPath}`);
    process.exit(1);
  }

  const seeds = (await file.json()) as MediaSeed[];
  if (!Array.isArray(seeds) || seeds.length === 0) {
    console.error("manifest must be a non-empty JSON array of media entries");
    process.exit(1);
  }

  const client = createSupermemoryClient();
  console.log(`ingesting ${seeds.length} media entries into kiosk_media…`);
  const report = await ingestMediaLibrary(client, seeds);
  console.log(`added ${report.added}, failed ${report.failed}`);
  for (const e of report.errors) console.error(`  ${e.url}: ${e.error}`);
  if (report.failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
