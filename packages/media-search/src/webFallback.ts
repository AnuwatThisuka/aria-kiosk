import type { MediaResult } from "./mediaSearch";

/** Web media search fallback when the library has no confident match. */
export interface WebMediaProvider {
  search(query: string): Promise<MediaResult[]>;
}

type FetchFn = typeof fetch;

interface PexelsPhoto {
  alt?: string;
  src?: { large?: string; medium?: string; original?: string };
}
interface PexelsSearchResponse {
  photos?: PexelsPhoto[];
}

/**
 * Pexels image provider (licensed stock, free tier). Chosen as the default
 * fallback per IMPLEMENTATION_PLAN §7; swap by implementing
 * {@link WebMediaProvider}. Never throws — returns [] on any error so the
 * kiosk degrades to showing nothing rather than breaking.
 */
export class PexelsProvider implements WebMediaProvider {
  constructor(
    private readonly apiKey: string,
    private readonly fetchFn: FetchFn = fetch,
  ) {}

  async search(query: string): Promise<MediaResult[]> {
    const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(
      query,
    )}&per_page=3`;
    try {
      const res = await this.fetchFn(url, {
        headers: { Authorization: this.apiKey },
      });
      if (!res.ok) return [];
      const body = (await res.json()) as PexelsSearchResponse;
      const photos = body.photos ?? [];
      const out: MediaResult[] = [];
      for (const p of photos) {
        const src = p.src?.large ?? p.src?.medium ?? p.src?.original;
        if (!src) continue;
        out.push({
          url: src,
          type: "image",
          title: p.alt ?? null,
          description: p.alt ?? query,
          score: 1,
          source: "web",
          tags: [],
        });
      }
      return out;
    } catch {
      return [];
    }
  }
}

/**
 * Build a web provider from `WEB_IMAGE_SEARCH_API_KEY`, or null when unset so
 * callers can skip the fallback entirely.
 */
export function createWebProvider(
  apiKey = process.env.WEB_IMAGE_SEARCH_API_KEY,
): WebMediaProvider | null {
  if (!apiKey) return null;
  return new PexelsProvider(apiKey);
}
