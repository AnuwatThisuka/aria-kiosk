import {
  createSupermemoryClient,
  createWebProvider,
  DEFAULT_MEDIA_THRESHOLD,
  extractMediaHits,
  pickMedia,
  searchMedia,
  type MediaResult,
  type WebMediaProvider,
} from "@aria/media-search";
import type Supermemory from "supermemory";

export interface MediaFindResult {
  source: "library" | "web" | "none";
  media: MediaResult | null;
  /** True when retrieval paths were unavailable (not merely "no match"). */
  degraded: boolean;
}

export type MediaFinder = (query: string) => Promise<MediaFindResult>;

const NONE: MediaFindResult = { source: "none", media: null, degraded: false };

/**
 * Resolve a media asset for a spoken/typed query: try the `kiosk_media`
 * library first (rerank + relevance threshold), then the web fallback, then
 * give up gracefully. Lazily builds the Supermemory client and web provider so
 * missing keys degrade instead of crashing the kiosk.
 */
export function createMediaFinder(): MediaFinder {
  let client: Supermemory | null = null;
  let clientFailed = false;
  const web: WebMediaProvider | null = createWebProvider();
  const threshold = Number(
    process.env.MEDIA_THRESHOLD ?? DEFAULT_MEDIA_THRESHOLD,
  );

  return async function find(query: string): Promise<MediaFindResult> {
    const q = query.trim();
    if (!q) return NONE;

    if (!client && !clientFailed) {
      try {
        client = createSupermemoryClient();
      } catch (err) {
        console.error("Supermemory client unavailable:", err);
        clientFailed = true;
      }
    }

    // 1) Own media library.
    if (client) {
      try {
        const res = await searchMedia(client, q);
        const picked = pickMedia(extractMediaHits(res), threshold);
        if (picked)
          return { source: "library", media: picked, degraded: false };
      } catch (err) {
        console.error("media library search failed:", err);
      }
    }

    // 2) Web fallback.
    if (web) {
      try {
        const results = await web.search(q);
        if (results[0]) {
          return { source: "web", media: results[0], degraded: false };
        }
      } catch (err) {
        console.error("web media fallback failed:", err);
      }
    }

    // 3) Nothing — degraded only if no retrieval path was usable at all.
    const degraded = !client && clientFailed && !web;
    return { source: "none", media: null, degraded };
  };
}
