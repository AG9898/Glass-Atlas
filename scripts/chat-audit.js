#!/usr/bin/env node
/**
 * Live chat quality audit sweep (CHAT-07E).
 *
 * Runs representative direct, adjacent, and unrelated questions through:
 *  1. Retrieval diagnostics (in-process via Vite SSR): semantic query
 *     expansion, top chunk cosine distances, lexical matches, confidence
 *     tier, cited slugs, and source metadata.
 *  2. The live `POST /api/chat` endpoint (requires a running dev server):
 *     visible streamed answer, trailing `sources` SSE event, and fallback
 *     detection.
 *  3. Quote-copy diagnostics: longest contiguous shared word run between the
 *     visible answer and the retrieved chunk excerpts.
 *  4. Model availability probes: direct OpenRouter calls for the configured
 *     primary and fallback models, recording HTTP status, visible content,
 *     and in-band SSE error events (which can arrive with HTTP 200).
 *
 * Usage:
 *   node scripts/chat-audit.js [--base-url http://localhost:5173]
 *                              [--skip-live] [--skip-model-probe]
 *
 * The report JSON is written to stdout. This script only reads notes data;
 * its live requests do consume anonymous chat-session quota rows and note
 * citation counters, same as a real visitor.
 */
import process from 'node:process';
import { createServer } from 'vite';
import { loadLocalEnv, validateRequiredEnv } from './create-note.js';

const DEFAULT_BASE_URL = 'http://localhost:5173';
const TOP_CHUNKS_IN_REPORT = 5;
const CHUNK_PREVIEW_CHARS = 120;
const ANSWER_SAMPLE_CHARS = 1200;
const MODEL_PROBE_TIMEOUT_MS = 30_000;
const LIVE_REQUEST_TIMEOUT_MS = 60_000;
/** Shared word runs at/above this length count as excerpt copying. */
const QUOTE_COPY_FLAG_RUN_WORDS = 12;

/**
 * Representative audit sweep. `kind` drives the per-question expectations:
 * direct/adjacent questions should produce a citable answer with sources;
 * unrelated questions should hit the low-confidence fallback with no sources.
 */
const AUDIT_QUESTIONS = [
  { kind: 'direct', question: 'What do you think about infinite context windows for LLMs?' },
  { kind: 'direct', question: 'Why does documentation matter for AI agents?' },
  { kind: 'direct', question: 'What is "The Loop Is the Skill" about?' },
  { kind: 'direct', question: 'Are you building a persistent agent for yourself?' },
  { kind: 'direct', question: 'What inspired you to start this site?' },
  { kind: 'adjacent', question: 'How should I think about agent memory across sessions?' },
  { kind: 'adjacent', question: 'Do you have tips for working with coding agents effectively?' },
  { kind: 'unrelated', question: 'What is the best pasta recipe for a weeknight dinner?' },
  { kind: 'unrelated', question: 'Who won the 2022 World Cup?' },
  { kind: 'unrelated', question: 'How do I unclog a kitchen sink?' },
];

/**
 * @param {string[]} argv
 * @returns {{ baseUrl: string; skipLive: boolean; skipModelProbe: boolean; help: boolean }}
 */
export function parseArgs(argv) {
  const parsed = { baseUrl: DEFAULT_BASE_URL, skipLive: false, skipModelProbe: false, help: false };
  const args = [...argv];

  while (args.length > 0) {
    const arg = args.shift();
    if (arg === '--help' || arg === '-h') {
      parsed.help = true;
      continue;
    }
    if (arg === '--skip-live') {
      parsed.skipLive = true;
      continue;
    }
    if (arg === '--skip-model-probe') {
      parsed.skipModelProbe = true;
      continue;
    }
    if (arg === '--base-url') {
      const value = args.shift();
      if (!value) throw new Error('Missing value after --base-url.');
      parsed.baseUrl = value.replace(/\/+$/, '');
      continue;
    }
    if (arg?.startsWith('--base-url=')) {
      parsed.baseUrl = arg.slice('--base-url='.length).replace(/\/+$/, '');
      if (!parsed.baseUrl) throw new Error('Missing value after --base-url=.');
      continue;
    }
    if (arg) throw new Error(`Unknown argument: ${arg}`);
  }

  return parsed;
}

/**
 * Tokenizes text into lowercase word tokens for overlap comparison.
 * @param {string} text
 * @returns {string[]}
 */
function tokenizeWords(text) {
  return (text.toLowerCase().match(/[a-z0-9']+/g) ?? []).filter((word) => word.length > 0);
}

/**
 * Length (in words) of the longest contiguous word run shared between two
 * texts. Used as the quote-copy diagnostic: long shared runs mean the answer
 * copied retrieved excerpt wording rather than paraphrasing it.
 *
 * @param {string} answer
 * @param {string} excerpt
 * @returns {number}
 */
export function longestSharedWordRun(answer, excerpt) {
  const a = tokenizeWords(answer);
  const b = tokenizeWords(excerpt);
  if (a.length === 0 || b.length === 0) return 0;

  let best = 0;
  let previousRow = new Array(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i += 1) {
    const row = new Array(b.length + 1).fill(0);
    for (let j = 1; j <= b.length; j += 1) {
      if (a[i - 1] === b[j - 1]) {
        row[j] = previousRow[j - 1] + 1;
        if (row[j] > best) best = row[j];
      }
    }
    previousRow = row;
  }
  return best;
}

/**
 * Parses raw SSE text into visible answer content and the trailing sources
 * event, mirroring the client's `extractToken`/`parseChatSourcesEvent` rules.
 *
 * @param {string} sseText
 * @returns {{ answer: string; sources: Array<{ slug: string; title: string; snippet: string }> | null }}
 */
export function parseChatSse(sseText) {
  let answer = '';
  /** @type {Array<{ slug: string; title: string; snippet: string }> | null} */
  let sources = null;

  for (const rawLine of sseText.split('\n')) {
    const line = rawLine.replace(/\r$/, '');
    if (!line.startsWith('data:')) continue;
    const data = line.slice(5).trimStart();
    if (!data || data === '[DONE]') continue;

    let payload;
    try {
      payload = JSON.parse(data);
    } catch {
      continue;
    }
    if (typeof payload !== 'object' || payload === null) continue;

    if (Array.isArray(payload.sources)) {
      sources = payload.sources;
      continue;
    }

    const content = payload.choices?.[0]?.delta?.content;
    if (typeof content === 'string') answer += content;
  }

  return { answer, sources };
}

/**
 * Sends one message to the live chat endpoint with no cookie (fresh
 * anonymous session per request, so the sweep never trips the per-session
 * quota) and collects the full SSE body.
 *
 * @param {string} baseUrl
 * @param {string} message
 */
async function runLiveChatRequest(baseUrl, message) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), LIVE_REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
      signal: controller.signal,
    });

    const contentType = response.headers.get('content-type') ?? '';
    const bodyText = await response.text();

    if (!response.ok || !contentType.includes('text/event-stream')) {
      return {
        status: response.status,
        contentType,
        answer: '',
        sources: null,
        error: bodyText.slice(0, 500),
      };
    }

    const { answer, sources } = parseChatSse(bodyText);
    return { status: response.status, contentType, answer, sources, error: null };
  } catch (error) {
    return {
      status: 0,
      contentType: '',
      answer: '',
      sources: null,
      error: controller.signal.aborted
        ? `Live chat request timed out after ${LIVE_REQUEST_TIMEOUT_MS}ms.`
        : toErrorMessage(error),
    };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Probes one OpenRouter model directly. A 200 status is not enough: free
 * models can return in-band SSE `error` events with HTTP 200, so the probe
 * records visible content and in-band errors separately.
 *
 * @param {{ apiKey: string; baseUrl: string; model: string }} input
 */
async function probeModel({ apiKey, baseUrl, model }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), MODEL_PROBE_TIMEOUT_MS);
  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: 'Reply with the single word "ok".' }],
        stream: true,
      }),
      signal: controller.signal,
    });

    const bodyText = await response.text();
    if (!response.ok) {
      return {
        model,
        httpStatus: response.status,
        visibleContent: '',
        inBandError: bodyText.slice(0, 300),
        ok: false,
      };
    }

    let visibleContent = '';
    let inBandError = null;
    for (const rawLine of bodyText.split('\n')) {
      const line = rawLine.replace(/\r$/, '');
      if (!line.startsWith('data:')) continue;
      const data = line.slice(5).trimStart();
      if (!data || data === '[DONE]') continue;
      let payload;
      try {
        payload = JSON.parse(data);
      } catch {
        continue;
      }
      if (payload?.error) {
        inBandError = JSON.stringify(payload.error).slice(0, 300);
        continue;
      }
      const content = payload?.choices?.[0]?.delta?.content;
      if (typeof content === 'string') visibleContent += content;
    }

    return {
      model,
      httpStatus: response.status,
      visibleContent: visibleContent.trim().slice(0, 200),
      inBandError,
      ok: visibleContent.trim().length > 0,
    };
  } catch (error) {
    return {
      model,
      httpStatus: 0,
      visibleContent: '',
      inBandError: controller.signal.aborted
        ? `Probe timed out after ${MODEL_PROBE_TIMEOUT_MS}ms.`
        : toErrorMessage(error),
      ok: false,
    };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * @param {unknown} error
 * @returns {string}
 */
function toErrorMessage(error) {
  if (error instanceof Error && error.message.trim() !== '') return error.message;
  if (typeof error === 'string' && error.trim() !== '') return error;
  return 'Unknown error.';
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write(
      [
        'Usage:',
        '  node scripts/chat-audit.js [--base-url http://localhost:5173] [--skip-live] [--skip-model-probe]',
        '',
        'Requires DATABASE_URL and OPENROUTER_API_KEY (loaded from .env/.env.local).',
        'The live sweep requires a running dev server at --base-url unless --skip-live is set.',
      ].join('\n') + '\n',
    );
    return;
  }

  loadLocalEnv();
  validateRequiredEnv();

  const server = await createServer({
    appType: 'custom',
    logLevel: 'error',
    server: { middlewareMode: true },
  });

  try {
    const [chatModule, embeddingsModule, notesModule, openrouterModule] = await Promise.all([
      server.ssrLoadModule('/src/lib/server/chat.ts'),
      server.ssrLoadModule('/src/lib/server/embeddings.ts'),
      server.ssrLoadModule('/src/lib/server/db/notes.ts'),
      server.ssrLoadModule('/src/lib/server/ai/openrouter.ts'),
    ]);

    const primaryModel = process.env.OPENROUTER_MODEL || openrouterModule.DEFAULT_OPENROUTER_MODEL;
    const fallbackModel =
      process.env.OPENROUTER_FALLBACK_MODEL || openrouterModule.DEFAULT_OPENROUTER_FALLBACK_MODEL;
    const openrouterBaseUrl = (
      process.env.OPENROUTER_BASE_URL || openrouterModule.DEFAULT_OPENROUTER_BASE_URL
    ).replace(/\/+$/, '');

    // --- Model availability probes ---
    let modelProbes = null;
    if (!args.skipModelProbe) {
      modelProbes = [
        await probeModel({
          apiKey: process.env.OPENROUTER_API_KEY ?? '',
          baseUrl: openrouterBaseUrl,
          model: primaryModel,
        }),
        await probeModel({
          apiKey: process.env.OPENROUTER_API_KEY ?? '',
          baseUrl: openrouterBaseUrl,
          model: fallbackModel,
        }),
      ];
    }

    // --- Per-question sweep ---
    const questionReports = [];
    for (const { kind, question } of AUDIT_QUESTIONS) {
      process.stderr.write(`[chat-audit] (${kind}) ${question}\n`);

      const semanticQuery = chatModule.buildSemanticSearchQuery(question);
      const queryEmbedding = await embeddingsModule.embedText(semanticQuery);
      const [chunks, lexicalNotes, assembled] = await Promise.all([
        notesModule.searchChunksBySimilarity(queryEmbedding, 20),
        notesModule.searchNotesByLexical(question, 10),
        chatModule.assembleContext(question),
      ]);

      const sufficient = chatModule.hasSufficientCoverage(assembled);
      const sources = chatModule.buildChatSources(assembled.citedNotes);

      const retrieval = {
        semanticQuery,
        topChunks: chunks.slice(0, TOP_CHUNKS_IN_REPORT).map((chunk) => ({
          noteSlug: chunk.noteSlug,
          sectionHeading: chunk.sectionHeading,
          distance: Number(chunk.distance.toFixed(4)),
          preview: chunk.chunkText.slice(0, CHUNK_PREVIEW_CHARS),
        })),
        lexicalMatchSlugs: lexicalNotes.map((note) => note.slug),
        confidence: assembled.confidence,
        citedSlugs: assembled.citedSlugs,
        sourceSlugs: sources.map((source) => source.slug),
        sufficientCoverage: sufficient,
      };

      let live = null;
      let quoteCopy = null;
      let checks = null;
      if (!args.skipLive) {
        const liveResult = await runLiveChatRequest(args.baseUrl, question);
        const fallbackText = chatModule.buildFallbackResponse(question);
        const fallbackUsed = liveResult.answer.trim() === fallbackText.trim();

        live = {
          status: liveResult.status,
          answerSample: liveResult.answer.slice(0, ANSWER_SAMPLE_CHARS),
          answerLength: liveResult.answer.length,
          fallbackUsed,
          sourcesEvent: liveResult.sources,
          error: liveResult.error,
        };

        // Quote-copy diagnostic against every retrieved chunk excerpt.
        let maxRun = 0;
        let maxRunSlug = null;
        if (!fallbackUsed && liveResult.answer) {
          for (const chunk of chunks) {
            const run = longestSharedWordRun(liveResult.answer, chunk.chunkText);
            if (run > maxRun) {
              maxRun = run;
              maxRunSlug = chunk.noteSlug;
            }
          }
        }
        quoteCopy = {
          maxSharedRunWords: maxRun,
          chunkSlug: maxRunSlug,
          flagged: maxRun >= QUOTE_COPY_FLAG_RUN_WORDS,
        };

        checks = {
          // Low-confidence answers must not attach source metadata.
          lowConfidenceHidesSources: sufficient || (fallbackUsed && liveResult.sources === null),
          // Citable answers must stream visible content and a sources event.
          citableAnswerHasSources:
            !sufficient || (liveResult.answer.trim().length > 0 && Array.isArray(liveResult.sources)),
          streamedOk: liveResult.status === 200 && liveResult.error === null,
        };
      }

      questionReports.push({ kind, question, retrieval, live, quoteCopy, checks });
    }

    const failures = questionReports.filter(
      (report) => report.checks && Object.values(report.checks).some((passed) => passed !== true),
    );

    const report = {
      generatedAt: new Date().toISOString(),
      baseUrl: args.skipLive ? null : args.baseUrl,
      thresholds: chatModule.SEMANTIC_CONFIDENCE_THRESHOLDS,
      quoteCopyFlagRunWords: QUOTE_COPY_FLAG_RUN_WORDS,
      models: { primary: primaryModel, fallback: fallbackModel, probes: modelProbes },
      questions: questionReports,
      summary: {
        totalQuestions: questionReports.length,
        liveChecked: args.skipLive ? 0 : questionReports.length,
        checkFailures: failures.map((report) => ({ question: report.question, checks: report.checks })),
        quoteCopyFlags: questionReports
          .filter((report) => report.quoteCopy?.flagged)
          .map((report) => ({ question: report.question, quoteCopy: report.quoteCopy })),
      },
    };

    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } finally {
    await server.close();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    process.stderr.write(`${toErrorMessage(error)}\n`);
    process.exitCode = 1;
  });
}
