type InlineMediaKind = 'image' | 'video';
type InlineMediaAlign = 'left' | 'center' | 'wide';

export type InlineMediaEmbed = {
  src: string;
  kind: InlineMediaKind;
  align: InlineMediaAlign;
  alt: string;
  caption: string | null;
};

type MdastNode = {
  type: string;
  value?: string;
  url?: string;
  children?: MdastNode[];
  data?: {
    hName?: string;
    hProperties?: Record<string, unknown>;
    hChildren?: HastNode[];
  };
};

type HastNode =
  | {
      type: 'text';
      value: string;
    }
  | {
      type: 'element';
      tagName: string;
      properties?: Record<string, unknown>;
      children: HastNode[];
    };

type AttrMap = Map<string, string>;

const INLINE_MEDIA_RE = /^\s*\{\{media\s+(.+?)\s*\}\}\s*$/;
const ATTR_RE = /([a-zA-Z][a-zA-Z0-9_-]*)="([^"]*)"/g;

const ALIGN_VALUES = new Set<InlineMediaAlign>(['left', 'center', 'wide']);
const KIND_VALUES = new Set<InlineMediaKind>(['image', 'video']);

function inferKindFromSrc(src: string): InlineMediaKind {
  return /\.mp4(\?.*)?$/i.test(src) ? 'video' : 'image';
}

function parseAttributes(rawAttrs: string): AttrMap | null {
  const attrs = new Map<string, string>();
  const matchedSpans: Array<[start: number, end: number]> = [];

  for (const match of rawAttrs.matchAll(ATTR_RE)) {
    const key = match[1];
    const value = match[2];
    if (!key) continue;
    attrs.set(key.toLowerCase(), value);
    const start = match.index ?? -1;
    if (start >= 0) {
      matchedSpans.push([start, start + match[0].length]);
    }
  }

  // Reject malformed tokens so typos fail closed (leave original markdown text).
  let cursor = 0;
  for (const [start, end] of matchedSpans) {
    const gap = rawAttrs.slice(cursor, start).trim();
    if (gap !== '') return null;
    cursor = end;
  }
  if (rawAttrs.slice(cursor).trim() !== '') return null;

  return attrs;
}

function readAlign(attrs: AttrMap): InlineMediaAlign {
  const raw = (attrs.get('align') ?? 'center').trim().toLowerCase();
  return ALIGN_VALUES.has(raw as InlineMediaAlign) ? (raw as InlineMediaAlign) : 'center';
}

function readKind(attrs: AttrMap, src: string): InlineMediaKind {
  const raw = attrs.get('type') ?? attrs.get('kind');
  if (!raw) return inferKindFromSrc(src);
  const normalized = raw.trim().toLowerCase();
  return KIND_VALUES.has(normalized as InlineMediaKind)
    ? (normalized as InlineMediaKind)
    : inferKindFromSrc(src);
}

function cleanCaption(value: string | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

function cleanAlt(value: string | undefined, caption: string | null): string {
  const trimmed = value?.trim() ?? '';
  if (trimmed !== '') return trimmed;
  return caption ?? '';
}

export function parseInlineMediaEmbed(line: string): InlineMediaEmbed | null {
  const match = line.match(INLINE_MEDIA_RE);
  if (!match?.[1]) return null;

  const attrs = parseAttributes(match[1]);
  if (!attrs) return null;

  const src = (attrs.get('src') ?? attrs.get('url') ?? '').trim();
  if (src === '') return null;

  const caption = cleanCaption(attrs.get('caption'));
  const kind = readKind(attrs, src);
  const align = readAlign(attrs);
  const alt = cleanAlt(attrs.get('alt'), caption);

  return { src, kind, align, alt, caption };
}

function toFigureChildren(embed: InlineMediaEmbed): HastNode[] {
  const className = ['inline-media__asset', `inline-media__asset--${embed.kind}`];
  const mediaNode: HastNode =
    embed.kind === 'video'
      ? {
          type: 'element',
          tagName: 'video',
          properties: {
            src: embed.src,
            controls: true,
            preload: 'metadata',
            'aria-label': embed.alt || embed.caption || 'Embedded video',
            className,
          },
          children: [],
        }
      : {
          type: 'element',
          tagName: 'img',
          properties: {
            src: embed.src,
            alt: embed.alt,
            loading: 'lazy',
            decoding: 'async',
            className,
          },
          children: [],
        };

  const children: HastNode[] = [mediaNode];
  if (embed.caption) {
    children.push({
      type: 'element',
      tagName: 'figcaption',
      properties: { className: ['inline-media__caption'] },
      children: [{ type: 'text', value: embed.caption }],
    });
  }

  return children;
}

function createInlineMediaParagraphNode(embed: InlineMediaEmbed): MdastNode {
  return {
    type: 'paragraph',
    children: [],
    data: {
      hName: 'figure',
      hProperties: {
        className: [
          'inline-media',
          `inline-media--${embed.kind}`,
          `inline-media--${embed.align}`,
        ],
      },
      hChildren: toFigureChildren(embed),
    },
  };
}

function flattenInlineMediaParagraphText(children: MdastNode[]): string | null {
  let output = '';

  for (const child of children) {
    if (child.type === 'text' && typeof child.value === 'string') {
      output += child.value;
      continue;
    }

    // GFM autolinks URLs inside {{media ...}} attribute strings. Reconstruct
    // the raw token text from the link URL so parsing still works.
    if (child.type === 'link' && typeof child.url === 'string') {
      output += child.url;
      continue;
    }

    return null;
  }

  return output;
}

function transformNode(node: MdastNode): void {
  const children = node.children;
  if (!children || children.length === 0) return;

  for (let i = 0; i < children.length; i += 1) {
    const child = children[i];

    if (
      child.type === 'paragraph' &&
      child.children?.length
    ) {
      const paragraphText = flattenInlineMediaParagraphText(child.children);
      if (!paragraphText) {
        transformNode(child);
        continue;
      }

      const embed = parseInlineMediaEmbed(paragraphText);
      if (embed) {
        children[i] = createInlineMediaParagraphNode(embed);
        continue;
      }
    }

    transformNode(child);
  }
}

// remark plugin: converts "{{media ...}}" paragraph blocks into semantic
// figure/img/video HTML nodes through mdast -> hast bridge data fields.
export function remarkInlineMediaEmbeds() {
  return (tree: MdastNode) => {
    transformNode(tree);
  };
}

function escapeAttribute(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

export function createInlineMediaSnippet(input: {
  src: string;
  kind: InlineMediaKind;
  caption?: string | null;
  alt?: string | null;
  align?: InlineMediaAlign;
}): string {
  const align = input.align ?? 'center';
  const attrs = [`src="${escapeAttribute(input.src)}"`, `type="${input.kind}"`, `align="${align}"`];

  const caption = input.caption?.trim();
  if (caption) {
    attrs.push(`caption="${escapeAttribute(caption)}"`);
  }

  if (input.kind === 'image') {
    const alt = (input.alt ?? caption ?? '').trim();
    if (alt) {
      attrs.push(`alt="${escapeAttribute(alt)}"`);
    }
  }

  return `{{media ${attrs.join(' ')}}}`;
}
