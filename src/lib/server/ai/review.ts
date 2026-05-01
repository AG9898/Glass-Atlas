import { env } from '$env/dynamic/private';

const REVIEW_MODEL = 'google/gemini-2.0-flash-exp:free';
const DEFAULT_OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

export type ReviewInput = {
  title: string;
  takeaway: string;
  body: string;
};

/**
 * Builds a compact structured critique prompt from the note fields and calls
 * a free-tier OpenRouter model. Returns the upstream response's body stream
 * for direct SSE forwarding to the client.
 *
 * Never reads from or writes to the database.
 * Propagates upstream 429 and 503 statuses to the caller — never remaps them.
 */
export async function streamNoteReview(input: ReviewInput): Promise<Response> {
  const apiKey = env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY is not configured.');
  }

  const baseUrl = (env.OPENROUTER_BASE_URL || DEFAULT_OPENROUTER_BASE_URL).replace(/\/+$/, '');

  const systemPrompt = `You are a concise editorial critic. Your job is to give the author fast, structured feedback on a knowledge note so they can improve it in one quick pass.

Respond in this exact format (use plain text, no markdown headers):

CLARITY: One sentence assessing how clear the takeaway and main argument are.
STRUCTURE: One sentence on whether the note flows logically.
GAPS: One or two specific gaps, missing context, or under-explained ideas.
SUGGESTIONS: Two or three concrete, actionable rewrite suggestions (be specific).
VERDICT: One sentence summary — keep, revise, or cut.

Be direct. Skip praise. Total response must stay under 200 words.`;

  const userMessage = `Title: ${input.title}

Takeaway: ${input.takeaway}

Body:
${input.body}`;

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: REVIEW_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      stream: true,
    }),
  });

  return response;
}
