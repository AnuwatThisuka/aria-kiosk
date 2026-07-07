/**
 * Supermemory namespace + data-model schema for Aria Kiosk.
 *
 * Two namespaces are separated purely by `containerTags`:
 *   - `kiosk_knowledge` — text knowledge base (company info, FAQs) used to
 *     ground LLM answers.
 *   - `kiosk_media` — media library entries: each image/video stored with a
 *     rich text description so semantic search can match it against spoken
 *     content.
 *
 * Every `client.add()` call MUST set exactly one of these tags. Never mix.
 */

/** Container tag identifying the text knowledge-base namespace. */
export const KIOSK_KNOWLEDGE = "kiosk_knowledge" as const;

/** Container tag identifying the media-library namespace. */
export const KIOSK_MEDIA = "kiosk_media" as const;

/** All valid container tags. */
export const CONTAINER_TAGS = [KIOSK_KNOWLEDGE, KIOSK_MEDIA] as const;

export type ContainerTag = (typeof CONTAINER_TAGS)[number];

/** Supported media types for `kiosk_media` entries. */
export type MediaType = "image" | "video";

/** Metadata attached to a `kiosk_knowledge` memory. */
export interface KnowledgeMetadata {
  /** Coarse grouping, e.g. "hours", "directions", "services". */
  category: string;
  /** ISO date the entry was last updated. */
  updatedAt: string;
  [key: string]: string | number | boolean;
}

/** Metadata attached to a `kiosk_media` memory. Always requires url + type. */
export interface MediaMetadata {
  type: MediaType;
  /** Renderable URL for the asset (required — see AGENTS.md conventions). */
  url: string;
  /** Short keyword tags to aid retrieval, comma-joined for Supermemory. */
  tags?: string;
  [key: string]: string | number | boolean | undefined;
}

/** A knowledge-base entry ready to pass to `client.add()`. */
export interface KnowledgeEntry {
  content: string;
  containerTags: [typeof KIOSK_KNOWLEDGE];
  metadata: KnowledgeMetadata;
}

/** A media-library entry ready to pass to `client.add()`. */
export interface MediaEntry {
  content: string;
  containerTags: [typeof KIOSK_MEDIA];
  metadata: MediaMetadata;
}

/** Build a well-formed knowledge entry with the correct container tag. */
export function knowledgeEntry(
  content: string,
  metadata: KnowledgeMetadata,
): KnowledgeEntry {
  return { content, containerTags: [KIOSK_KNOWLEDGE], metadata };
}

/** Build a well-formed media entry with the correct container tag. */
export function mediaEntry(
  content: string,
  metadata: MediaMetadata,
): MediaEntry {
  return { content, containerTags: [KIOSK_MEDIA], metadata };
}
