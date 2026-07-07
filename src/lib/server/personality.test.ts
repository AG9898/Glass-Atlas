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

  it('keeps a relaxed first-person author voice without weakening grounding', () => {
    expect(SYSTEM_PROMPT).toMatch(/relaxed, friendly/i);
    expect(SYSTEM_PROMPT).toMatch(/little dry playfulness/i);
    expect(SYSTEM_PROMPT).toMatch(/only factual source of truth/i);
  });

  it('includes limited-coverage behavior for borderline retrieval', () => {
    expect(SYSTEM_PROMPT).toMatch(/limited-coverage instruction/i);
    expect(SYSTEM_PROMPT).toMatch(/adjacent or partial/i);
  });

  it('asks for conversational synthesis and permits fuller grounded answers', () => {
    expect(SYSTEM_PROMPT).toMatch(/Synthesize in your own words/i);
    expect(SYSTEM_PROMPT).toMatch(/fuller, more talkative answer/i);
    expect(SYSTEM_PROMPT).toMatch(/evidence is rich enough/i);
  });

  it('guards against copying raw excerpts unless the user asks for a quote', () => {
    expect(SYSTEM_PROMPT).toMatch(/evidence to paraphrase/i);
    expect(SYSTEM_PROMPT).toMatch(/Do not quote or closely mirror/i);
    expect(SYSTEM_PROMPT).toMatch(/explicitly asks for a quote/i);
  });
});
