import { describe, it, expect } from 'vitest';
import { parseWikiLinks, renderWikiLinks } from './wiki-links';

describe('parseWikiLinks', () => {
  it('parses a simple wiki link', () => {
    const links = parseWikiLinks('See [[ci-cd]] for more.');
    expect(links).toHaveLength(1);
    expect(links[0]).toEqual({ slug: 'ci-cd', text: 'ci-cd', raw: '[[ci-cd]]' });
  });

  it('parses a wiki link with display text', () => {
    const links = parseWikiLinks('See [[ci-cd|CI/CD pipelines]].');
    expect(links).toHaveLength(1);
    expect(links[0]).toEqual({ slug: 'ci-cd', text: 'CI/CD pipelines', raw: '[[ci-cd|CI/CD pipelines]]' });
  });

  it('returns empty array for no links', () => {
    expect(parseWikiLinks('No links here.')).toHaveLength(0);
  });

  it('parses multiple links in one body', () => {
    const links = parseWikiLinks('See [[alpha]] and [[beta|Beta Name]].');
    expect(links).toHaveLength(2);
    expect(links[0].slug).toBe('alpha');
    expect(links[1].slug).toBe('beta');
    expect(links[1].text).toBe('Beta Name');
  });

  it('trims whitespace inside brackets', () => {
    const links = parseWikiLinks('[[ my-note ]]');
    expect(links[0].slug).toBe('my-note');
  });
});

describe('renderWikiLinks', () => {
  it('renders resolved links as markdown links', () => {
    const result = renderWikiLinks('See [[ci-cd]].', new Set(['ci-cd']));
    expect(result).toBe('See [ci-cd](/notes/ci-cd).');
  });

  it('renders resolved links with display text', () => {
    const result = renderWikiLinks('See [[ci-cd|CI/CD]].', new Set(['ci-cd']));
    expect(result).toBe('See [CI/CD](/notes/ci-cd).');
  });

  it('renders unresolved links as a styled span', () => {
    const result = renderWikiLinks('See [[missing]].', new Set());
    expect(result).toContain('wiki-link-missing');
    expect(result).toContain('missing');
  });

  it('handles mixed resolved and unresolved links', () => {
    const result = renderWikiLinks('[[exists]] and [[missing]].', new Set(['exists']));
    expect(result).toContain('/notes/exists');
    expect(result).toContain('wiki-link-missing');
  });
});
