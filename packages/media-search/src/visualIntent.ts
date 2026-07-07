/**
 * Visual-intent extraction (IMPLEMENTATION_PLAN §5).
 *
 * The intended convention is that the LLM tags visual cues inline, e.g.
 *   "Mount Fuji is the tallest volcano in Japan [visual: Mount Fuji]"
 * and the orchestrator uses the tag as the media search query.
 *
 * Gemini Live emits a single response modality (audio), so in the current loop
 * we derive the query from the spoken sentence transcript instead — but the
 * tag path is supported for when a text-capable path (tool-call, side channel)
 * provides one. {@link deriveMediaQuery} prefers tags, else the sentence.
 */

const VISUAL_TAG = /\[visual:\s*([^\]]+)\]/gi;

/** Extract all `[visual: …]` phrases from a chunk of model text. */
export function extractVisualIntents(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(VISUAL_TAG)) {
    const phrase = m[1]?.trim();
    if (phrase) out.push(phrase);
  }
  return out;
}

/** Remove `[visual: …]` tags so text can be displayed/spoken cleanly. */
export function stripVisualTags(text: string): string {
  return text
    .replace(VISUAL_TAG, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/**
 * Best media query for a spoken sentence: joined visual tags if present,
 * otherwise the tag-stripped sentence itself.
 */
export function deriveMediaQuery(sentence: string): string {
  const intents = extractVisualIntents(sentence);
  if (intents.length > 0) return intents.join(", ");
  return stripVisualTags(sentence);
}
