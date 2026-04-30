function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function isSafeSlug(value: string): boolean {
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
    if (!isSafeSlug(slug)) return raw;

    const label = (labelRaw ?? slugRaw).trim();
    return `<a href="/notes/${slug}" class="ga-chat__note-link">${label}</a>`;
  });

  html = html.replace(NOTE_MARKDOWN_LINK_RE, (_raw, label: string, _path: string, slug: string) => {
    if (!isSafeSlug(slug)) return label;
    return `<a href="/notes/${slug}" class="ga-chat__note-link">${label}</a>`;
  });

  html = html.replace(ITALIC_RE, '$1<em>$2</em>');
  html = html.replace(/\n/g, '<br>');

  return html;
}
