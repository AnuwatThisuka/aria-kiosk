import type Supermemory from "supermemory";
import { KIOSK_MEDIA, type MediaType } from "./schema";
import type { SearchExecuteResponse } from "./search";

/** A media asset resolved from the library or the web fallback. */
export interface MediaResult {
  url: string;
  type: MediaType;
  title: string | null;
  /** Human/searchable description of the asset. */
  description: string;
  /** Relevance score (library hits); web fallback uses 1. */
  score: number;
  source: "library" | "web";
  tags: string[];
}

/**
 * Default relevance floor for "use our own media" vs. "fall back to web"
 * (IMPLEMENTATION_PLAN §7 open decision). Tune against real content.
 */
export const DEFAULT_MEDIA_THRESHOLD = 0.5;

export interface SearchMediaOptions {
  limit?: number;
}

/** Hybrid search with rerank over the `kiosk_media` namespace. */
export function searchMedia(
  client: Supermemory,
  query: string,
  opts: SearchMediaOptions = {},
): Promise<SearchExecuteResponse> {
  return client.search.execute({
    q: query,
    containerTags: [KIOSK_MEDIA],
    rerank: true,
    limit: opts.limit ?? 5,
  });
}

function asString(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}

/**
 * Flatten a raw search response into `MediaResult`s. Drops entries missing a
 * renderable `metadata.url` or a valid `metadata.type` — those can't be shown.
 * Pure; unit-tested.
 */
export function extractMediaHits(res: SearchExecuteResponse): MediaResult[] {
  const hits: MediaResult[] = [];
  for (const r of res.results) {
    const meta = r.metadata ?? {};
    const url = asString(meta.url);
    const type = asString(meta.type);
    if (!url || (type !== "image" && type !== "video")) continue;
    const tagsRaw = asString(meta.tags);
    const description =
      r.chunks
        .map((c) => c.content.trim())
        .filter(Boolean)
        .join(" ") ||
      (r.title ?? "");
    hits.push({
      url,
      type,
      title: r.title,
      description,
      score: r.score,
      source: "library",
      tags: tagsRaw
        ? tagsRaw
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean)
        : [],
    });
  }
  return hits;
}

/**
 * Pick the best library hit at or above `threshold`, or null when nothing
 * clears the bar (caller then decides to use the web fallback).
 */
export function pickMedia(
  hits: MediaResult[],
  threshold = DEFAULT_MEDIA_THRESHOLD,
): MediaResult | null {
  let best: MediaResult | null = null;
  for (const h of hits) {
    if (h.score >= threshold && (!best || h.score > best.score)) best = h;
  }
  return best;
}
