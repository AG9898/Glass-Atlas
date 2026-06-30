/**
 * Escapes the five HTML-significant characters in `value`.
 * Exported so other chat-safe formatting helpers (e.g. source snippets) can
 * reuse the same escaping rules instead of duplicating them.
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Default character cap for chat source-popup snippets. */
const SOURCE_SNIPPET_MAX_LENGTH = 200;

/**
 * Builds a safe, deterministic snippet string for the chat source-popup
 * contract from raw retrieved note text (a chunk excerpt or takeaway).
 *
 * Collapses internal whitespace/newlines to single spaces, truncates to
 * `maxLength` characters with an ellipsis when needed, and HTML-escapes the
 * result. Truncation happens before escaping so multi-byte HTML entities are
 * never split. Source text always comes from retrieval candidates already
 * selected for prompt assembly — never from LLM output.
 */
export function buildSourceSnippet(text: string, maxLength = SOURCE_SNIPPET_MAX_LENGTH): string {
  const collapsed = text.replace(/\s+/g, ' ').trim();
  if (collapsed.length === 0) return '';

  const truncated =
    collapsed.length > maxLength ? `${collapsed.slice(0, maxLength).trimEnd()}…` : collapsed;

  return escapeHtml(truncated);
}

/**
 * Returns `true` when `value` is a safe URL slug for a note page.
 * Slugs must start with a lowercase alphanumeric character and contain only
 * lowercase letters, digits, and hyphens. This is the canonical slug safety
 * check used by both the chat renderer and the server-side fallback builder.
 */
export function isSafeNoteSlug(value: string): boolean {
  return /^[a-z0-9][a-z0-9-]*$/.test(value);
}

// Matches [[slug]] and [[slug|display text]]
const WIKI_LINK_RE = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;
// Matches markdown links to local note pages only: [Label](/notes/slug)
const NOTE_MARKDOWN_LINK_RE = /\[([^\]]+)\]\((\/notes\/([a-z0-9-]+))\)/g;
// Single-asterisk italics only (intentionally excludes **bold**)
const ITALIC_RE = /(^|[^*])\*([^*\n]+)\*(?!\*)/g;

/**
 * Converts trusted chat markdown-lite into safe HTML for rendering in the chat UI.
 * Supported:
 * - *italic*
 * - [[slug]] / [[slug|label]]
 * - [label](/notes/slug)
 */
export function renderChatMessageHtml(content: string): string {
  let html = escapeHtml(content);

  html = html.replace(WIKI_LINK_RE, (raw, slugRaw: string, labelRaw?: string) => {
    const slug = slugRaw.trim().toLowerCase();
    if (!isSafeNoteSlug(slug)) return raw;

    const label = (labelRaw ?? slugRaw).trim();
    return `<a href="/notes/${slug}" class="ga-chat__note-link">${label}</a>`;
  });

  html = html.replace(NOTE_MARKDOWN_LINK_RE, (_raw, label: string, _path: string, slug: string) => {
    if (!isSafeNoteSlug(slug)) return label;
    return `<a href="/notes/${slug}" class="ga-chat__note-link">${label}</a>`;
  });

  html = html.replace(ITALIC_RE, '$1<em>$2</em>');
  html = html.replace(/\n/g, '<br>');

  return html;
}
