import { describe, expect, it } from 'vitest';
import {
  renderChatMessageHtml,
  isSafeNoteSlug,
  buildSourceSnippet,
  parseChatSourcesEvent,
} from './chat-format';

describe('renderChatMessageHtml', () => {
  it('renders single-asterisk italics', () => {
    const html = renderChatMessageHtml('I know this. *Related notes: [[rag-pipeline]]*');
    expect(html).toContain('<em>Related notes: <a href="/notes/rag-pipeline"');
  });

  it('renders wiki-links with custom labels', () => {
    const html = renderChatMessageHtml('See [[rag-pipeline|RAG Pipeline]].');
    expect(html).toContain('<a href="/notes/rag-pipeline" class="ga-chat__note-link">RAG Pipeline</a>');
  });

  it('renders markdown links to local notes', () => {
    const html = renderChatMessageHtml('Read [RAG Pipeline](/notes/rag-pipeline).');
    expect(html).toContain('<a href="/notes/rag-pipeline" class="ga-chat__note-link">RAG Pipeline</a>');
  });

  it('renders markdown links to allowlisted internal pages', () => {
    const html = renderChatMessageHtml('See [How It Works](/how-it-works).');
    expect(html).toContain('<a href="/how-it-works" class="ga-chat__note-link">How It Works</a>');
  });

  it('does not link markdown links to non-allowlisted internal pages', () => {
    const html = renderChatMessageHtml('See [Admin](/admin) and [Elsewhere](https://example.com).');
    expect(html).not.toContain('href="/admin"');
    expect(html).not.toContain('href="https://example.com"');
  });

  it('escapes unsafe HTML', () => {
    const html = renderChatMessageHtml('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).not.toContain('<script>');
  });

  it('keeps invalid wiki slugs as plain text', () => {
    const html = renderChatMessageHtml('[[bad slug]]');
    expect(html).toContain('[[bad slug]]');
    expect(html).not.toContain('href=');
  });

  it('renders italicized related-notes footer with wiki-links correctly', () => {
    const content = `I don't have a note on that.\n\n*Related notes: [[rag-pipeline|RAG Pipeline]], [[vector-search|Vector Search]]*`;
    const html = renderChatMessageHtml(content);
    expect(html).toContain('<em>Related notes:');
    expect(html).toContain('<a href="/notes/rag-pipeline" class="ga-chat__note-link">RAG Pipeline</a>');
    expect(html).toContain('<a href="/notes/vector-search" class="ga-chat__note-link">Vector Search</a>');
  });
});

describe('isSafeNoteSlug', () => {
  it('accepts lowercase slug with hyphens', () => {
    expect(isSafeNoteSlug('rag-pipeline')).toBe(true);
  });

  it('accepts slug starting with a digit', () => {
    expect(isSafeNoteSlug('2024-recap')).toBe(true);
  });

  it('accepts single-word lowercase slug', () => {
    expect(isSafeNoteSlug('embeddings')).toBe(true);
  });

  it('rejects slug with uppercase letters', () => {
    expect(isSafeNoteSlug('RAG-Pipeline')).toBe(false);
  });

  it('rejects slug with spaces', () => {
    expect(isSafeNoteSlug('rag pipeline')).toBe(false);
  });

  it('rejects slug with special characters', () => {
    expect(isSafeNoteSlug('bad_slug!')).toBe(false);
  });

  it('rejects empty string', () => {
    expect(isSafeNoteSlug('')).toBe(false);
  });

  it('rejects slug starting with a hyphen', () => {
    expect(isSafeNoteSlug('-bad-start')).toBe(false);
  });
});

describe('buildSourceSnippet', () => {
  it('returns short text unchanged', () => {
    expect(buildSourceSnippet('A short excerpt.')).toBe('A short excerpt.');
  });

  it('collapses internal whitespace and newlines into single spaces', () => {
    expect(buildSourceSnippet('Line one.\n\nLine   two.')).toBe('Line one. Line two.');
  });

  it('trims leading and trailing whitespace', () => {
    expect(buildSourceSnippet('   padded text   ')).toBe('padded text');
  });

  it('returns an empty string for whitespace-only input', () => {
    expect(buildSourceSnippet('   \n\t  ')).toBe('');
  });

  it('truncates text longer than maxLength and appends an ellipsis', () => {
    const longText = 'a'.repeat(250);
    const result = buildSourceSnippet(longText);

    expect(result.length).toBeLessThanOrEqual(201);
    expect(result.endsWith('…')).toBe(true);
  });

  it('does not truncate text at or under a custom maxLength', () => {
    const result = buildSourceSnippet('exactly ten', 11);
    expect(result).toBe('exactly ten');
  });

  it('truncates using a custom maxLength', () => {
    const result = buildSourceSnippet('this text is too long for a tiny snippet', 10);
    expect(result).toBe('this text…');
  });

  it('HTML-escapes unsafe characters after truncation', () => {
    const result = buildSourceSnippet('<script>alert(1)</script>');
    expect(result).toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(result).not.toContain('<script>');
  });

  it('escapes ampersands and quotes', () => {
    expect(buildSourceSnippet(`Tom & Jerry's "great" escape`)).toBe(
      'Tom &amp; Jerry&#39;s &quot;great&quot; escape',
    );
  });
});

describe('parseChatSourcesEvent', () => {
  it('returns the sources array for a valid sources event', () => {
    const result = parseChatSourcesEvent({
      sources: [{ slug: 'rag-pipeline', title: 'RAG Pipeline', snippet: 'A short excerpt.' }],
    });

    expect(result).toEqual([
      { slug: 'rag-pipeline', title: 'RAG Pipeline', snippet: 'A short excerpt.' },
    ]);
  });

  it('returns an empty array for a sources event with no entries', () => {
    expect(parseChatSourcesEvent({ sources: [] })).toEqual([]);
  });

  it('returns null for a normal OpenAI-shaped token chunk', () => {
    const payload = { choices: [{ delta: { content: 'hello' }, index: 0, finish_reason: null }] };
    expect(parseChatSourcesEvent(payload)).toBeNull();
  });

  it('returns null for non-object payloads', () => {
    expect(parseChatSourcesEvent('plain string')).toBeNull();
    expect(parseChatSourcesEvent(null)).toBeNull();
    expect(parseChatSourcesEvent(42)).toBeNull();
  });

  it('returns null when sources is present but not an array', () => {
    expect(parseChatSourcesEvent({ sources: 'not-an-array' })).toBeNull();
  });

  it('drops entries with an unsafe slug', () => {
    const result = parseChatSourcesEvent({
      sources: [
        { slug: 'Bad Slug', title: 'Bad', snippet: 'excerpt' },
        { slug: 'good-slug', title: 'Good', snippet: 'excerpt' },
      ],
    });

    expect(result).toEqual([{ slug: 'good-slug', title: 'Good', snippet: 'excerpt' }]);
  });

  it('drops entries with a missing or empty title', () => {
    const result = parseChatSourcesEvent({
      sources: [
        { slug: 'good-slug', title: '', snippet: 'excerpt' },
        { slug: 'other-slug', snippet: 'excerpt' },
      ],
    });

    expect(result).toEqual([]);
  });

  it('drops entries with a missing or empty snippet', () => {
    const result = parseChatSourcesEvent({
      sources: [
        { slug: 'good-slug', title: 'Good', snippet: '' },
        { slug: 'other-slug', title: 'Other' },
      ],
    });

    expect(result).toEqual([]);
  });

  it('drops non-object entries within the sources array', () => {
    const result = parseChatSourcesEvent({ sources: [null, 'string-entry', 42] });
    expect(result).toEqual([]);
  });
});

