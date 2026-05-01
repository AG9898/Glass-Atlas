import { describe, expect, it } from 'vitest';
import { createInlineMediaSnippet, parseInlineMediaEmbed } from './inline-media';

describe('parseInlineMediaEmbed', () => {
  it('parses an inline image embed with caption and alt text', () => {
    const result = parseInlineMediaEmbed(
      '{{media src="/api/admin/media/access-url?key=notes/2026/diagram.png" type="image" align="left" caption="System diagram" alt="Diagram"}}',
    );

    expect(result).toEqual({
      src: '/api/admin/media/access-url?key=notes/2026/diagram.png',
      kind: 'image',
      align: 'left',
      caption: 'System diagram',
      alt: 'Diagram',
    });
  });

  it('infers video kind from the src extension when type is omitted', () => {
    const result = parseInlineMediaEmbed(
      '{{media src="/api/admin/media/access-url?key=notes/2026/demo.mp4" caption="Demo clip"}}',
    );

    expect(result).toMatchObject({
      src: '/api/admin/media/access-url?key=notes/2026/demo.mp4',
      kind: 'video',
      align: 'center',
      caption: 'Demo clip',
    });
  });

  it('returns null for malformed attributes', () => {
    const result = parseInlineMediaEmbed(
      '{{media src="/api/admin/media/access-url?key=bad.png" type=image align="left"}}',
    );
    expect(result).toBeNull();
  });

  it('returns null when src is missing', () => {
    const result = parseInlineMediaEmbed('{{media type="image" caption="Missing src"}}');
    expect(result).toBeNull();
  });
});

describe('createInlineMediaSnippet', () => {
  it('generates a markdown embed token for video uploads', () => {
    const snippet = createInlineMediaSnippet({
      src: '/api/admin/media/access-url?key=notes/2026/demo.mp4',
      kind: 'video',
      caption: 'Demo clip',
      align: 'wide',
    });

    expect(snippet).toContain('src="/api/admin/media/access-url?key=notes/2026/demo.mp4"');
    expect(snippet).toContain('type="video"');
    expect(snippet).toContain('align="wide"');
    expect(snippet).toContain('caption="Demo clip"');
  });
});
