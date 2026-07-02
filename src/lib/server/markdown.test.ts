import { describe, expect, it } from 'vitest';
import { renderMarkdown } from './markdown';

describe('renderMarkdown', () => {
  it('renders valid Mermaid fences as inline SVG diagrams', async () => {
    const html = await renderMarkdown(
      ['```mermaid', 'flowchart TD', '  A[AGENTS.md] --> B[docs/INDEX.md]', '```'].join('\n'),
    );

    expect(html).toContain('mermaid-diagram');
    expect(html).toContain('<svg');
    expect(html).not.toContain('unhighlighted-code-source');
  });

  it('renders invalid Mermaid fences as a readable fallback instead of throwing', async () => {
    const html = await renderMarkdown(
      ['```mermaid', 'flowchart TD', '  A[Start --> B[[End', '```'].join('\n'),
    );

    expect(html).toContain('unhighlighted-code-source');
    expect(html).toContain('data-language="mermaid"');
    expect(html).toContain('Start --> B[[End');
    expect(html).not.toContain('<svg');
  });

  it('renders empty Mermaid fences as a readable fallback instead of throwing', async () => {
    const html = await renderMarkdown(['```mermaid', '```'].join('\n'));

    expect(html).toContain('unhighlighted-code-source');
    expect(html).toContain('data-language="mermaid"');
    expect(html).not.toContain('<svg');
  });

  it('renders plain-text fences as code blocks without failing Shiki highlighting', async () => {
    await expect(
      renderMarkdown(['```text', 'AGENTS.md / CLAUDE.md', '└── docs/DECISIONS.md', '```'].join('\n')),
    ).resolves.toContain('AGENTS.md / CLAUDE.md');
  });

  it('does not emit invalid undefined inline styles for unhighlighted fences', async () => {
    const html = await renderMarkdown(['```text', 'plain text', '```'].join('\n'));
    expect(html).not.toContain('undefined');
  });

  it('gives un-highlighted blocks a readable light foreground on the dark code background', async () => {
    // Plain ``` fences and fallback fences produce no token spans, so without a
    // default foreground their text inherits the page body color and renders
    // dark-on-dark over the Shiki background.
    for (const md of [
      '```\nln -sf AGENTS.md CLAUDE.md\n```',
      '```text\nplain text block\n```',
    ]) {
      const html = await renderMarkdown(md);
      expect(html).toMatch(/<pre style="background: #1E1E1E; color: #D4D4D4">/);
    }
  });

  it('rewrites the theme default-token black to a readable foreground', async () => {
    // The legacy dark_plus theme emits its default token color as #000000,
    // which is unreadable on the dark code background.
    const html = await renderMarkdown('```bash\nln -sf AGENTS.md CLAUDE.md\n```');
    expect(html).not.toContain('#000000');
    expect(html).toContain('#D4D4D4');
  });

  describe('code block controls', () => {
    it('wraps a highlighted fence in a blueprint code-block panel with a language label', async () => {
      const html = await renderMarkdown('```ts\nconst x = 1;\n```');

      expect(html).toContain('class="ga-code-block"');
      expect(html).toContain('class="ga-code-block__header"');
      expect(html).toContain('<span class="ga-code-block__lang">TS</span>');
      expect(html).toContain('class="ga-code-block__body"');
      expect(html).toContain('data-role="copy"');
      expect(html).toContain('data-role="wrap-toggle"');
      expect(html).not.toContain('ga-code-block__filename');
    });

    it('omits the language label when no language is known', async () => {
      const html = await renderMarkdown('```\nplain fenced text\n```');

      expect(html).toContain('class="ga-code-block"');
      expect(html).not.toContain('ga-code-block__lang');
    });

    it('renders a filename label when the fence meta includes filename="..."', async () => {
      const html = await renderMarkdown('```ts filename="app.ts"\nconst x = 1;\n```');

      expect(html).toContain('<span class="ga-code-block__lang">TS</span>');
      expect(html).toContain('<span class="ga-code-block__filename">app.ts</span>');
      // The raw code text is unaffected by the metadata — no meta string leaks into it.
      expect(html).toContain('const');
      expect(html).not.toContain('filename=&quot;app.ts&quot;');
    });

    it('gives plaintext-fallback and failed-Mermaid-fallback blocks controls too', async () => {
      const plaintext = await renderMarkdown('```text\nplain text block\n```');
      expect(plaintext).toContain('class="ga-code-block"');
      expect(plaintext).toContain('<span class="ga-code-block__lang">TEXT</span>');
      expect(plaintext).toContain('data-role="copy"');

      const badMermaid = await renderMarkdown(
        ['```mermaid', 'flowchart TD', '  A[Start --> B[[End', '```'].join('\n'),
      );
      expect(badMermaid).toContain('class="ga-code-block"');
      expect(badMermaid).toContain('<span class="ga-code-block__lang">MERMAID</span>');
      expect(badMermaid).toContain('data-role="copy"');
    });

    it('does not wrap a successfully rendered Mermaid diagram in code-block controls', async () => {
      const html = await renderMarkdown(
        ['```mermaid', 'flowchart TD', '  A[AGENTS.md] --> B[docs/INDEX.md]', '```'].join('\n'),
      );
      expect(html).toContain('mermaid-diagram');
      expect(html).not.toContain('ga-code-block');
    });
  });
});
