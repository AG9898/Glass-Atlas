#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import process from 'node:process';
import { createServer, loadEnv } from 'vite';

/**
 * @typedef {{
 *   title: string;
 *   body: string;
 *   takeaway: string | null;
 * }} DraftReviewPayload
 */

/**
 * @typedef {{
 *   reviewDraft: (input: DraftReviewPayload) => Promise<unknown>;
 * }} DraftReviewModules
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
 * @returns {DraftReviewPayload}
 */
export function parsePayload(raw) {
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(`Draft review payload must be valid JSON. ${toErrorMessage(error)}`);
  }

  if (!isRecord(parsed)) throw new Error('Draft review payload must be a JSON object.');

  return {
    title: requireString(parsed.title, 'title'),
    body: requireString(parsed.body, 'body'),
    takeaway: optionalString(parsed.takeaway, 'takeaway'),
  };
}

/**
 * @param {string} rawPayload
 * @returns {Promise<unknown>}
 */
export async function runReviewDraft(rawPayload) {
  loadLocalEnv();
  const payload = parsePayload(rawPayload);
  const server = await createServer({
    appType: 'custom',
    logLevel: 'error',
    server: { middlewareMode: true },
  });

  try {
    const draftReviewModule = await server.ssrLoadModule('/src/lib/server/ai/draft-review.ts');
    return assertFunction(draftReviewModule.reviewDraft, 'reviewDraft')(payload);
  } finally {
    await server.close();
  }
}

export function loadLocalEnv(mode = process.env.NODE_ENV || 'development') {
  const loaded = loadEnv(mode, process.cwd(), '');
  for (const [key, value] of Object.entries(loaded)) {
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

function usage() {
  return [
    'Usage:',
    '  npm run review-draft -- --file draft.json',
    "  cat draft.json | npm run review-draft --",
    '',
    'Payload JSON fields: title, body, takeaway.',
    'The result is printed as JSON and never writes to the database.',
  ].join('\n');
}

/**
 * @param {unknown} value
 * @param {string} fieldName
 * @returns {string}
 */
function requireString(value, fieldName) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`Draft review payload field "${fieldName}" must be a non-empty string.`);
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
    throw new Error(`Draft review payload field "${fieldName}" must be a string when provided.`);
  }

  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

/**
 * @template {(input: DraftReviewPayload) => Promise<unknown>} T
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
  const result = await runReviewDraft(rawPayload);

  process.stdout.write(JSON.stringify(result, null, 2));
  process.stdout.write('\n');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    process.stderr.write(`${toErrorMessage(error)}\n`);
    process.exitCode = 1;
  });
}
