import { describe, expect, it } from 'vitest';
import { SYSTEM_PROMPT } from './personality';

describe('SYSTEM_PROMPT', () => {
  it('is a non-empty string', () => {
    expect(typeof SYSTEM_PROMPT).toBe('string');
    expect(SYSTEM_PROMPT.length).toBeGreaterThan(0);
  });

  it('instructs the LLM to answer only from retrieved note context', () => {
    expect(SYSTEM_PROMPT).toMatch(/retrieved note/i);
  });

  it('includes a guardrail for off-topic questions', () => {
    expect(SYSTEM_PROMPT).toMatch(/I don't have a note on that/i);
  });

  it('instructs the LLM to cite note slugs', () => {
    expect(SYSTEM_PROMPT).toMatch(/slug/i);
  });
});
