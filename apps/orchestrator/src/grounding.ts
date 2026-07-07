import {
  buildGroundingContext,
  createSupermemoryClient,
  extractKnowledgeHits,
  searchKnowledge,
  type KnowledgeHit,
} from "@aria/media-search";
import type Supermemory from "supermemory";

export interface GroundResult {
  /** System-injectable grounding block, or "" when nothing was retrieved. */
  grounding: string;
  hits: KnowledgeHit[];
  /** True when retrieval was unavailable and we fell back to no grounding. */
  degraded: boolean;
}

/** A function that grounds a query — swappable in tests. */
export type Grounder = (query: string) => Promise<GroundResult>;

const EMPTY_DEGRADED: GroundResult = {
  grounding: "",
  hits: [],
  degraded: true,
};

/**
 * Build a grounder backed by Supermemory. The client is created lazily and
 * cached so a missing `SUPERMEMORY_API_KEY` degrades the endpoint (empty
 * grounding) instead of crashing the orchestrator at boot — the kiosk must
 * keep talking even when retrieval is down.
 */
export function createGrounder(): Grounder {
  let client: Supermemory | null = null;
  let clientFailed = false;

  return async function ground(query: string): Promise<GroundResult> {
    const trimmed = query.trim();
    if (!trimmed) return { grounding: "", hits: [], degraded: false };

    if (!client && !clientFailed) {
      try {
        client = createSupermemoryClient();
      } catch (err) {
        console.error("Supermemory client unavailable:", err);
        clientFailed = true;
      }
    }
    if (!client) return EMPTY_DEGRADED;

    try {
      const res = await searchKnowledge(client, trimmed);
      const hits = extractKnowledgeHits(res);
      return { grounding: buildGroundingContext(hits), hits, degraded: false };
    } catch (err) {
      console.error("Supermemory search failed:", err);
      return EMPTY_DEGRADED;
    }
  };
}
