/**
 * Server-side Markdown renderer.
 *
 * Uses unified → remark-parse → remark-gfm → remark-rehype → rehype-shiki
 * → rehype-stringify to produce HTML with syntax-highlighted code blocks.
 * Mermaid and plain-text fences are rendered as unhighlighted code blocks
 * because the current legacy Shiki stack cannot tokenize those languages.
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
import type { Node } from 'unist';
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
    .use(rehypeUnsupportedCodeAsPlainText)
    .use(rehypeShiki, { theme: 'dark_plus' })
    .use(rehypeFixDarkThemeForeground)
    .use(rehypeRemoveUndefinedStyles)
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
  properties?: {
    className?: unknown;
    [key: string]: unknown;
  };
  children?: HastNode[];
};

const UNHIGHLIGHTED_CODE_LANGUAGES = new Set(['mermaid', 'plaintext', 'text', 'txt']);

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

      node.properties = {
        ...node.properties,
        className: classes.filter((item) => item !== languageClass).concat('unhighlighted-code-source'),
        'data-language': language,
      };
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
