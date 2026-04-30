import { describe, expect, it } from 'vitest';
import { renderChatMessageHtml } from './chat-format';

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
});

