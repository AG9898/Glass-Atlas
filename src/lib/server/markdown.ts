/**
 * Server-side Markdown renderer.
 *
 * Uses unified → remark-parse → remark-gfm → remark-rehype → rehype-shiki
 * → rehype-stringify to produce HTML with syntax-highlighted code blocks.
 * Plain-text fences are rendered as unhighlighted code blocks because the
 * current legacy Shiki stack cannot tokenize that language. Mermaid fences
 * are rendered server-side to inline SVG via `renderMermaidToSvg`; a Mermaid
 * fence that fails to parse/render falls back to the same readable
 * unhighlighted-code treatment instead of throwing (see
 * `rehypeRenderMermaidDiagrams`).
 *
 * Every remaining `<pre><code>` block (highlighted, plain-text fallback, or
 * failed-Mermaid fallback) is wrapped in a `.ga-code-block` blueprint panel
 * with a header strip (language label, optional filename label, copy
 * control, wrap-toggle control) by `rehypeWrapCodeBlocks`. Fence info
 * strings may carry `filename="..."` after the language (for example
 * ` ```ts filename="app.ts" `); `rehypeExtractCodeMeta` reads that from the
 * mdast `code` node's `data.meta` (set by `mdast-util-to-hast`'s default
 * code handler) before any other rehype step runs, and stores it as a
 * `data-filename` property so it survives Shiki tokenization.
 *
 * This module is server-only — never import from client components.
 */

import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import rehypeRaw from 'rehype-raw';
import rehypeStringify from 'rehype-stringify';
import { createRequire } from 'module';
import type { Plugin } from 'unified';
import type { Node } from 'unist';
import { remarkInlineMediaEmbeds } from '$lib/utils/inline-media';
import { renderMermaidToSvg } from './mermaid-render';

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
    .use(rehypeExtractCodeMeta)
    .use(rehypeRenderMermaidDiagrams)
    .use(rehypeRaw)
    .use(rehypeUnsupportedCodeAsPlainText)
    .use(rehypeShiki, { theme: 'dark_plus' })
    .use(rehypeFixDarkThemeForeground)
    .use(rehypeRemoveUndefinedStyles)
    .use(rehypeWrapCodeBlocks)
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

type HastNode = Node & {
  tagName?: string;
  value?: string;
  properties?: {
    className?: unknown;
    [key: string]: unknown;
  };
  children?: HastNode[];
  data?: { meta?: unknown; [key: string]: unknown };
};

const UNHIGHLIGHTED_CODE_LANGUAGES = new Set(['plaintext', 'text', 'txt']);

/**
 * Reads the optional `filename="..."` attribute out of a fenced code block's
 * info-string meta (for example ` ```ts filename="app.ts" `) and stores it as
 * a `dataFilename` property on the `<code>` element so it survives Shiki
 * tokenization and can be read back by `rehypeWrapCodeBlocks`. Must run
 * immediately after `remarkRehype`, before any step that discards or
 * replaces `node.data` — `mdast-util-to-hast`'s default code handler stores
 * the raw meta string at `node.data.meta`, not in `node.properties`, and
 * `.data` does not survive `rehypeRaw`'s tree-wide stringify+reparse pass.
 * The property is deliberately named `dataFilename` (camelCase), not
 * `data-filename` — `rehypeRaw` round-trips the *entire* tree through HTML
 * (stringify then reparse) even when no literal raw node is present, and
 * `hast-util-from-parse5`/`property-information` normalize `data-*` HTML
 * attributes to camelCase hast property names on the way back in. Setting
 * the hyphenated form here would silently get renamed to `dataFilename` by
 * that round-trip anyway, breaking a same-key read later in the pipeline.
 */
const rehypeExtractCodeMeta: Plugin<[], Node> = () => {
  return (tree) => {
    visitElements(tree as HastNode, (node) => {
      if (node.tagName !== 'code') return;

      const meta = node.data?.meta;
      if (typeof meta !== 'string') return;

      const filenameMatch = meta.match(/filename="([^"]+)"/);
      if (!filenameMatch) return;

      node.properties = { ...node.properties, dataFilename: filenameMatch[1] };
    });
  };
};

/** Marks a `<code>` node's language as unsupported for highlighting, rendering it as readable plain text. */
function markCodeNodeAsUnhighlighted(node: HastNode, language: string): void {
  const className = node.properties?.className;
  const classes = Array.isArray(className)
    ? className.filter((item): item is string => typeof item === 'string')
    : [];
  const languageClass = classes.find((item) => item.startsWith(`language-${language}`));

  node.properties = {
    ...node.properties,
    className: classes.filter((item) => item !== languageClass).concat('unhighlighted-code-source'),
    'data-language': language,
  };
}

const rehypeUnsupportedCodeAsPlainText: Plugin<[], Node> = () => {
  return (tree) => {
    visitElements(tree as HastNode, (node) => {
      if (node.tagName !== 'code') return;

      const className = node.properties?.className;
      if (!Array.isArray(className)) return;

      const classes = className.filter((item): item is string => typeof item === 'string');
      const languageClass = classes.find((item) => item.startsWith('language-'));
      const language = languageClass?.slice('language-'.length);
      if (!language || !UNHIGHLIGHTED_CODE_LANGUAGES.has(language)) return;

      markCodeNodeAsUnhighlighted(node, language);
    });
  };
};

/** Concatenates the text content of a hast node and its descendants. */
function extractText(node: HastNode): string {
  if (typeof node.value === 'string') return node.value;
  return (node.children ?? []).map(extractText).join('');
}

/** Recursively walks a hast tree, awaiting an async visitor for every element node, pre-order. */
async function visitElementsAsync(
  node: HastNode,
  visitor: (node: HastNode) => Promise<void>,
): Promise<void> {
  if (node.type === 'element') {
    await visitor(node);
  }

  for (const child of node.children ?? []) {
    await visitElementsAsync(child, visitor);
  }
}

/**
 * Renders `<pre><code class="language-mermaid">...</code></pre>` blocks to
 * inline SVG via `renderMermaidToSvg`. On render failure, falls back to the
 * same readable unhighlighted-code treatment as plaintext fences instead of
 * throwing — a note page must never 500 because of a bad Mermaid diagram.
 */
const rehypeRenderMermaidDiagrams: Plugin<[], Node> = () => {
  return async (tree) => {
    await visitElementsAsync(tree as HastNode, async (node) => {
      if (node.tagName !== 'pre') return;

      const codeChild = (node.children ?? []).find((child) => child.tagName === 'code');
      if (!codeChild) return;

      const className = codeChild.properties?.className;
      if (!Array.isArray(className) || !className.includes('language-mermaid')) return;

      const source = extractText(codeChild);
      const result = await renderMermaidToSvg(source);

      if (!result.ok) {
        markCodeNodeAsUnhighlighted(codeChild, 'mermaid');
        return;
      }

      // Replace the <pre> node in place with a container holding the rendered
      // SVG. The SVG string is parsed into real hast element nodes by
      // `rehype-raw` (configured after this plugin), not injected as raw HTML
      // from untrusted markdown — mermaid renders under `securityLevel: 'strict'`,
      // which sanitizes label content internally.
      node.tagName = 'div';
      node.properties = { className: ['mermaid-diagram'] };
      node.children = [{ type: 'raw', value: result.svg } as HastNode];
    });
  };
};

// The legacy `dark_plus` theme stamps every <pre> with a dark background but
// emits its *default* token color as pure black (#000000) — and leaves
// un-tokenized blocks (plain ``` fences, mermaid/plaintext fallbacks) with no
// color at all, so they inherit the page's dark body text. Both render as
// near-black text on the near-black code background. Give the <pre> a readable
// light default foreground and rewrite the bogus #000000 spans to match.
const DARK_THEME_FOREGROUND = '#D4D4D4';

const rehypeFixDarkThemeForeground: Plugin<[], Node> = () => {
  return (tree) => {
    visitElements(tree as HastNode, (node) => {
      const style = joinStyles(node.properties?.style);
      if (!style) return;

      if (node.tagName === 'pre') {
        const hasBackground = style.includes('background');
        const hasColor = /(^|;)\s*color\s*:/.test(style);
        if (hasBackground && !hasColor) {
          node.properties = { ...node.properties, style: `${style}; color: ${DARK_THEME_FOREGROUND}` };
        }
        return;
      }

      if (style.includes('#000000')) {
        node.properties = {
          ...node.properties,
          style: style.replace(/#000000/g, DARK_THEME_FOREGROUND),
        };
      }
    });
  };
};

function joinStyles(style: unknown): string {
  if (typeof style === 'string') return style.trim().replace(/;\s*$/, '');
  if (Array.isArray(style)) {
    return style
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim().replace(/;\s*$/, ''))
      .join('; ');
  }
  return '';
}

const rehypeRemoveUndefinedStyles: Plugin<[], Node> = () => {
  return (tree) => {
    visitElements(tree as HastNode, (node) => {
      const style = node.properties?.style;
      if (typeof style === 'string') {
        if (style.includes('undefined')) {
          setCleanStyle(node, stripUndefinedStyles([style]));
        }
        return;
      }

      if (Array.isArray(style)) {
        setCleanStyle(node, stripUndefinedStyles(style));
      }
    });
  };
};

function setCleanStyle(node: HastNode, styles: string[]): void {
  const properties = { ...node.properties };
  if (styles.length > 0) {
    properties.style = styles;
  } else {
    delete properties.style;
  }
  node.properties = properties;
}

function stripUndefinedStyles(styles: unknown[]): string[] {
  return styles.filter((style): style is string => {
    return typeof style === 'string' && !style.includes('undefined');
  });
}

function visitElements(node: HastNode, visitor: (node: HastNode) => void): void {
  if (node.type === 'element') {
    visitor(node);
  }

  for (const child of node.children ?? []) {
    visitElements(child, visitor);
  }
}

/**
 * Wraps every remaining `<pre><code>` block (Shiki-highlighted, plain-text
 * fallback, or failed-Mermaid fallback) in a `.ga-code-block` blueprint
 * panel: a header strip with the language label (when known), an optional
 * filename label (from `rehypeExtractCodeMeta`'s `data-filename`), and
 * copy/wrap-toggle controls, plus a `.ga-code-block__body` wrapper around the
 * original `<pre>` (left untouched so Shiki's inline styles/classes keep
 * working). Must run after `rehypeShiki`/`rehypeFixDarkThemeForeground` so
 * the final `<pre>` markup is preserved as-is inside the new wrapper. The
 * actual copy-to-clipboard and wrap-toggle *behavior* is wired up
 * client-side in `NoteDetail.svelte` via event delegation on `data-role`
 * hooks — this plugin only emits the static markup.
 */
const rehypeWrapCodeBlocks: Plugin<[], Node> = () => {
  return (tree) => {
    wrapCodeBlocks(tree as HastNode);
  };
};

function wrapCodeBlocks(node: HastNode): void {
  if (!node.children) return;

  node.children = node.children.map((child) => {
    if (child.tagName === 'pre') {
      const wrapped = buildCodeBlockWrapper(child);
      if (wrapped) return wrapped;
    }

    wrapCodeBlocks(child);
    return child;
  });
}

function buildCodeBlockWrapper(preNode: HastNode): HastNode | null {
  const codeNode = (preNode.children ?? []).find((child) => child.tagName === 'code');
  if (!codeNode) return null;

  const language = extractCodeLanguage(codeNode);
  const filename = codeNode.properties?.dataFilename;

  const metaChildren: HastNode[] = [];
  if (language) {
    metaChildren.push(
      textElement('span', { className: ['ga-code-block__lang'] }, language.toUpperCase()),
    );
  }
  if (typeof filename === 'string' && filename.length > 0) {
    metaChildren.push(textElement('span', { className: ['ga-code-block__filename'] }, filename));
  }

  const header: HastNode = {
    type: 'element',
    tagName: 'div',
    properties: { className: ['ga-code-block__header'] },
    children: [
      {
        type: 'element',
        tagName: 'div',
        properties: { className: ['ga-code-block__meta'] },
        children: metaChildren,
      },
      {
        type: 'element',
        tagName: 'div',
        properties: { className: ['ga-code-block__controls'] },
        children: [
          textElement(
            'button',
            {
              type: 'button',
              className: ['ga-code-block__control'],
              'data-role': 'wrap-toggle',
              'aria-pressed': 'false',
              'aria-label': 'Toggle line wrap',
            },
            'WRAP',
          ),
          textElement(
            'button',
            {
              type: 'button',
              className: ['ga-code-block__control'],
              'data-role': 'copy',
              'aria-label': 'Copy code',
            },
            'COPY',
          ),
        ],
      },
    ],
  };

  const body: HastNode = {
    type: 'element',
    tagName: 'div',
    properties: { className: ['ga-code-block__body'] },
    children: [preNode],
  };

  return {
    type: 'element',
    tagName: 'div',
    properties: { className: ['ga-code-block'] },
    children: [header, body],
  };
}

function extractCodeLanguage(codeNode: HastNode): string | null {
  // `markCodeNodeAsUnhighlighted` sets `data-language` from two different
  // pipeline positions: before `rehypeRaw` for the failed-Mermaid fallback,
  // and after it for the plaintext-fence fallback. `rehypeRaw`'s tree-wide
  // stringify+reparse renames hyphenated `data-*` properties set beforehand
  // to camelCase (`dataLanguage`), so both forms must be checked here.
  const dataLanguage = codeNode.properties?.['data-language'] ?? codeNode.properties?.dataLanguage;
  if (typeof dataLanguage === 'string' && dataLanguage.length > 0) return dataLanguage;

  const className = codeNode.properties?.className;
  if (!Array.isArray(className)) return null;

  const languageClass = className.find(
    (item): item is string => typeof item === 'string' && item.startsWith('language-'),
  );
  return languageClass ? languageClass.slice('language-'.length) : null;
}

function textElement(tagName: string, properties: Record<string, unknown>, text: string): HastNode {
  return {
    type: 'element',
    tagName,
    properties,
    children: [{ type: 'text', value: text } as HastNode],
  };
}
