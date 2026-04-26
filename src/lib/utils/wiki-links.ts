export interface WikiLink {
  slug: string;
  text: string;
  raw: string;
}

// Matches [[slug]] and [[slug|display text]]
const WIKI_LINK_RE = /\[\[([^\]]+)\]\]/g;

export function parseWikiLinks(body: string): WikiLink[] {
  const links: WikiLink[] = [];
  for (const match of body.matchAll(WIKI_LINK_RE)) {
    const inner = match[1];
    const pipe = inner.indexOf('|');
    if (pipe === -1) {
      links.push({ slug: inner.trim(), text: inner.trim(), raw: match[0] });
    } else {
      links.push({
        slug: inner.slice(0, pipe).trim(),
        text: inner.slice(pipe + 1).trim(),
        raw: match[0],
      });
    }
  }
  return links;
}

// Converts wiki-link syntax to markdown links (resolved) or styled spans (unresolved).
// Call with the set of slugs that currently exist in the DB.
export function renderWikiLinks(body: string, resolvedSlugs: Set<string>): string {
  return body.replace(WIKI_LINK_RE, (_match, inner) => {
    const pipe = inner.indexOf('|');
    const slug = pipe === -1 ? inner.trim() : inner.slice(0, pipe).trim();
    const text = pipe === -1 ? inner.trim() : inner.slice(pipe + 1).trim();
    if (resolvedSlugs.has(slug)) {
      return `[${text}](/notes/${slug})`;
    }
    return `<span class="wiki-link-missing" title="Note not yet written">${text}</span>`;
  });
}
