import Supermemory from "supermemory";

/**
 * Construct a Supermemory client from an explicit key or `SUPERMEMORY_API_KEY`.
 * Throws if no key is available — callers should surface this at startup, not
 * per-request, so the kiosk never boots into a broken retrieval state.
 */
export function createSupermemoryClient(apiKey?: string): Supermemory {
  const key = apiKey ?? process.env.SUPERMEMORY_API_KEY;
  if (!key) {
    throw new Error(
      "SUPERMEMORY_API_KEY is not set — cannot initialise media search",
    );
  }
  return new Supermemory({ apiKey: key });
}
