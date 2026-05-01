import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderPreview, renderPreviewSync } from './markdown-preview.js';

// ---------------------------------------------------------------------------
// Wiki-link resolution
// ---------------------------------------------------------------------------

describe('renderPreview — wiki-link resolution', () => {
  it('renders a resolved [[slug]] as an anchor link', async () => {
    const result = await renderPreview('See [[ci-cd]] for more.', new Set(['ci-cd']));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.html).toContain('href="/notes/ci-cd"');
    expect(result.html).toContain('ci-cd');
  });

  it('renders a resolved [[slug|display text]] with the custom label', async () => {
    const result = await renderPreview('See [[ci-cd|CI/CD pipelines]].', new Set(['ci-cd']));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.html).toContain('href="/notes/ci-cd"');
    expect(result.html).toContain('CI/CD pipelines');
  });

  it('renders an unresolved [[slug]] with the missing-reference treatment', async () => {
    const result = await renderPreview('See [[missing-note]].', new Set());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.html).toContain('wiki-link-missing');
    expect(result.html).toContain('missing-note');
    expect(result.html).not.toContain('href="/notes/missing-note"');
  });

  it('handles mixed resolved and unresolved links in one body', async () => {
    const result = await renderPreview(
      '[[exists]] and [[ghost]].',
      new Set(['exists']),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.html).toContain('href="/notes/exists"');
    expect(result.html).toContain('wiki-link-missing');
    expect(result.html).toContain('ghost');
  });

  it('accepts an empty slug set and treats every wiki-link as unresolved', async () => {
    const result = await renderPreview('[[alpha]] [[beta]]', new Set());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.html).not.toContain('/notes/');
    // Both links should have the missing-ref span
    const count = (result.html.match(/wiki-link-missing/g) ?? []).length;
    expect(count).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Markdown structure preservation
// ---------------------------------------------------------------------------

describe('renderPreview — markdown structure', () => {
  it('renders ATX headings (h1–h3)', async () => {
    const result = await renderPreview('# Heading 1\n## Heading 2\n### Heading 3', new Set());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.html).toContain('<h1>');
    expect(result.html).toContain('<h2>');
    expect(result.html).toContain('<h3>');
  });

  it('renders unordered lists', async () => {
    const result = await renderPreview('- item one\n- item two\n- item three', new Set());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.html).toContain('<ul>');
    expect(result.html).toContain('<li>');
    expect(result.html).toContain('item one');
  });

  it('renders ordered lists', async () => {
    const result = await renderPreview('1. first\n2. second', new Set());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.html).toContain('<ol>');
    expect(result.html).toContain('<li>');
  });

  it('renders bold and italic emphasis', async () => {
    const result = await renderPreview('**bold** and _italic_', new Set());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.html).toContain('<strong>');
    expect(result.html).toContain('<em>');
  });

  it('renders fenced code blocks', async () => {
    const result = await renderPreview('```ts\nconst x = 1;\n```', new Set());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // unified renders fenced blocks as <pre><code class="language-ts">...</code></pre>
    expect(result.html).toContain('<pre>');
    expect(result.html).toContain('<code');
    expect(result.html).toContain('const x = 1;');
  });

  it('renders inline code', async () => {
    const result = await renderPreview('Use `npm run test:run` to run tests.', new Set());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.html).toContain('<code>');
    expect(result.html).toContain('npm run test:run');
  });

  it('renders blockquotes', async () => {
    const result = await renderPreview('> A wise observation.', new Set());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.html).toContain('<blockquote>');
    expect(result.html).toContain('A wise observation.');
  });

  it('renders GFM tables', async () => {
    const md = '| A | B |\n|---|---|\n| 1 | 2 |';
    const result = await renderPreview(md, new Set());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.html).toContain('<table>');
    expect(result.html).toContain('<th>');
    expect(result.html).toContain('<td>');
  });

  it('renders an empty body to empty or minimal HTML without error', async () => {
    const result = await renderPreview('', new Set());
    expect(result.ok).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Fail-soft behavior contract
// ---------------------------------------------------------------------------

describe('renderPreview — fail-soft contract', () => {
  it('never throws — returns ok:false on pipeline error', async () => {
    // Force a failure by mocking renderWikiLinks to throw.
    const wikiLinks = await import('./wiki-links.js');
    const spy = vi.spyOn(wikiLinks, 'renderWikiLinks').mockImplementation(() => {
      throw new Error('Forced transform failure');
    });

    const result = await renderPreview('Some body', new Set());

    expect(result).toBeDefined();
    expect(result!.ok).toBe(false);
    if (!result!.ok) {
      expect(result!.errorMessage).toMatch(/Forced transform failure/);
      expect(result!.html).toContain('preview-error');
    }

    spy.mockRestore();
  });

  it('always returns an html string even on failure', async () => {
    const wikiLinks = await import('./wiki-links.js');
    const spy = vi.spyOn(wikiLinks, 'renderWikiLinks').mockImplementation(() => {
      throw new Error('Bad transform');
    });

    const result = await renderPreview('anything', new Set());
    expect(typeof result.html).toBe('string');
    expect(result.html.length).toBeGreaterThan(0);

    spy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// renderPreviewSync
// ---------------------------------------------------------------------------

describe('renderPreviewSync — synchronous variant', () => {
  it('returns ok:true with HTML for valid markdown', () => {
    const result = renderPreviewSync('# Hello\n\nWorld.', new Set());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.html).toContain('<h1>');
    expect(result.html).toContain('World.');
  });

  it('resolves wiki-links synchronously', () => {
    const result = renderPreviewSync('[[known-note]]', new Set(['known-note']));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.html).toContain('href="/notes/known-note"');
  });

  it('returns ok:false on error without throwing', async () => {
    const wikiLinks = await import('./wiki-links.js');
    const spy = vi.spyOn(wikiLinks, 'renderWikiLinks').mockImplementation(() => {
      throw new Error('sync failure');
    });

    let result: ReturnType<typeof renderPreviewSync> | undefined;
    expect(() => {
      result = renderPreviewSync('body', new Set());
    }).not.toThrow();

    expect(result!.ok).toBe(false);
    if (!result!.ok) {
      expect(result!.errorMessage).toMatch(/sync failure/);
    }

    spy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// afterEach cleanup
// ---------------------------------------------------------------------------
afterEach(() => {
  vi.restoreAllMocks();
});
