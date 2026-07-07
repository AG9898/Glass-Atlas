#!/usr/bin/env node
import process from 'node:process';
import { createServer } from 'vite';
import { loadLocalEnv } from './create-note.js';

const REQUIRED_AUDIT_ENV = ['DATABASE_URL'];
const REQUIRED_REFRESH_ENV = ['DATABASE_URL', 'OPENROUTER_API_KEY'];

/**
 * @typedef {{
 *   slug: string;
 *   title: string;
 *   body: string;
 *   category: string | null;
 *   tags: string[] | null;
 *   series: string | null;
 *   embedding: number[] | null;
 *   semanticIndexStatus: 'pending' | 'current' | 'failed';
 *   semanticIndexedAt: Date | null;
 *   semanticIndexSourceUpdatedAt: Date | null;
 *   updatedAt: Date;
 * }} SemanticIndexNote
 */

/**
 * @typedef {{
 *   listNotes: (filter: { status: 'published' }) => Promise<SemanticIndexNote[]>;
 *   getNoteBySlug: (slug: string) => Promise<SemanticIndexNote | null>;
 *   getNoteChunkCount: (slug: string) => Promise<number>;
 *   hasCurrentSemanticIndex: (note: SemanticIndexNote) => boolean;
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
 * }} SemanticIndexModules
 */

/**
 * @typedef {{
 *   slug: string;
 *   title: string;
 *   ok: boolean;
 *   chunkCount: number;
 *   issues: string[];
 *   refreshStatus: 'skipped' | 'current' | 'failed';
 *   refreshError: string | null;
 * }} SemanticIndexAuditEntry
 */

/**
 * @typedef {{
 *   mode: 'audit' | 'refresh';
 *   totalPublished: number;
 *   currentCount: number;
 *   needsMaintenanceCount: number;
 *   refreshedCount: number;
 *   failedRefreshCount: number;
 *   notes: SemanticIndexAuditEntry[];
 * }} SemanticIndexAuditReport
 */

/**
 * @param {string[]} argv
 * @returns {{ refresh: boolean; help: boolean }}
 */
export function parseArgs(argv) {
  const parsed = { refresh: false, help: false };

  for (const arg of argv) {
    if (arg === '--help' || arg === '-h') {
      parsed.help = true;
      continue;
    }

    if (arg === '--refresh') {
      parsed.refresh = true;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return parsed;
}

/**
 * @param {SemanticIndexModules} modules
 * @param {{ refresh?: boolean }} [options]
 * @returns {Promise<SemanticIndexAuditReport>}
 */
export async function auditPublishedSemanticIndexes(modules, options = {}) {
  const refresh = options.refresh === true;
  const publishedNotes = await modules.listNotes({ status: 'published' });
  /** @type {SemanticIndexAuditEntry[]} */
  const entries = [];

  for (const initialNote of publishedNotes) {
    let note = initialNote;
    let chunkCount = await modules.getNoteChunkCount(note.slug);
    let entry = buildAuditEntry(note, chunkCount, modules.hasCurrentSemanticIndex(note));

    if (refresh && !entry.ok) {
      const result = await modules.reindexNoteAfterSave(note.slug, note.body, {
        title: note.title,
        category: note.category,
        tags: note.tags,
        series: note.series,
        contentUpdatedAt: note.updatedAt,
      });

      const refreshedNote = await modules.getNoteBySlug(note.slug);
      if (refreshedNote) {
        note = refreshedNote;
        chunkCount = await modules.getNoteChunkCount(note.slug);
        entry = buildAuditEntry(note, chunkCount, modules.hasCurrentSemanticIndex(note));
      }

      entry.refreshStatus = result.status;
      entry.refreshError = result.status === 'failed' ? result.errorMessage : null;
    }

    entries.push(entry);
  }

  const currentCount = entries.filter((entry) => entry.ok).length;
  const refreshedCount = entries.filter((entry) => entry.refreshStatus === 'current').length;
  const failedRefreshCount = entries.filter((entry) => entry.refreshStatus === 'failed').length;

  return {
    mode: refresh ? 'refresh' : 'audit',
    totalPublished: entries.length,
    currentCount,
    needsMaintenanceCount: entries.length - currentCount,
    refreshedCount,
    failedRefreshCount,
    notes: entries,
  };
}

/**
 * @param {SemanticIndexNote} note
 * @param {number} chunkCount
 * @param {boolean} hasCurrentIndex
 * @returns {SemanticIndexAuditEntry}
 */
export function buildAuditEntry(note, chunkCount, hasCurrentIndex) {
  const issues = [];

  if (note.semanticIndexStatus !== 'current') issues.push(`index-status-${note.semanticIndexStatus}`);
  if (note.embedding === null) issues.push('missing-note-embedding');
  if (note.semanticIndexedAt === null) issues.push('missing-indexed-at');
  if (note.semanticIndexSourceUpdatedAt === null) {
    issues.push('missing-source-updated-at');
  } else if (note.semanticIndexSourceUpdatedAt.getTime() < note.updatedAt.getTime()) {
    issues.push('stale-source-updated-at');
  }
  if (chunkCount <= 0) issues.push('missing-chunks');

  return {
    slug: note.slug,
    title: note.title,
    ok: hasCurrentIndex && chunkCount > 0,
    chunkCount,
    issues,
    refreshStatus: 'skipped',
    refreshError: null,
  };
}

/**
 * @param {{ refresh: boolean }} options
 * @returns {Promise<SemanticIndexAuditReport>}
 */
export async function runSemanticIndexMaintenance(options) {
  loadLocalEnv();
  validateRequiredEnv(options.refresh ? REQUIRED_REFRESH_ENV : REQUIRED_AUDIT_ENV);

  const server = await createServer({
    appType: 'custom',
    logLevel: 'error',
    server: { middlewareMode: true },
  });

  try {
    const [notesModule, embeddingsModule] = await Promise.all([
      server.ssrLoadModule('/src/lib/server/db/notes.ts'),
      server.ssrLoadModule('/src/lib/server/embeddings.ts'),
    ]);

    return auditPublishedSemanticIndexes(
      {
        listNotes: assertFunction(notesModule.listNotes, 'listNotes'),
        getNoteBySlug: assertFunction(notesModule.getNoteBySlug, 'getNoteBySlug'),
        getNoteChunkCount: assertFunction(notesModule.getNoteChunkCount, 'getNoteChunkCount'),
        hasCurrentSemanticIndex: assertFunction(notesModule.hasCurrentSemanticIndex, 'hasCurrentSemanticIndex'),
        reindexNoteAfterSave: assertFunction(embeddingsModule.reindexNoteAfterSave, 'reindexNoteAfterSave'),
      },
      options,
    );
  } finally {
    await server.close();
  }
}

/**
 * @param {string[]} keys
 * @param {NodeJS.ProcessEnv} [env]
 */
export function validateRequiredEnv(keys, env = process.env) {
  const missing = keys.filter((key) => !env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variable(s): ${missing.join(', ')}.`);
  }
}

function usage() {
  return [
    'Usage:',
    '  npm run semantic-index:audit',
    '  npm run semantic-index:refresh',
    '',
    'Audit checks published notes for current semantic index metadata and chunk rows.',
    'Refresh reindexes failing notes through reindexNoteAfterSave(); it never edits vectors directly.',
  ].join('\n');
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

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write(`${usage()}\n`);
    return;
  }

  const report = await runSemanticIndexMaintenance({ refresh: args.refresh });
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (report.needsMaintenanceCount > 0 || report.failedRefreshCount > 0) {
    process.exitCode = 1;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    process.stderr.write(`${toErrorMessage(error)}\n`);
    process.exitCode = 1;
  });
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
