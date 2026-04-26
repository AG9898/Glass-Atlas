import { describe, it, expect } from 'vitest';
import { slugify } from './slugify';

describe('slugify', () => {
  it('lowercases and replaces spaces with hyphens', () => {
    expect(slugify('Hello World')).toBe('hello-world');
  });
  it('strips special characters', () => {
    expect(slugify('CI/CD Pipeline!')).toBe('cicd-pipeline');
  });
  it('collapses multiple hyphens', () => {
    expect(slugify('foo  bar---baz')).toBe('foo-bar-baz');
  });
  it('trims leading and trailing hyphens', () => {
    expect(slugify('  -hello-  ')).toBe('hello');
  });
  it('handles empty string', () => {
    expect(slugify('')).toBe('');
  });
});
