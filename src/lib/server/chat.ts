import { embedText } from './embeddings';
import { searchChunksBySimilarity, searchNotesByLexical } from './db/notes';
import type { RetrievedNoteChunk, RetrievedLexicalNote } from './db/notes';
import { isSafeNoteSlug, buildSourceSnippet } from '$lib/utils/chat-format';

/** Maximum number of chunk candidates to retrieve from pgvector. */
const CHUNK_CANDIDATES = 20;

/** Maximum lexical note candidates to retrieve per query. */
const LEXICAL_CANDIDATES = 10;

/** Maximum chunks to include per note in the assembled context. */
const MAX_CHUNKS_PER_NOTE = 2;

/** Maximum number of distinct notes to include in the context. */
const MAX_NOTES_IN_CONTEXT = 5;

/**
 * Semantic cosine-distance tiers for retrieval confidence.
 *
 * pgvector's `<=>` returns smaller values for closer matches. These cutoffs
 * keep obviously irrelevant nearest-neighbor chunks away from the LLM while
 * preserving a middle band for limited-coverage handling.
 */
export const SEMANTIC_CONFIDENCE_THRESHOLDS = {
  highMaxDistance: 0.5,
  borderlineMaxDistance: 0.68,
} as const;

export type CitedNote = {
  /** URL-safe slug identifying the note. */
  slug: string;
  /** Human-readable note title. */
  title: string;
  /**
   * Brief, HTML-escaped excerpt derived from the retrieved chunk/takeaway
   * already selected for prompt assembly. Never LLM output. Powers the chat
   * source-popup contract; see `buildChatSources`.
   */
  snippet: string;
};

/**
 * Source metadata exposed to the client for the chat source-popup contract.
 * Structurally identical to `CitedNote` today; kept as a distinct alias so
 * call sites read clearly as "what gets sent over the wire" rather than the
 * internal retrieval-fusion bookkeeping type.
 */
export type ChatSource = CitedNote;

export type CoverageTier = 'high' | 'borderline' | 'low';

export type RetrievalConfidence = {
  /**
   * Retrieval confidence tier used by the API route to choose normal answer,
   * limited-coverage, or deterministic fallback behavior.
   */
  tier: CoverageTier;
  /** Best semantic chunk cosine distance, when semantic retrieval returned chunks. */
  bestSemanticDistance: number | null;
  /** Number of lexical/topic note matches considered during fusion. */
  lexicalMatchCount: number;
};

export type AssembledContext = {
  /** Formatted context block ready to be injected into the LLM prompt. */
  context: string;
  /**
   * Slugs of all notes whose excerpts were included in the context.
   * Derived from `citedNotes` for convenience.
   */
  citedSlugs: string[];
  /** Notes (slug + title) whose excerpts were included in the context. */
  citedNotes: CitedNote[];
  /** Confidence metadata derived from semantic distance plus lexical support. */
  confidence: RetrievalConfidence;
};

/**
 * Returns `true` when retrieval confidence is high or borderline enough for an
 * LLM path. Low-confidence and empty retrieval short-circuit to fallback.
 *
 * This intentionally does more than check for non-empty context: irrelevant
 * nearest-neighbor chunks can still produce snippets, so semantic distance is
 * the primary gate and lexical matches are supporting evidence only.
 */
export function hasSufficientCoverage(ctx: AssembledContext): boolean {
  return ctx.context.length > 0 && ctx.citedSlugs.length > 0 && ctx.confidence.tier !== 'low';
}

/**
 * Base first-person response returned when retrieval finds no relevant notes.
 * Kept as a stable phrase for tests and UI expectations.
 */
export const INSUFFICIENT_COVERAGE_RESPONSE = "I don't have a note on that yet.";

const COVERAGE_STEER_SUFFIX =
  'Try asking for a specific topic, note title, or project and I can share what I have written.';

/**
 * Builds the fallback response text for insufficient-coverage situations.
 *
 * Low-confidence retrieval can still contain nearest-neighbor chunks, but
 * those candidates are not reliable enough to present as related links or
 * source metadata. Borderline retrieval uses the LLM limited-coverage path
 * instead, where genuinely adjacent notes can still be cited.
 *
 * @param query - User message text for minimal tone shaping.
 */
export function buildFallbackResponse(query = ''): string {
  const trimmed = query.trim();
  const steerPrefix = trimmed.endsWith('?')
    ? 'I have not documented that exact question yet.'
    : INSUFFICIENT_COVERAGE_RESPONSE;

  return `${steerPrefix} ${COVERAGE_STEER_SUFFIX}`;
}

/**
 * Selects deterministic source metadata for the chat source-popup contract.
 *
 * Source metadata is derived entirely from retrieval candidates already
 * assembled into the prompt context — never from LLM output. Notes with an
 * unsafe slug or an empty snippet are dropped, using the same slug-safety
 * rule as `buildFallbackResponse` and chat link rendering, so the caller
 * never has to re-validate slugs before emitting metadata to the client.
 *
 * The caller is responsible for only invoking this when retrieval confidence
 * is sufficient (see `hasSufficientCoverage`) — low-confidence, no-source,
 * and social-intent responses should omit source metadata entirely rather
 * than calling this with an empty or irrelevant candidate list.
 *
 * @param citedNotes - Notes retrieved by the context assembly step.
 */
export function buildChatSources(citedNotes: CitedNote[]): ChatSource[] {
  return citedNotes.filter((note) => isSafeNoteSlug(note.slug) && note.snippet.length > 0);
}

/**
 * Embeds `query`, then runs semantic (pgvector cosine) and lexical/topic
 * (title/tags/category ILIKE) retrieval in parallel against published notes.
 * Candidate sets are fused: semantic chunks are grouped by note and ranked by
 * best-chunk cosine distance; lexical-only notes (not already in the semantic
 * set) are appended in lexical order. The combined list is capped at
 * MAX_NOTES_IN_CONTEXT distinct notes.
 *
 * Full note bodies are never passed to the LLM — only bounded evidence for
 * synthesis is included per semantic note; lexical-only notes contribute only
 * their title and takeaway line. Context labels deliberately frame retrieved
 * text as evidence to paraphrase rather than prose to copy.
 */
export async function assembleContext(query: string): Promise<AssembledContext> {
  const semanticQuery = buildSemanticSearchQuery(query);
  const queryEmbedding = await embedText(semanticQuery);

  // Run both retrieval branches in parallel for latency efficiency.
  const [chunks, lexicalNotes] = await Promise.all([
    searchChunksBySimilarity(queryEmbedding, CHUNK_CANDIDATES),
    searchNotesByLexical(query, LEXICAL_CANDIDATES),
  ]);

  if (chunks.length === 0 && lexicalNotes.length === 0) {
    return {
      context: '',
      citedSlugs: [],
      citedNotes: [],
      confidence: {
        tier: 'low',
        bestSemanticDistance: null,
        lexicalMatchCount: 0,
      },
    };
  }

  // ----- Semantic candidate set -----
  // Group chunks by note slug in cosine-distance order (best first).
  const chunksBySlug = new Map<string, RetrievedNoteChunk[]>();
  for (const chunk of chunks) {
    const existing = chunksBySlug.get(chunk.noteSlug);
    if (!existing) {
      chunksBySlug.set(chunk.noteSlug, [chunk]);
    } else if (existing.length < MAX_CHUNKS_PER_NOTE) {
      existing.push(chunk);
    }
    if (chunksBySlug.size >= MAX_NOTES_IN_CONTEXT) break;
  }

  // ----- Lexical-only fill -----
  // Append lexical notes not already present in the semantic set, until the
  // combined slate reaches MAX_NOTES_IN_CONTEXT. This is deterministic because
  // lexicalNotes is already sorted (most-recently published first).
  const lexicalOnlyNotes: RetrievedLexicalNote[] = [];
  for (const note of lexicalNotes) {
    if (chunksBySlug.size + lexicalOnlyNotes.length >= MAX_NOTES_IN_CONTEXT) break;
    if (!chunksBySlug.has(note.slug)) {
      lexicalOnlyNotes.push(note);
    }
  }

  // ----- Assemble context -----
  const snippets: string[] = [];
  const citedNotes: CitedNote[] = [];

  // Semantic entries first (ranked by cosine similarity).
  for (const [slug, noteChunks] of chunksBySlug) {
    snippets.push(formatChunkSnippet(slug, noteChunks));
    citedNotes.push({
      slug,
      title: noteChunks[0].noteTitle,
      snippet: buildSourceSnippet(noteChunks[0].chunkText),
    });
  }

  // Lexical-only entries appended after semantic entries.
  for (const note of lexicalOnlyNotes) {
    snippets.push(formatLexicalSnippet(note));
    citedNotes.push({
      slug: note.slug,
      title: note.title,
      snippet: buildSourceSnippet(note.takeaway ?? note.title),
    });
  }

  const context = `Retrieved notes:\n\n${snippets.join('\n\n---\n\n')}`;
  const citedSlugs = citedNotes.map((n) => n.slug);
  return {
    context,
    citedSlugs,
    citedNotes,
    confidence: classifyRetrievalConfidence(chunks, lexicalNotes.length),
  };
}

/**
 * Expands site-specific aliases before semantic embedding.
 *
 * The note chunks are embedded with metadata terms such as the site name,
 * technical vocabulary, and author framing. User questions often use shorter
 * aliases ("creator", "RAG", "LLMs"), so this adds those local synonyms to
 * improve recall without changing the original lexical query or prompt.
 */
export function buildSemanticSearchQuery(query: string): string {
  return query
    .replace(/\bAden\b/g, 'Aden author')
    .replace(/\bcreator\b/gi, 'creator author Aden Glass Atlas')
    .replace(/\bthis site\b/gi, 'this site Glass Atlas personal website')
    .replace(/\bRAG\b/gi, 'RAG retrieval augmented generation semantic search embeddings')
    .replace(/\bLLM'?s\b/gi, 'LLMs large language models AI chatbot')
    .replace(/\bemploy\b/gi, 'use employ');
}

function classifyRetrievalConfidence(
  chunks: RetrievedNoteChunk[],
  lexicalMatchCount: number,
): RetrievalConfidence {
  const bestSemanticDistance = chunks[0]?.distance ?? null;

  if (bestSemanticDistance === null) {
    return {
      tier: lexicalMatchCount > 0 ? 'borderline' : 'low',
      bestSemanticDistance,
      lexicalMatchCount,
    };
  }

  if (bestSemanticDistance <= SEMANTIC_CONFIDENCE_THRESHOLDS.highMaxDistance) {
    return { tier: 'high', bestSemanticDistance, lexicalMatchCount };
  }

  if (bestSemanticDistance <= SEMANTIC_CONFIDENCE_THRESHOLDS.borderlineMaxDistance) {
    return { tier: 'borderline', bestSemanticDistance, lexicalMatchCount };
  }

  return { tier: 'low', bestSemanticDistance, lexicalMatchCount };
}

/**
 * Formats the retrieved chunks for a single note as a compact excerpt block.
 * Includes the note slug, title, and one or more chunk excerpts with their
 * section headings. Never sends the full body.
 */
function formatChunkSnippet(slug: string, chunks: RetrievedNoteChunk[]): string {
  const { noteTitle } = chunks[0];
  const lines: string[] = [`Slug: ${slug}`, `Title: ${noteTitle}`];

  for (const chunk of chunks) {
    if (chunk.sectionHeading) {
      lines.push(`Section: ${chunk.sectionHeading}`);
    }
    lines.push(`Evidence to paraphrase (rewrite in your own words, do not copy wording): ${chunk.chunkText.trim()}`);
  }

  return lines.join('\n');
}

/**
 * Formats a lexical-only note match (title + optional takeaway).
 * Used when a note matches lexical/topic search but has no semantic chunks in
 * the top-k cosine results. Never sends the full body.
 */
function formatLexicalSnippet(note: RetrievedLexicalNote): string {
  const lines: string[] = [`Slug: ${note.slug}`, `Title: ${note.title}`];
  if (note.takeaway) {
    lines.push(`Takeaway to synthesize: ${note.takeaway}`);
  }
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Catalog (metadata) lane
// ---------------------------------------------------------------------------

/**
 * Question classes that ask *about the collection of notes* rather than about
 * anything written inside one.
 *
 * These are structurally unanswerable by the retrieval path: publication order
 * and corpus size live in table columns, not in chunk prose, so no amount of
 * semantic or lexical matching can surface them. "What is my most recent note"
 * embeds to nothing in particular and matches no title/tag/category, so it
 * lands in the low-confidence fallback even though the answer is a single
 * indexed query away.
 */
export type CatalogIntent = 'recent' | 'count' | 'list';

/**
 * Narrow allowlist of catalog phrasings, deliberately conservative.
 *
 * Every pattern requires an explicit corpus noun (note/post/article/writing)
 * or an anchored bare phrasing, so topical questions that merely contain a
 * word like "recent" ("what are your recent thoughts on agents?") stay on the
 * retrieval path where they belong. False negatives here are cheap — the query
 * simply falls through to normal RAG — while false positives would answer a
 * content question with a table of contents.
 */
const CATALOG_INTENT_PATTERNS: ReadonlyArray<{ intent: CatalogIntent; pattern: RegExp }> = [
  // --- count ---
  { intent: 'count', pattern: /\bhow many (notes|posts|articles|pieces)\b/ },
  { intent: 'count', pattern: /\b(number|total) of (notes|posts|articles)\b/ },

  // --- recent ---
  {
    intent: 'recent',
    pattern: /\b(most recent|latest|newest|last|recent)\s+(note|post|article|piece|writing)s?\b/,
  },
  {
    intent: 'recent',
    pattern: /\bwhat(?:'s| is| has been)? (?:the )?(?:new|newest|latest)\b.*\b(note|post|article|writing)s?\b/,
  },
  {
    intent: 'recent',
    pattern:
      /\bwhat (?:have|did) you (?:write|wrote|written|publish|published|post|posted)(?: about)? (?:recently|lately|last)\b/,
  },
  { intent: 'recent', pattern: /\bwhen did you last (write|publish|post)\b/ },

  // --- list ---
  { intent: 'list', pattern: /\b(list|show me) (?:all )?(?:your|the) (notes|posts|articles)\b/ },
  { intent: 'list', pattern: /\bwhat (notes|posts|articles) (do you have|have you written)\b/ },
  // Anchored: a trailing topic ("...written about agents?") must fall through to RAG.
  { intent: 'list', pattern: /\bwhat (?:have you written|do you write) about[?.!]?$/ },
  { intent: 'list', pattern: /\bwhat (topics|subjects) do you (cover|write about)\b/ },
  { intent: 'list', pattern: /\bwhat is this site about[?.!]?$/ },
];

/**
 * Classifies `message` as a catalog question, or `null` to fall through to
 * normal retrieval. Checked in listed order; `count` precedes `recent` so
 * "how many notes have you written lately" reads as a count.
 */
export function detectCatalogIntent(message: string): CatalogIntent | null {
  const normalized = message.trim().toLowerCase();
  if (!normalized) return null;

  for (const { intent, pattern } of CATALOG_INTENT_PATTERNS) {
    if (pattern.test(normalized)) return intent;
  }
  return null;
}

/** Maximum notes enumerated in a catalog context block. */
const MAX_NOTES_IN_CATALOG = 8;

/**
 * Maximum notes surfaced in the source popup, per intent.
 *
 * The prompt block always carries the full enumerated slice so the LLM can
 * place a note in context, but the source list should reflect what the answer
 * is actually about: a recency answer is about the newest note (plus room for
 * "and here's what came just before"), not the whole corpus. Count and list
 * answers genuinely span everything enumerated.
 */
const CATALOG_SOURCE_LIMITS: Record<CatalogIntent, number> = {
  recent: 3,
  count: MAX_NOTES_IN_CATALOG,
  list: MAX_NOTES_IN_CATALOG,
};

export type CatalogContext = {
  intent: CatalogIntent;
  /** Prompt block: authoritative note metadata, never chunk prose. */
  context: string;
  /** Per-intent instruction telling the LLM how to use the block. */
  instruction: string;
  /** Notes named in the block, for the source-popup contract. */
  citedNotes: CitedNote[];
  /** Total published notes, which may exceed the enumerated slice. */
  totalPublished: number;
};

const CATALOG_INSTRUCTIONS: Record<CatalogIntent, string> = {
  recent:
    'Catalog question: the block below is authoritative, current metadata about my published notes, ordered newest first — the first entry is the most recent. Answer directly: name the note, say when I published it, and describe in your own words what it actually covers using its takeaway. Do not stop at the title and hand the reader off; give them the substance first, then invite a follow-up. Never claim you lack a note on this.',
  count:
    'Catalog question: the block below is authoritative, current metadata about my published notes. Answer with the exact total stated, then briefly characterize the range of what I write about, using the listed titles and takeaways. Never claim you lack a note on this.',
  list:
    'Catalog question: the block below is authoritative, current metadata about my published notes, ordered newest first. Give a short tour: group or walk through them and say in your own words what each covers, using its takeaway. Do not just print a list of titles. Never claim you lack a note on this.',
};

function formatCatalogDate(publishedAt: Date | null): string {
  if (!publishedAt) return 'unpublished date';
  return publishedAt.toISOString().slice(0, 10);
}

/**
 * Formats one catalog entry. Mirrors the "takeaway only" ceiling of the
 * lexical-only retrieval path — full note bodies never enter this block.
 */
function formatCatalogEntry(note: CatalogSourceNote, position: number): string {
  const lines = [
    `${position}. Title: ${note.title}`,
    `   Slug: ${note.slug}`,
    `   Published: ${formatCatalogDate(note.publishedAt)}`,
  ];
  if (note.category) lines.push(`   Category: ${note.category}`);
  if (note.takeaway) {
    lines.push(`   Takeaway to synthesize (rewrite in your own words): ${note.takeaway}`);
  }
  return lines.join('\n');
}

/**
 * Minimal note shape the catalog lane needs, kept structural so the assembly
 * function is unit-testable without constructing a full `Note` row.
 */
export type CatalogSourceNote = {
  slug: string;
  title: string;
  takeaway: string | null;
  category: string | null;
  publishedAt: Date | null;
};

/**
 * Builds the catalog prompt block from published notes.
 *
 * Deliberately *not* filtered by semantic-index freshness (unlike chat
 * retrieval, per the CHAT-07B contract): that contract exists because stale
 * chunk vectors make chunk prose untrustworthy as evidence. This block carries
 * no chunk prose — only title, date, category, and takeaway read live from the
 * notes table — so a note whose index is mid-refresh is still counted and
 * named correctly here. Excluding it would make the chat give a factually
 * wrong answer about what is published on the site.
 *
 * Returns `null` when nothing is published, so the caller can fall through to
 * the normal fallback rather than emit an empty catalog.
 */
export function buildCatalogContext(
  intent: CatalogIntent,
  publishedNotes: readonly CatalogSourceNote[],
): CatalogContext | null {
  if (publishedNotes.length === 0) return null;

  const enumerated = publishedNotes.slice(0, MAX_NOTES_IN_CATALOG);
  const entries = enumerated.map((note, i) => formatCatalogEntry(note, i + 1));

  const header =
    `Note index (authoritative metadata for my published notes, newest first).\n` +
    `Total published notes: ${publishedNotes.length}.` +
    (publishedNotes.length > enumerated.length
      ? ` Showing the ${enumerated.length} most recent.`
      : '');

  return {
    intent,
    context: `${header}\n\n${entries.join('\n\n')}`,
    instruction: CATALOG_INSTRUCTIONS[intent],
    citedNotes: enumerated.slice(0, CATALOG_SOURCE_LIMITS[intent]).map((note) => ({
      slug: note.slug,
      title: note.title,
      snippet: buildSourceSnippet(note.takeaway ?? note.title),
    })),
    totalPublished: publishedNotes.length,
  };
}

/**
 * Deterministic answer used when the LLM call fails on the catalog lane.
 *
 * The catalog lane exists to make a class of question reliably answerable, so
 * a free-model outage degrades to a plain factual answer rather than the
 * generic "I don't have a note on that yet" the question already failed with.
 */
export function buildCatalogFallbackResponse(catalog: CatalogContext): string {
  const [newest] = catalog.citedNotes;
  const total = catalog.totalPublished;
  const plural = total === 1 ? 'note' : 'notes';

  const invite =
    total === 1
      ? 'Ask me about it and I will dig into what I wrote.'
      : 'Ask me about any of them and I will dig into what I wrote.';

  if (catalog.intent === 'count') {
    return `I have ${total} published ${plural} right now. The most recent is "${newest.title}". ${invite}`;
  }

  if (catalog.intent === 'list') {
    const titles = catalog.citedNotes.map((n) => `"${n.title}"`).join(', ');
    return `I have ${total} published ${plural}: ${titles}. Ask about any one of them and I will get into the detail.`;
  }

  return `My most recent note is "${newest.title}". I have ${total} published ${plural} in total. Ask me about it and I will get into what it covers.`;
}
