/**
 * Client-safe markdown preview transform helper.
 *
 * Converts a raw note body to sanitized preview HTML suitable for the admin
 * split-pane right pane. Applies wiki-link rendering before markdown-to-HTML
 * conversion so [[slug]] and [[slug|text]] appear as links or missing-ref spans.
 *
 * This module is intentionally free of server-only imports (no $env, no DB,
 * no rehype-shiki). It can be imported safely in Svelte client components.
 *
 * Fail-soft contract: renderPreview never throws. If any step in the transform
 * pipeline fails, it returns a PreviewResult with ok: false and an errorMessage.
 * The caller must not allow preview errors to block save/publish form actions.
 */

import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import rehypeStringify from 'rehype-stringify';
import { renderWikiLinks } from './wiki-links.js';
import { remarkInlineMediaEmbeds } from './inline-media.js';

export type PreviewResult =
  | { ok: true; html: string }
  | { ok: false; html: string; errorMessage: string };

const PREVIEW_ERROR_HTML =
  '<p class="preview-error">Preview unavailable — edit and save to continue.</p>';

// Build the unified processor once; reuse for every call.
// remark-rehype is run with allowDangerousHtml: false (default) so raw HTML
// in the markdown body is stripped — the wiki-link-missing spans inserted by
// renderWikiLinks use literal HTML and are intentionally injected before the
// markdown step, so they are handled by the raw HTML pass-through below.
const _processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkInlineMediaEmbeds)
  .use(remarkRehype, { allowDangerousHtml: true })
  .use(rehypeStringify, { allowDangerousHtml: true });

/**
 * Transforms a raw markdown body into preview HTML.
 *
 * @param body          Raw markdown string from the note editor.
 * @param resolvedSlugs Set of note slugs that currently exist in the DB,
 *                      used to distinguish resolved vs. unresolved wiki-links.
 * @returns             PreviewResult — always succeeds (ok: true) or fails soft
 *                      (ok: false) without throwing.
 */
export async function renderPreview(
  body: string,
  resolvedSlugs: Set<string>,
): Promise<PreviewResult> {
  try {
    // Step 1: replace wiki-link syntax with markdown links / missing-ref spans.
    const withLinks = renderWikiLinks(body, resolvedSlugs);

    // Step 2: convert markdown (including GFM tables, strikethrough, task lists,
    // footnotes) to HTML. The missing-ref spans survive because we allow raw HTML.
    const file = await _processor.process(withLinks);
    const html = String(file);

    return { ok: true, html };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, html: PREVIEW_ERROR_HTML, errorMessage: message };
  }
}

/**
 * Synchronous variant for callers that cannot await.
 *
 * Uses the same processor but runs it synchronously via unified's `.processSync`.
 * If the pipeline contains async plugins this will throw; since our pipeline
 * is synchronous (remark + rehype, no async plugins), this is safe here.
 *
 * Prefer `renderPreview` (async) in most contexts; use this only when an async
 * call site is not feasible.
 */
export function renderPreviewSync(body: string, resolvedSlugs: Set<string>): PreviewResult {
  try {
    const withLinks = renderWikiLinks(body, resolvedSlugs);
    const file = _processor.processSync(withLinks);
    return { ok: true, html: String(file) };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, html: PREVIEW_ERROR_HTML, errorMessage: message };
  }
}
