/**
 * Server-side Markdown renderer.
 *
 * Uses unified → remark-parse → remark-gfm → remark-rehype → rehype-shiki
 * → rehype-stringify to produce HTML with syntax-highlighted code blocks.
 *
 * This module is server-only — never import from client components.
 */

import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import rehypeStringify from 'rehype-stringify';
import { createRequire } from 'module';
import type { Plugin } from 'unified';
import { remarkInlineMediaEmbeds } from '$lib/utils/inline-media';

// rehype-shiki@0.0.9 is a legacy CJS package; use createRequire to import it.
const _require = createRequire(import.meta.url);

type RehypeShikiOptions = { theme?: string };

// Cast the CJS default export to the unified Plugin type.
const rehypeShiki = _require('rehype-shiki') as Plugin<[RehypeShikiOptions?]>;

// Cache the built processor so Shiki is only initialized once per process.
let _processor: Awaited<ReturnType<typeof buildProcessor>> | null = null;

async function buildProcessor() {
  return unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkInlineMediaEmbeds)
    .use(remarkRehype, { allowDangerousHtml: false })
    .use(rehypeShiki, { theme: 'dark_plus' })
    .use(rehypeStringify);
}

async function getProcessor() {
  if (!_processor) {
    _processor = await buildProcessor();
  }
  return _processor;
}

/**
 * Renders a Markdown string to an HTML string.
 * Code blocks are syntax-highlighted via Shiki (dark_plus theme).
 */
export async function renderMarkdown(markdown: string): Promise<string> {
  const processor = await getProcessor();
  const file = await processor.process(markdown);
  return String(file);
}
