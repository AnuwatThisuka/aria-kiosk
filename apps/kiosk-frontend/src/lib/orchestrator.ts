/** Thin client for the orchestrator HTTP API (proxied at /api in dev). */

export interface EphemeralToken {
  token: string;
  expiresAt: string;
}

export interface KnowledgeHit {
  documentId: string;
  title: string | null;
  score: number;
  text: string;
  metadata: Record<string, unknown> | null;
}

export interface GroundResult {
  grounding: string;
  hits: KnowledgeHit[];
  degraded: boolean;
}

export interface MediaHit {
  url: string;
  type: "image" | "video";
  title: string | null;
  description: string;
  score: number;
  source: "library" | "web";
  tags: string[];
}

export interface MediaFindResult {
  source: "library" | "web" | "none";
  media: MediaHit | null;
  degraded: boolean;
}

const BASE = "";

/** Fetch a short-lived Gemini Live ephemeral token from the orchestrator. */
export async function fetchGeminiToken(): Promise<EphemeralToken> {
  const res = await fetch(`${BASE}/api/gemini-token`, { method: "POST" });
  if (!res.ok) {
    throw new Error(`token request failed: ${res.status}`);
  }
  return (await res.json()) as EphemeralToken;
}

/**
 * Ground a query against the company knowledge base. Never throws — on any
 * network/HTTP failure it degrades to empty grounding so the conversation
 * continues ungrounded rather than breaking.
 */
export async function ground(query: string): Promise<GroundResult> {
  try {
    const res = await fetch(`${BASE}/api/ground`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query }),
    });
    if (!res.ok) return { grounding: "", hits: [], degraded: true };
    return (await res.json()) as GroundResult;
  } catch {
    return { grounding: "", hits: [], degraded: true };
  }
}

/**
 * Resolve contextual media for a query. Never throws — degrades to "none" so
 * the UI simply shows no panel on failure.
 */
export async function findMedia(query: string): Promise<MediaFindResult> {
  try {
    const res = await fetch(`${BASE}/api/media`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query }),
    });
    if (!res.ok) return { source: "none", media: null, degraded: true };
    return (await res.json()) as MediaFindResult;
  } catch {
    return { source: "none", media: null, degraded: true };
  }
}
