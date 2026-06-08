import { beforeEach, describe, expect, it, vi } from 'vitest';

const envMock = vi.hoisted(() => ({
  OPENROUTER_API_KEY: 'test-key',
  OPENROUTER_BASE_URL: 'https://openrouter.test/api/v1/',
  OPENROUTER_DRAFT_REVIEW_MODEL: '',
}));

vi.mock('$env/dynamic/private', () => ({
  env: envMock,
}));

import { reviewDraft } from './draft-review';

const REVIEW_INPUT = {
  title: 'Shipping the janky thing',
  takeaway: 'The save path matters more than the UI surface.',
  body: 'I used to think the script was the shortcut.\nThen I realized the pipeline was the product.',
};

describe('reviewDraft', () => {
  beforeEach(() => {
    envMock.OPENROUTER_API_KEY = 'test-key';
    envMock.OPENROUTER_BASE_URL = 'https://openrouter.test/api/v1/';
    envMock.OPENROUTER_DRAFT_REVIEW_MODEL = '';
    vi.unstubAllGlobals();
  });

  it('loads the voice rubric into the prompt and returns a well-formed score', async () => {
    const fetchMock = mockDraftReviewFetch(makeModelContent());

    const result = await reviewDraft(REVIEW_INPUT);

    expect(result).toEqual({
      status: 'scored',
      overallScore: 87,
      dimensions: {
        voiceFit: { score: 90, notes: 'Sounds like a working developer with a clear take.' },
        aiTellCleanliness: { score: 84, notes: 'One line risks a tidy AI cadence.' },
        structure: { score: 88, notes: 'The hook moves quickly into the point.' },
        groundingHygiene: { score: 86, notes: 'Claims stay tied to the draft context.' },
      },
      flaggedLines: [
        {
          line: 2,
          text: 'Then I realized the pipeline was the product.',
          dimension: 'aiTellCleanliness',
          reason: 'A little too aphoristic.',
          severity: 'low',
        },
      ],
      model: 'openrouter/free',
      failureReason: null,
    });

    const requestBody = readRequestBody(fetchMock);
    const userMessage = requestBody.messages?.find((message) => message.role === 'user')?.content ?? '';
    expect(userMessage).toContain('Rubric from docs/VOICE.md:');
    expect(userMessage).toContain('This is the **single source of truth for the blog writing voice**');
    expect(userMessage).toContain('Body with line numbers:');
    expect(userMessage).toContain('2: Then I realized the pipeline was the product.');
  });

  it('uses OPENROUTER_DRAFT_REVIEW_MODEL when configured', async () => {
    envMock.OPENROUTER_DRAFT_REVIEW_MODEL = 'meta-llama/llama-3.2-3b-instruct:free';
    const fetchMock = mockDraftReviewFetch(makeModelContent());

    await reviewDraft(REVIEW_INPUT);

    const requestBody = readRequestBody(fetchMock);
    expect(requestBody.model).toBe('meta-llama/llama-3.2-3b-instruct:free');
    expect(requestBody.stream).toBe(false);
  });

  it('handles malformed model output with a non-throwing failure result', async () => {
    mockDraftReviewFetch('This is not JSON.');

    await expect(reviewDraft(REVIEW_INPUT)).resolves.toEqual({
      status: 'failed',
      overallScore: 0,
      dimensions: {
        voiceFit: expect.objectContaining({ score: 0 }),
        aiTellCleanliness: expect.objectContaining({ score: 0 }),
        structure: expect.objectContaining({ score: 0 }),
        groundingHygiene: expect.objectContaining({ score: 0 }),
      },
      flaggedLines: [],
      model: 'openrouter/free',
      failureReason: 'OpenRouter draft review output was not valid JSON.',
    });
  });

  it('handles non-conforming JSON with a marked failure result', async () => {
    mockDraftReviewFetch(JSON.stringify({ score: 91 }));

    const result = await reviewDraft(REVIEW_INPUT);

    expect(result.status).toBe('failed');
    expect(result.failureReason).toBe('OpenRouter draft review output did not match the score schema.');
    expect(result.flaggedLines).toEqual([]);
  });
});

function mockDraftReviewFetch(content: string) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    void input;
    void init;
    return new Response(
      JSON.stringify({
        choices: [{ message: { content } }],
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function makeModelContent() {
  return JSON.stringify({
    overallScore: 87,
    dimensions: {
      voiceFit: { score: 90, notes: 'Sounds like a working developer with a clear take.' },
      aiTellCleanliness: { score: 84, notes: 'One line risks a tidy AI cadence.' },
      structure: { score: 88, notes: 'The hook moves quickly into the point.' },
      groundingHygiene: { score: 86, notes: 'Claims stay tied to the draft context.' },
    },
    flaggedLines: [
      {
        line: 2,
        text: 'Then I realized the pipeline was the product.',
        dimension: 'aiTellCleanliness',
        reason: 'A little too aphoristic.',
        severity: 'low',
      },
    ],
  });
}

function readRequestBody(fetchMock: ReturnType<typeof mockDraftReviewFetch>) {
  const firstCall = fetchMock.mock.calls[0];
  return JSON.parse(String(firstCall?.[1]?.body)) as {
    model?: unknown;
    stream?: unknown;
    messages?: Array<{ role?: string; content?: string }>;
  };
}
