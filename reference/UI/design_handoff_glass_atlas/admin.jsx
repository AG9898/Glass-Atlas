/* global React */
const { useState } = React;

// =====================================================================
// Glass Atlas — Admin Note Editor
// Implements styleguide.md §2 "Admin" + §5.5 "Admin Forms":
//   - same tokens as public; lower asymmetry, lower drama
//   - direct, linear form sections with consistent row dividers
//   - sparse accent (focus / primary action / success only)
//   - optimize for speed of editing and form clarity
// Surfaces every editable field on the notes table per CONVENTIONS.md:
//   slug, title, takeaway, body (Markdown), tags[], category, embedding status
// =====================================================================

const CATEGORIES = [
  'Systems', 'Databases', 'CI/CD', 'Auth', 'Writing', 'Debugging', 'RAG & LLMs', 'TypeScript', 'Process'
];

function L({ children, color = 'text-muted', style = {} }) {
  return <span className="t-label" style={{ color: `var(--color-${color})`, ...style }}>{children}</span>;
}
function M({ children, color = 'text-muted', style = {} }) {
  return <span className="t-meta" style={{ color: `var(--color-${color})`, ...style }}>{children}</span>;
}

// ---- Field row -------------------------------------------------------
// All form fields share the same two-column row pattern: label gutter on
// left, input on right, separated by a 1px rule. Mimics a technical form.
function Field({ label, hint, children, required }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '220px 1fr',
      borderTop: '1px solid var(--color-line-2)',
      alignItems: 'stretch'
    }}>
      <div style={{
        padding: '20px 24px',
        borderRight: '1px solid var(--color-line-2)',
        display: 'flex', flexDirection: 'column', gap: 8
      }}>
        <L color="text-strong">{label}{required && <span style={{ color: 'var(--color-error)' }}> *</span>}</L>
        {hint && <M style={{ textTransform: 'none', letterSpacing: 0, fontSize: 12 }}>{hint}</M>}
      </div>
      <div style={{ padding: '14px 24px' }}>{children}</div>
    </div>
  );
}

// Bottom-line input (per styleguide §5.7 "line-led styling")
function LineInput({ value, onChange, placeholder, mono, style = {} }) {
  return (
    <input
      value={value}
      onChange={e => onChange?.(e.target.value)}
      placeholder={placeholder}
      className={mono ? 't-code' : 't-body'}
      style={{
        width: '100%',
        borderBottom: '2px solid var(--color-line-3)',
        padding: '8px 0',
        color: 'var(--color-text-strong)',
        fontFamily: mono ? '"Space Grotesk", monospace' : undefined,
        ...style
      }}
    />
  );
}

// ---- Top admin bar ---------------------------------------------------

function AdminBar({ status, onStatusChange }) {
  return (
    <header style={{ borderBottom: '2px solid var(--color-line-3)', background: 'var(--color-surface-1)' }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 32px', borderBottom: '1px solid var(--color-line-2)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <span className="t-display" style={{ fontSize: 20, lineHeight: 1, letterSpacing: '-0.03em' }}>Glass Atlas</span>
          <M>/&nbsp; ADMIN</M>
          <M color="text-strong">/&nbsp; NOTES</M>
          <M color="text-strong">/&nbsp; EDIT</M>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <M>SIGNED IN AS</M>
          <M color="text-strong">@AG9898 · GITHUB</M>
          <div style={{ width: 1, height: 16, background: 'var(--color-line-2)' }} />
          <M color="text-strong">↗ VIEW SITE</M>
        </div>
      </div>

      {/* Action row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <button className="t-meta" style={{ color: 'var(--color-text-muted)', borderBottom: '1px solid var(--color-line-2)', paddingBottom: 4 }}>← ALL NOTES</button>
          <span className="t-h3" style={{ fontSize: 20 }}>Note 041 · pgvector cosine vs. inner product</span>
          {/* Status pill — line-only chip */}
          <div style={{
            border: `1px solid var(--color-${status === 'published' ? 'success' : 'warning'})`,
            padding: '4px 10px',
            display: 'inline-flex', alignItems: 'center', gap: 8
          }}>
            <span style={{
              width: 6, height: 6,
              background: `var(--color-${status === 'published' ? 'success' : 'warning'})`
            }} />
            <span className="t-meta" style={{ color: `var(--color-${status === 'published' ? 'success' : 'warning'})` }}>
              {status === 'published' ? 'PUBLISHED' : 'DRAFT'}
            </span>
          </div>
          <M>EDITED 4 MIN AGO · AUTOSAVED</M>
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <button className="t-label" style={{
            border: '2px solid var(--color-line-3)', padding: '12px 18px',
            color: 'var(--color-text-strong)'
          }}>↗ PREVIEW</button>
          <button className="t-label" style={{
            border: '2px solid var(--color-line-3)', padding: '12px 18px',
            color: 'var(--color-text-strong)'
          }}>SAVE DRAFT</button>
          <button className="t-label" style={{
            border: '2px solid var(--color-accent-900)',
            background: 'var(--color-accent-700)', color: 'var(--color-bg)',
            padding: '12px 22px'
          }} onClick={() => onStatusChange?.(status === 'published' ? 'draft' : 'published')}>
            {status === 'published' ? '⌫ UNPUBLISH' : '↑ PUBLISH'}
          </button>
        </div>
      </div>
    </header>
  );
}

// ---- Markdown editor (visual only — mocks CodeMirror) ---------------

function MarkdownEditor() {
  return (
    <div style={{ border: '2px solid var(--color-line-3)', display: 'flex', flexDirection: 'column' }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        padding: '10px 16px', borderBottom: '1px solid var(--color-line-2)',
        background: 'var(--color-surface-1)'
      }}>
        <div style={{ display: 'flex', gap: 16 }}>
          <L color="text-strong">MARKDOWN</L>
          <M>·</M>
          <M>PREVIEW</M>
        </div>
        <div style={{ display: 'flex', gap: 16 }}>
          <M>1,420 WORDS · 12 MIN READ</M>
          <M color="text-strong">[ [ WIKI-LINK ⌘K</M>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr', minHeight: 480 }}>
        {/* Line numbers */}
        <div style={{
          background: 'var(--color-surface-1)',
          borderRight: '1px solid var(--color-line-2)',
          padding: '20px 8px',
          textAlign: 'right',
          fontFamily: '"Space Grotesk", monospace',
          fontSize: 12,
          lineHeight: 1.7,
          color: 'var(--color-text-muted)'
        }}>
          {Array.from({ length: 20 }, (_, i) => <div key={i}>{i + 1}</div>)}
        </div>
        <div style={{
          padding: '20px 24px',
          fontFamily: '"Space Grotesk", monospace',
          fontSize: 14,
          lineHeight: 1.7,
          color: 'var(--color-text)',
          whiteSpace: 'pre-wrap'
        }}>
{`## The setup

I have ~4,200 personal notes embedded with `}<span style={{ background: 'var(--color-accent-100)', color: 'var(--color-accent-900)', padding: '0 4px' }}>text-embedding-3-small</span>{`, stored as
`}<span style={{ color: 'var(--color-accent-700)' }}>vector(1536)</span>{` in pgvector. Every blog post tells you to use cosine
for normalized embeddings — but they all stop there.

## What actually changes

The cosine and inner-product operators ([[038-neon-driver]]) are
mathematically equivalent for unit-length vectors, but they hit
**different HNSW indexes**:

\`\`\`sql
-- index opclasses, not query operators
CREATE INDEX ... USING hnsw (embedding `}<span style={{ color: 'var(--color-accent-700)' }}>vector_cosine_ops</span>{`);
CREATE INDEX ... USING hnsw (embedding `}<span style={{ color: 'var(--color-accent-700)' }}>vector_ip_ops</span>{`);
\`\`\`

Below `}<span style={{ color: 'var(--color-warning)' }}>m=12</span>{`, IP recall fell from 0.94 to 0.81. Cosine held.

> The fix was the index opclass — not the query operator.|`}<span style={{ display: 'inline-block', width: 8, height: 18, background: 'var(--color-accent-700)', verticalAlign: 'middle', marginLeft: -2, animation: 'blink 1s steps(2) infinite' }} />
        </div>
      </div>
      <div style={{
        padding: '8px 16px', borderTop: '1px solid var(--color-line-2)',
        background: 'var(--color-surface-1)',
        display: 'flex', justifyContent: 'space-between'
      }}>
        <M>LN 14 · COL 32</M>
        <M>MARKDOWN · UTF-8 · LF</M>
      </div>
    </div>
  );
}

// ---- AI Critique side panel -----------------------------------------

function CritiquePanel() {
  return (
    <aside style={{
      border: '2px solid var(--color-line-3)',
      background: 'var(--color-surface-2)',
      display: 'flex', flexDirection: 'column'
    }}>
      <div style={{
        padding: '14px 18px', borderBottom: '1px solid var(--color-line-2)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ width: 6, height: 6, background: 'var(--color-accent-700)', display: 'inline-block' }} />
          <L color="text-strong">AI CRITIQUE</L>
        </div>
        <M>GEMINI 2.0 FLASH · FREE</M>
      </div>

      <div style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <M color="text-muted">RUN A QUICK PASS BEFORE PUBLISH. OPTIONAL — NEVER GATES SAVE.</M>

        <div style={{ borderTop: '1px solid var(--color-line-2)' }}>
          {[
            { tag: 'CLARITY', score: 'A', body: 'Thesis lands in the first paragraph. Headings track the argument.' },
            { tag: 'EVIDENCE', score: 'B', body: 'Numbers feel concrete. Consider linking the benchmark script.' },
            { tag: 'TONE', score: 'A', body: 'Reads like a build log, not a tutorial. Stays in voice.' }
          ].map((c, i) => (
            <div key={c.tag} style={{
              padding: '14px 0',
              borderBottom: '1px solid var(--color-line-2)',
              display: 'flex', flexDirection: 'column', gap: 6
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <L color="accent-700">{c.tag}</L>
                <M color="text-strong">{c.score}</M>
              </div>
              <span className="t-body-sm">{c.body}</span>
            </div>
          ))}
        </div>

        <button className="t-label" style={{
          border: '2px solid var(--color-line-3)', padding: '10px 14px',
          color: 'var(--color-text-strong)', textAlign: 'left',
          display: 'flex', justifyContent: 'space-between'
        }}>
          <span>↻ RUN CRITIQUE AGAIN</span>
          <span style={{ color: 'var(--color-text-muted)' }}>~3s</span>
        </button>
      </div>
    </aside>
  );
}

// ---- Tag input -------------------------------------------------------

function TagInput({ tags, onAdd, onRemove }) {
  const [v, setV] = useState('');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {tags.map(t => (
          <span key={t} className="t-meta" style={{
            border: '1px solid var(--color-line-3)',
            padding: '6px 10px',
            display: 'inline-flex', gap: 8, alignItems: 'center',
            color: 'var(--color-text-strong)'
          }}>
            #{t}
            <button onClick={() => onRemove(t)} style={{ color: 'var(--color-text-muted)' }}>×</button>
          </span>
        ))}
        <LineInput
          value={v}
          onChange={setV}
          placeholder="add tag, press ↵"
          mono
          style={{ width: 200, borderBottom: '1px solid var(--color-line-2)' }}
        />
      </div>
      <M>STORED AS text[] ON notes — KEBAB-CASE, LOWERCASE</M>
    </div>
  );
}

// ---- Embedding status ------------------------------------------------

function EmbeddingPanel() {
  return (
    <div style={{
      border: '2px solid var(--color-line-3)',
      display: 'grid', gridTemplateColumns: '1fr 1px 1fr 1px 1fr',
      background: 'var(--color-surface-1)'
    }}>
      <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <L>EMBEDDING STATUS</L>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ width: 8, height: 8, background: 'var(--color-success)' }} />
          <span className="t-h3" style={{ fontSize: 20, color: 'var(--color-success)' }}>FRESH</span>
        </div>
        <M>REGENERATED ON LAST SAVE — vector(1536)</M>
      </div>
      <div style={{ background: 'var(--color-line-2)' }} />
      <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <L>SLUG</L>
        <span className="t-code" style={{ fontSize: 16, color: 'var(--color-text-strong)' }}>pgvector-cosine-vs-inner-product</span>
        <M>AUTO · slugify.ts · IMMUTABLE ONCE PUBLISHED</M>
      </div>
      <div style={{ background: 'var(--color-line-2)' }} />
      <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <L>VERSION</L>
        <span className="t-h3" style={{ fontSize: 20 }}>v7 · 19 APR 2026</span>
        <M>6 PRIOR EDITS · ↻ VIEW HISTORY</M>
      </div>
    </div>
  );
}

// ---- Compose page ----------------------------------------------------

function GAAdmin({ theme = 'light' }) {
  const [status, setStatus] = useState('draft');
  const [title, setTitle] = useState('pgvector cosine vs. inner product, in practice');
  const [takeaway, setTakeaway] = useState('For normalized embeddings, cosine and inner product are mathematically equivalent — but pgvector\u2019s HNSW index opclasses behave very differently under load. Use vector_cosine_ops and tune m before changing operators.');
  const [tags, setTags] = useState(['postgres', 'pgvector', 'rag', 'benchmark']);
  const [category, setCategory] = useState('Databases');

  return (
    <div className={`ga-root ga-theme-${theme} ga-paper`}>
      <style>{`@keyframes blink { 50% { opacity: 0; } }`}</style>
      <AdminBar status={status} onStatusChange={setStatus} />

      <main style={{
        display: 'grid',
        gridTemplateColumns: '1fr 360px',
        borderBottom: '4px solid var(--color-line-3)'
      }}>
        {/* LEFT — form + editor */}
        <div style={{ borderRight: '2px solid var(--color-line-3)', padding: '32px' }}>

          {/* Embedding / slug / version triplet */}
          <EmbeddingPanel />

          <div style={{ marginTop: 32, border: '2px solid var(--color-line-3)', background: 'var(--color-bg)' }}>
            <Field label="TITLE" hint="Headline as it appears in the feed" required>
              <LineInput value={title} onChange={setTitle} placeholder="A clear, specific title" />
            </Field>

            <Field label="TAKEAWAY" hint="Single-sentence summary. Sent to the LLM as context — full body is never sent.">
              <textarea
                value={takeaway}
                onChange={e => setTakeaway(e.target.value)}
                rows={3}
                className="t-body"
                style={{
                  width: '100%',
                  borderBottom: '2px solid var(--color-line-3)',
                  padding: '8px 0',
                  color: 'var(--color-text-strong)',
                  resize: 'vertical'
                }}
              />
            </Field>

            <Field label="CATEGORY" hint="From note-taxonomy.ts canonical list">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {CATEGORIES.map(c => (
                  <button
                    key={c}
                    onClick={() => setCategory(c)}
                    className="t-meta"
                    style={{
                      border: `1px solid ${c === category ? 'var(--color-accent-900)' : 'var(--color-line-2)'}`,
                      background: c === category ? 'var(--color-accent-100)' : 'transparent',
                      color: c === category ? 'var(--color-accent-900)' : 'var(--color-text-muted)',
                      padding: '8px 12px'
                    }}
                  >{c.toUpperCase()}</button>
                ))}
              </div>
            </Field>

            <Field label="TAGS" hint="Free-form, snake/kebab-case">
              <TagInput
                tags={tags}
                onAdd={t => setTags([...tags, t])}
                onRemove={t => setTags(tags.filter(x => x !== t))}
              />
            </Field>
          </div>

          {/* Body editor */}
          <div style={{ marginTop: 32, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <L color="text-strong">BODY · MARKDOWN</L>
              <M>CODEMIRROR 6 · MARKDOWN MODE · WIKI-LINK AUTOCOMPLETE</M>
            </div>
            <MarkdownEditor />
          </div>

          {/* Footer / action restate */}
          <div style={{
            marginTop: 32, borderTop: '2px solid var(--color-line-3)',
            paddingTop: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center'
          }}>
            <div style={{ display: 'flex', gap: 24 }}>
              <M color="text-strong">⌘S SAVE DRAFT</M>
              <M color="text-strong">⌘⏎ PUBLISH</M>
              <M>ESC BACK</M>
            </div>
            <M color="error">⌫ DELETE NOTE — REQUIRES CONFIRM</M>
          </div>
        </div>

        {/* RIGHT — sidebar with critique + index status */}
        <div style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: 24, background: 'var(--color-surface-1)' }}>
          <CritiquePanel />

          {/* Wiki-link autocomplete preview */}
          <div style={{ border: '2px solid var(--color-line-3)', background: 'var(--color-bg)' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-line-2)', display: 'flex', justifyContent: 'space-between' }}>
              <L color="text-strong">[[ WIKI-LINK SUGGEST</L>
              <M>3 MATCHES</M>
            </div>
            <div>
              {[
                { slug: '038-neon-driver', title: 'The Neon serverless driver vs. node-postgres' },
                { slug: '029-overnight-embeds', title: 'Embedding 4,200 notes overnight on a free tier' },
                { slug: '014-hnsw-tuning', title: 'HNSW: m vs ef_construction, by feel' }
              ].map((s, i) => (
                <div key={s.slug} style={{
                  padding: '12px 16px',
                  borderBottom: i < 2 ? '1px solid var(--color-line-1)' : 'none',
                  background: i === 0 ? 'var(--color-accent-100)' : 'transparent',
                  display: 'flex', flexDirection: 'column', gap: 4
                }}>
                  <span className="t-code" style={{ color: i === 0 ? 'var(--color-accent-900)' : 'var(--color-accent-700)' }}>
                    [[{s.slug}]]
                  </span>
                  <span className="t-body-sm" style={{ color: i === 0 ? 'var(--color-accent-900)' : 'var(--color-text)' }}>{s.title}</span>
                </div>
              ))}
            </div>
            <div style={{ padding: '10px 16px', borderTop: '1px solid var(--color-line-2)', display: 'flex', justifyContent: 'space-between' }}>
              <M>↑ ↓ NAVIGATE</M>
              <M>↵ INSERT</M>
            </div>
          </div>

          {/* Linked-from panel */}
          <div style={{ border: '2px solid var(--color-line-3)' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-line-2)' }}>
              <L color="text-strong">LINKED FROM · 4 NOTES</L>
            </div>
            <div>
              {['042 — Vercel previews + workspace deps', '029 — Embedding 4,200 notes overnight', '014 — HNSW: m vs ef_construction', '008 — pgvector intro'].map((s, i, a) => (
                <div key={s} style={{
                  padding: '12px 16px',
                  borderBottom: i < a.length - 1 ? '1px solid var(--color-line-1)' : 'none',
                  display: 'flex', justifyContent: 'space-between'
                }}>
                  <span className="t-body-sm">{s}</span>
                  <M>↗</M>
                </div>
              ))}
            </div>
          </div>

          {/* Publish checklist */}
          <div style={{ border: '2px solid var(--color-line-3)', background: 'var(--color-bg)' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-line-2)' }}>
              <L color="text-strong">PRE-PUBLISH CHECKLIST</L>
            </div>
            {[
              { ok: true, t: 'Title set' },
              { ok: true, t: 'Takeaway present (≤280 chars)' },
              { ok: true, t: 'Category assigned' },
              { ok: true, t: 'At least 1 tag' },
              { ok: true, t: 'Embedding fresh' },
              { ok: false, t: 'Cover image (optional)' }
            ].map((c, i, a) => (
              <div key={c.t} style={{
                padding: '12px 16px',
                borderBottom: i < a.length - 1 ? '1px solid var(--color-line-1)' : 'none',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center'
              }}>
                <span className="t-body-sm" style={{ color: c.ok ? 'var(--color-text-strong)' : 'var(--color-text-muted)' }}>
                  {c.t}
                </span>
                <span className="t-meta" style={{ color: c.ok ? 'var(--color-success)' : 'var(--color-text-muted)' }}>
                  {c.ok ? '✓ OK' : '○ SKIP'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

window.GAAdmin = GAAdmin;
