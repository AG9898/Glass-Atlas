import { describe, expect, it } from 'vitest';
import { renderChatMessageHtml, isSafeNoteSlug } from './chat-format';

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

