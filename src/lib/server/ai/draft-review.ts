import { readFile } from 'node:fs/promises';

import { env } from '$env/dynamic/private';

const DEFAULT_DRAFT_REVIEW_MODEL = 'openrouter/free';
const DEFAULT_OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';
const VOICE_GUIDE_URL = new URL('../../../../docs/VOICE.md', import.meta.url);

const DIMENSION_KEYS = ['voiceFit', 'aiTellCleanliness', 'structure', 'groundingHygiene'] as const;
const SEVERITIES = ['low', 'medium', 'high'] as const;

export type DraftReviewInput = {
  title: string;
  takeaway: string | null;
  body: string;
};

export type DraftReviewDimensionKey = (typeof DIMENSION_KEYS)[number];

export type DraftReviewDimension = {
  score: number;
  notes: string;
};

export type DraftReviewFlaggedLine = {
  line: number | null;
  text: string;
  dimension: DraftReviewDimensionKey;
  reason: string;
  severity: (typeof SEVERITIES)[number];
};

export type DraftReviewScore = {
  status: 'scored' | 'failed';
  overallScore: number;
  dimensions: Record<DraftReviewDimensionKey, DraftReviewDimension>;
  flaggedLines: DraftReviewFlaggedLine[];
  model: string;
  failureReason: string | null;
};

export type DraftReviewMessages = {
  system: string;
  user: string;
};

export async function reviewDraft(input: DraftReviewInput): Promise<DraftReviewScore> {
  const model = getDraftReviewModel();

  try {
    const apiKey = env.OPENROUTER_API_KEY;
    if (!apiKey) return makeFailureScore(model, 'OPENROUTER_API_KEY is not configured.');

    const rubric = await loadVoiceRubric();
    const messages = buildDraftReviewMessages(input, rubric);
    const baseUrl = (env.OPENROUTER_BASE_URL || DEFAULT_OPENROUTER_BASE_URL).replace(/\/+$/, '');

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: messages.system },
          { role: 'user', content: messages.user },
        ],
        response_format: { type: 'json_object' },
        stream: false,
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      return makeFailureScore(model, `OpenRouter draft review failed with ${response.status}: ${detail}`);
    }

    const payload = (await response.json().catch(() => null)) as unknown;
    const content = extractMessageContent(payload);
    if (!content) return makeFailureScore(model, 'OpenRouter draft review response did not include message content.');

    const parsed = parseJsonObject(content);
    if (!parsed) return makeFailureScore(model, 'OpenRouter draft review output was not valid JSON.');

    const normalized = normalizeDraftReviewScore(parsed, model);
    if (!normalized) return makeFailureScore(model, 'OpenRouter draft review output did not match the score schema.');

    return normalized;
  } catch (error) {
    return makeFailureScore(model, toErrorMessage(error));
  }
}

export async function loadVoiceRubric(): Promise<string> {
  return readFile(VOICE_GUIDE_URL, 'utf8');
}

export function buildDraftReviewMessages(input: DraftReviewInput, rubric: string): DraftReviewMessages {
  const bodyWithLineNumbers = input.body
    .split(/\r?\n/)
    .map((line, index) => `${index + 1}: ${line}`)
    .join('\n');

  return {
    system: [
      'You are the Glass Atlas draft-review scorer.',
      'Score a draft against the provided rubric and return JSON only.',
      'This score is advisory and non-blocking; do not write prose outside the JSON object.',
      'Penalize AI tells hard, especially em-dash overuse, "not just X, it is Y" templates, and filler/hedging.',
      'Do not invent facts. Grounding hygiene means the draft avoids unverified specifics and surfaces outside-knowledge risk.',
    ].join(' '),
    user: `Return exactly this JSON shape:
{
  "overallScore": 0,
  "dimensions": {
    "voiceFit": { "score": 0, "notes": "one concise sentence" },
    "aiTellCleanliness": { "score": 0, "notes": "one concise sentence" },
    "structure": { "score": 0, "notes": "one concise sentence" },
    "groundingHygiene": { "score": 0, "notes": "one concise sentence" }
  },
  "flaggedLines": [
    {
      "line": 1,
      "text": "exact draft line or short excerpt",
      "dimension": "aiTellCleanliness",
      "reason": "specific issue",
      "severity": "medium"
    }
  ]
}

Scores must be integers from 0 to 100. Include flaggedLines only for concrete lines or excerpts that need review.

Rubric from docs/VOICE.md:
${rubric}

Draft:
Title: ${input.title}
Takeaway: ${input.takeaway ?? ''}
Body with line numbers:
${bodyWithLineNumbers}`,
  };
}

export function normalizeDraftReviewScore(value: unknown, model: string): DraftReviewScore | null {
  if (!isRecord(value)) return null;

  const overallScore = scoreFromUnknown(value.overallScore);
  if (overallScore === null) return null;

  const rawDimensions = value.dimensions;
  if (!isRecord(rawDimensions)) return null;

  const dimensions = Object.fromEntries(
    DIMENSION_KEYS.map((key) => {
      const dimension = normalizeDimension(rawDimensions[key]);
      return [key, dimension];
    }),
  );

  if (!DIMENSION_KEYS.every((key) => dimensions[key] !== null)) return null;

  const flaggedLines = normalizeFlaggedLines(value.flaggedLines);
  if (!flaggedLines) return null;

  return {
    status: 'scored',
    overallScore,
    dimensions: dimensions as Record<DraftReviewDimensionKey, DraftReviewDimension>,
    flaggedLines,
    model,
    failureReason: null,
  };
}

export function makeFailureScore(model = getDraftReviewModel(), reason = 'Draft review failed.'): DraftReviewScore {
  const notes = `Draft review did not produce a usable score: ${reason}`;
  return {
    status: 'failed',
    overallScore: 0,
    dimensions: {
      voiceFit: { score: 0, notes },
      aiTellCleanliness: { score: 0, notes },
      structure: { score: 0, notes },
      groundingHygiene: { score: 0, notes },
    },
    flaggedLines: [],
    model,
    failureReason: reason,
  };
}

function getDraftReviewModel(): string {
  return env.OPENROUTER_DRAFT_REVIEW_MODEL || DEFAULT_DRAFT_REVIEW_MODEL;
}

function normalizeDimension(value: unknown): DraftReviewDimension | null {
  if (!isRecord(value)) return null;

  const score = scoreFromUnknown(value.score);
  if (score === null) return null;

  const notes = typeof value.notes === 'string' ? value.notes.trim() : '';
  return {
    score,
    notes: notes || 'No dimension notes returned.',
  };
}

function normalizeFlaggedLines(value: unknown): DraftReviewFlaggedLine[] | null {
  if (value === undefined) return [];
  if (!Array.isArray(value)) return null;

  const flaggedLines: DraftReviewFlaggedLine[] = [];
  for (const item of value) {
    if (!isRecord(item)) return null;

    const dimension = parseDimensionKey(item.dimension);
    const severity = parseSeverity(item.severity);
    if (!dimension || !severity) return null;

    const line = item.line === null || item.line === undefined ? null : scoreLineNumber(item.line);
    if (line === undefined) return null;

    flaggedLines.push({
      line,
      text: typeof item.text === 'string' ? item.text.trim() : '',
      dimension,
      reason: typeof item.reason === 'string' ? item.reason.trim() : '',
      severity,
    });
  }

  return flaggedLines;
}

function extractMessageContent(payload: unknown): string | null {
  if (!isRecord(payload) || !Array.isArray(payload.choices)) return null;
  const firstChoice = payload.choices[0];
  if (!isRecord(firstChoice) || !isRecord(firstChoice.message)) return null;
  const { content } = firstChoice.message;
  return typeof content === 'string' && content.trim() !== '' ? content : null;
}

function parseJsonObject(content: string): unknown | null {
  try {
    return JSON.parse(content);
  } catch {
    const start = content.indexOf('{');
    const end = content.lastIndexOf('}');
    if (start === -1 || end <= start) return null;

    try {
      return JSON.parse(content.slice(start, end + 1));
    } catch {
      return null;
    }
  }
}

function scoreFromUnknown(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function scoreLineNumber(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) return undefined;
  return value;
}

function parseDimensionKey(value: unknown): DraftReviewDimensionKey | null {
  if (typeof value !== 'string') return null;
  return DIMENSION_KEYS.includes(value as DraftReviewDimensionKey) ? (value as DraftReviewDimensionKey) : null;
}

function parseSeverity(value: unknown): DraftReviewFlaggedLine['severity'] | null {
  if (typeof value !== 'string') return null;
  return SEVERITIES.includes(value as DraftReviewFlaggedLine['severity'])
    ? (value as DraftReviewFlaggedLine['severity'])
    : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim() !== '') return error.message;
  if (typeof error === 'string' && error.trim() !== '') return error;
  return 'Unknown draft review error.';
}
