import { describe, expect, it } from 'vitest';
import { renderMarkdown } from './markdown';

describe('renderMarkdown', () => {
  it('renders Mermaid fences as code blocks without failing Shiki highlighting', async () => {
    await expect(
      renderMarkdown([
        '```mermaid',
        'flowchart TD',
        '  A[AGENTS.md] --> B[docs/INDEX.md]',
        '```',
      ].join('\n')),
    ).resolves.toContain('flowchart TD');
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
});
