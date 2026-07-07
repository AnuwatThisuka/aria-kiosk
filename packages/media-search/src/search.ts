import type Supermemory from "supermemory";
import { KIOSK_KNOWLEDGE } from "./schema";

/**
 * Response shape of `client.search.execute`, derived from the SDK so we don't
 * depend on a deep subpath import.
 */
export type SearchExecuteResponse = Awaited<
  ReturnType<Supermemory["search"]["execute"]>
>;

/** A flattened, LLM-ready knowledge match. */
export interface KnowledgeHit {
  documentId: string;
  title: string | null;
  /** Relevance score of the match (higher is better). */
  score: number;
  /** Joined relevant chunk text, ready to drop into a prompt. */
  text: string;
  metadata: Record<string, unknown> | null;
}

export interface SearchKnowledgeOptions {
  /** Max documents to return. */
  limit?: number;
  /** Rerank for precision (adds latency; on by default for grounding). */
  rerank?: boolean;
}

/**
 * Hybrid search (managed vector + keyword) over the `kiosk_knowledge`
 * namespace. In Supermemory SDK v3 `search.execute` is the hybrid endpoint —
 * it replaces the earlier explicit `searchMode: "hybrid"` flag.
 */
export function searchKnowledge(
  client: Supermemory,
  query: string,
  opts: SearchKnowledgeOptions = {},
): Promise<SearchExecuteResponse> {
  const { limit = 5, rerank = true } = opts;
  return client.search.execute({
    q: query,
    containerTags: [KIOSK_KNOWLEDGE],
    rerank,
    limit,
  });
}

/**
 * Flatten a raw search response into `KnowledgeHit`s. Prefers chunks flagged
 * relevant; falls back to all returned chunks. Pure — unit-tested without a
 * live Supermemory connection.
 */
export function extractKnowledgeHits(
  res: SearchExecuteResponse,
): KnowledgeHit[] {
  return res.results.map((r) => {
    const relevant = r.chunks.filter((c) => c.isRelevant);
    const source = relevant.length > 0 ? relevant : r.chunks;
    const text = source
      .map((c) => c.content.trim())
      .filter(Boolean)
      .join("\n");
    return {
      documentId: r.documentId,
      title: r.title,
      score: r.score,
      text,
      metadata: r.metadata,
    };
  });
}

/** Preamble that frames retrieved knowledge for the LLM. */
export const GROUNDING_PREAMBLE =
  "Use the following verified company knowledge to answer the visitor. " +
  "If it does not contain the answer, say you'll check on it rather than " +
  "guessing. Do not read these notes aloud verbatim.";

export interface GroundingOptions {
  /** Max hits to include in the context block. */
  limit?: number;
}

/**
 * Build a system-injectable grounding block from knowledge hits. Returns an
 * empty string when there is nothing to ground on, so callers can cheaply
 * decide to skip injection. Pure — unit-tested.
 */
export function buildGroundingContext(
  hits: KnowledgeHit[],
  opts: GroundingOptions = {},
): string {
  const { limit = 5 } = opts;
  const top = hits.filter((h) => h.text.length > 0).slice(0, limit);
  if (top.length === 0) return "";
  const body = top
    .map((h, i) => `[${i + 1}]${h.title ? ` ${h.title}` : ""}\n${h.text}`)
    .join("\n\n");
  return `${GROUNDING_PREAMBLE}\n\n${body}`;
}
