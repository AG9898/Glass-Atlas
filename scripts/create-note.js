#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import process from 'node:process';
import { createServer, loadEnv } from 'vite';

const REQUIRED_ENV = ['DATABASE_URL', 'OPENROUTER_API_KEY'];

/**
 * @typedef {{
 *   title?: unknown;
 *   body?: unknown;
 *   takeaway?: unknown;
 *   category?: unknown;
 *   tags?: unknown;
 *   series?: unknown;
 *   status?: unknown;
 * }} RawDraftPayload
 */

/**
 * @typedef {{
 *   title: string;
 *   body: string;
 *   takeaway: string | null;
 *   category: string | null;
 *   tags: string[] | null;
 *   series: string | null;
 *   status: 'draft';
 * }} DraftPayload
 */

/**
 * @typedef {{
 *   id: number;
 *   slug: string;
 *   title: string;
 *   body: string;
 *   takeaway: string | null;
 *   category: string | null;
 *   tags: string[] | null;
 *   series: string | null;
 *   status: 'draft' | 'published';
 *   updatedAt: Date;
 * }} SavedNote
 */

/**
 * @typedef {{
 *   createNote: (input: {
 *     slug: string;
 *     title: string;
 *     body: string;
 *     takeaway: string | null;
 *     category: string | null;
 *     tags: string[] | null;
 *     series: string | null;
 *     status: 'draft';
 *   }) => Promise<SavedNote>;
 *   getNoteBySlug: (slug: string) => Promise<SavedNote | null>;
 *   reindexNoteAfterSave: (
 *     slug: string,
 *     body: string,
 *     metadata: {
 *       title: string;
 *       category: string | null;
 *       tags: string[] | null;
 *       series: string | null;
 *       contentUpdatedAt: Date;
 *     },
 *   ) => Promise<{ status: 'current'; indexedAt: Date } | { status: 'failed'; errorMessage: string }>;
 *   slugify: (title: string) => string;
 * }} WriterModules
 */

/**
 * @typedef {{
 *   slug: string;
 *   note: SavedNote;
 *   indexStatus: 'current' | 'failed';
 *   indexError: string | null;
 * }} PersistedDraft
 */

/**
 * @param {string[]} argv
 * @returns {{ filePath: string | null; help: boolean }}
 */
export function parseArgs(argv) {
  const args = [...argv];
  /** @type {{ filePath: string | null; help: boolean }} */
  const parsed = { filePath: null, help: false };

  while (args.length > 0) {
    const arg = args.shift();
    if (arg === '--help' || arg === '-h') {
      parsed.help = true;
      continue;
    }

    if (arg === '--file' || arg === '-f') {
      const filePath = args.shift();
      if (!filePath) throw new Error('Missing file path after --file.');
      parsed.filePath = filePath;
      continue;
    }

    if (arg?.startsWith('--file=')) {
      parsed.filePath = arg.slice('--file='.length);
      if (!parsed.filePath) throw new Error('Missing file path after --file=.');
      continue;
    }

    if (arg) throw new Error(`Unknown argument: ${arg}`);
  }

  return parsed;
}

/**
 * @param {string | null} filePath
 * @param {typeof process.stdin} [input]
 * @returns {Promise<string>}
 */
export async function readPayloadSource(filePath, input = process.stdin) {
  if (filePath) return readFile(filePath, 'utf8');
  if (input.isTTY) throw new Error('No payload provided. Pass --file <path> or pipe JSON to stdin.');

  input.setEncoding('utf8');
  let raw = '';
  for await (const chunk of input) {
    raw += chunk;
  }
  return raw;
}

/**
 * @param {string} raw
 * @returns {DraftPayload}
 */
export function parsePayload(raw) {
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(`Draft payload must be valid JSON. ${toErrorMessage(error)}`);
  }

  if (!isRecord(parsed)) {
    throw new Error('Draft payload must be a JSON object.');
  }

  return normalizePayload(parsed);
}

/**
 * @param {Record<string, unknown>} payload
 * @returns {DraftPayload}
 */
export function normalizePayload(payload) {
  const title = requireString(payload.title, 'title');
  const body = requireString(payload.body, 'body');

  return {
    title,
    body,
    takeaway: optionalString(payload.takeaway, 'takeaway'),
    category: optionalString(payload.category, 'category'),
    tags: normalizeTags(payload.tags),
    series: optionalString(payload.series, 'series'),
    status: 'draft',
  };
}

/**
 * @param {DraftPayload} payload
 * @param {WriterModules} modules
 * @returns {Promise<PersistedDraft>}
 */
export async function persistDraft(payload, modules) {
  const slug = modules.slugify(payload.title);
  if (!slug) throw new Error('Title does not produce a valid slug.');

  const existing = await modules.getNoteBySlug(slug);
  if (existing) {
    throw new Error(`A note with slug "${slug}" already exists. Choose a distinct title.`);
  }

  const note = await modules.createNote({
    slug,
    title: payload.title,
    body: payload.body,
    takeaway: payload.takeaway,
    category: payload.category,
    tags: payload.tags,
    series: payload.series,
    status: 'draft',
  });

  const result = await modules.reindexNoteAfterSave(slug, note.body, {
    title: note.title,
    category: note.category,
    tags: note.tags,
    series: note.series,
    contentUpdatedAt: note.updatedAt,
  });

  return {
    slug,
    note,
    indexStatus: result.status,
    indexError: result.status === 'failed' ? result.errorMessage : null,
  };
}

export function loadLocalEnv(mode = process.env.NODE_ENV || 'development') {
  const loaded = loadEnv(mode, process.cwd(), '');
  for (const [key, value] of Object.entries(loaded)) {
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

export function validateRequiredEnv(env = process.env) {
  const missing = REQUIRED_ENV.filter((key) => !env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variable(s): ${missing.join(', ')}.`);
  }
}

/**
 * @param {string} rawPayload
 * @returns {Promise<PersistedDraft>}
 */
export async function runCreateNote(rawPayload) {
  loadLocalEnv();
  validateRequiredEnv();

  const payload = parsePayload(rawPayload);
  const server = await createServer({
    appType: 'custom',
    logLevel: 'error',
    server: { middlewareMode: true },
  });

  try {
    const [notesModule, embeddingsModule, slugifyModule] = await Promise.all([
      server.ssrLoadModule('/src/lib/server/db/notes.ts'),
      server.ssrLoadModule('/src/lib/server/embeddings.ts'),
      server.ssrLoadModule('/src/lib/utils/slugify.ts'),
    ]);

    return persistDraft(payload, {
      createNote: assertFunction(notesModule.createNote, 'createNote'),
      getNoteBySlug: assertFunction(notesModule.getNoteBySlug, 'getNoteBySlug'),
      reindexNoteAfterSave: assertFunction(embeddingsModule.reindexNoteAfterSave, 'reindexNoteAfterSave'),
      slugify: assertFunction(slugifyModule.slugify, 'slugify'),
    });
  } finally {
    await server.close();
  }
}

function usage() {
  return [
    'Usage:',
    '  npm run create-note -- --file draft.json',
    "  cat draft.json | npm run create-note --",
    '',
    'Payload JSON fields: title, body, takeaway, category, tags, series.',
    "The saved note status is always hard-forced to 'draft'.",
  ].join('\n');
}

/**
 * @param {unknown} value
 * @param {string} fieldName
 * @returns {string}
 */
function requireString(value, fieldName) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`Draft payload field "${fieldName}" must be a non-empty string.`);
  }
  return value.trim();
}

/**
 * @param {unknown} value
 * @param {string} fieldName
 * @returns {string | null}
 */
function optionalString(value, fieldName) {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') {
    throw new Error(`Draft payload field "${fieldName}" must be a string when provided.`);
  }

  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

/**
 * @param {unknown} value
 * @returns {string[] | null}
 */
function normalizeTags(value) {
  if (value === undefined || value === null) return null;
  if (!Array.isArray(value)) {
    throw new Error('Draft payload field "tags" must be an array of strings when provided.');
  }

  const tags = value
    .map((tag) => {
      if (typeof tag !== 'string') throw new Error('Draft payload field "tags" must contain only strings.');
      return tag.trim();
    })
    .filter((tag) => tag !== '');

  return tags.length > 0 ? tags : null;
}

/**
 * @template {(...args: never[]) => unknown} T
 * @param {unknown} value
 * @param {string} name
 * @returns {T}
 */
function assertFunction(value, name) {
  if (typeof value !== 'function') throw new Error(`Unable to load ${name} from SvelteKit modules.`);
  return /** @type {T} */ (value);
}

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
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
    process.stdout.write(`${usage()}\n`);
    return;
  }

  const rawPayload = await readPayloadSource(args.filePath);
  const result = await runCreateNote(rawPayload);

  process.stdout.write(
    JSON.stringify(
      {
        slug: result.slug,
        status: result.note.status,
        editUrl: `/admin/notes/${result.slug}/edit`,
        semanticIndexStatus: result.indexStatus,
        semanticIndexError: result.indexError,
      },
      null,
      2,
    ),
  );
  process.stdout.write('\n');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    process.stderr.write(`${toErrorMessage(error)}\n`);
    process.exitCode = 1;
  });
}
