import type Supermemory from "supermemory";
import { KIOSK_MEDIA, type MediaType } from "./schema";

/** One media asset to ingest into the `kiosk_media` library. */
export interface MediaSeed {
  /** Rich text description used for semantic matching against speech. */
  description: string;
  url: string;
  type: MediaType;
  tags?: string[];
}

export interface IngestReport {
  added: number;
  failed: number;
  errors: { url: string; error: string }[];
}

/**
 * Batch-ingest media entries into Supermemory under `kiosk_media`. Each entry
 * always carries `metadata.url` + `metadata.type` (AGENTS.md convention).
 * Continues past individual failures and reports counts.
 */
export async function ingestMediaLibrary(
  client: Supermemory,
  seeds: MediaSeed[],
): Promise<IngestReport> {
  const report: IngestReport = { added: 0, failed: 0, errors: [] };
  for (const seed of seeds) {
    const metadata: Record<string, string> = {
      type: seed.type,
      url: seed.url,
    };
    if (seed.tags && seed.tags.length > 0) {
      metadata.tags = seed.tags.join(",");
    }
    try {
      await client.add({
        content: seed.description,
        containerTags: [KIOSK_MEDIA],
        metadata,
      });
      report.added++;
    } catch (err) {
      report.failed++;
      report.errors.push({
        url: seed.url,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return report;
}
