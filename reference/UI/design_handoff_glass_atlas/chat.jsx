/* global React */
const { useState, useRef, useEffect } = React;

// =====================================================================
// Glass Atlas — Chat Page artboard
// Implements styleguide.md §5.4 "Chat Surface":
//   - structural but calm; strong typography + divider language
//   - user/assistant differentiation via subtle surface tone shifts (NOT bubbles)
//   - citations and source links use label/meta type with line-bound containers
//   - row-first, line-led; 0px radius
// =====================================================================

const SAMPLE_HISTORY = [
  { id: 1, t: 'TODAY', items: [
    { q: 'pgvector cosine vs inner product, in practice', n: 7 },
    { q: 'How do I scaffold an Auth.js + SvelteKit project?', n: 4 }
  ]},
  { id: 2, t: 'THIS WEEK', items: [
    { q: 'Railway vs Vercel for SvelteKit', n: 9 },
    { q: 'Server-sent events vs WebSockets for chat', n: 5 },
    { q: 'When to reach for Drizzle\u2019s raw sql template', n: 3 }
  ]},
  { id: 3, t: 'EARLIER', items: [
    { q: 'Note-first writing workflow', n: 6 },
    { q: 'Embedding regeneration on note edit', n: 2 }
  ]}
];

const CITED_NOTES = [
  { n: '041', title: 'pgvector cosine vs. inner product, in practice', date: '19 APR 2026', score: 0.91 },
  { n: '038', title: 'The Neon serverless driver vs. node-postgres, told as a bug hunt', date: '02 APR 2026', score: 0.74 },
  { n: '029', title: 'Embedding 4,200 notes overnight on a free tier', date: '11 MAR 2026', score: 0.68 }
];

function L({ children, color = 'text-muted', style = {} }) {
  return <span className="t-label" style={{ color: `var(--color-${color})`, ...style }}>{children}</span>;
}
function M({ children, color = 'text-muted', style = {} }) {
  return <span className="t-meta" style={{ color: `var(--color-${color})`, ...style }}>{children}</span>;
}
function Rule({ w = 1, vertical = false, color = 'line-2', style = {} }) {
  const px = w === 1 ? 1 : w === 2 ? 2 : 4;
  return <div style={{ background: `var(--color-${color})`, ...(vertical ? { width: px, alignSelf: 'stretch' } : { height: px, width: '100%' }), ...style }} />;
}

// ---- Sidebar (chat history) -----------------------------------------

function Sidebar() {
  return (
    <aside style={{
      borderRight: '2px solid var(--color-line-3)',
      display: 'flex', flexDirection: 'column',
      background: 'var(--color-surface-1)'
    }}>
      {/* Brand row */}
      <div style={{ padding: '20px 24px', borderBottom: '2px solid var(--color-line-3)' }}>
        <div className="t-display" style={{ fontSize: 22, lineHeight: 1, letterSpacing: '-0.03em' }}>Glass Atlas</div>
        <M style={{ marginTop: 6, display: 'block' }}>ASK THE ARCHIVE · 187 NOTES</M>
      </div>

      {/* New conversation */}
      <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--color-line-2)' }}>
        <button className="t-label" style={{
          width: '100%', textAlign: 'left',
          border: '2px solid var(--color-line-3)', padding: '14px 16px',
          color: 'var(--color-text-strong)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }}>
          <span>+ &nbsp; NEW CONVERSATION</span>
          <span style={{ color: 'var(--color-text-muted)' }}>⌘N</span>
        </button>
      </div>

      {/* History list */}
      <div className="ga-scroll" style={{ flex: 1, overflowY: 'auto', padding: '16px 0' }}>
        {SAMPLE_HISTORY.map((g, gi) => (
          <div key={g.id} style={{ marginBottom: 8 }}>
            <div style={{ padding: '12px 24px 8px' }}>
              <L>{g.t}</L>
            </div>
            {g.items.map((it, i) => (
              <a key={i} style={{
                display: 'block',
                padding: '14px 24px',
                borderTop: '1px solid var(--color-line-1)',
                borderBottom: i === g.items.length - 1 ? '1px solid var(--color-line-1)' : 'none',
                background: gi === 0 && i === 0 ? 'var(--color-accent-100)' : 'transparent',
                cursor: 'pointer'
              }}>
                <div className="t-body-sm" style={{
                  color: gi === 0 && i === 0 ? 'var(--color-accent-900)' : 'var(--color-text-strong)',
                  marginBottom: 4,
                  display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden'
                }}>{it.q}</div>
                <M color={gi === 0 && i === 0 ? 'accent-700' : 'text-muted'}>{it.n} TURNS · GROUNDED</M>
              </a>
            ))}
          </div>
        ))}
      </div>

      {/* Rate-limit footer */}
      <div style={{
        borderTop: '2px solid var(--color-line-3)', padding: '20px 24px',
        display: 'flex', flexDirection: 'column', gap: 12,
        background: 'var(--color-surface-2)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <L>RATE LIMIT</L>
          <M color="text-strong">7 / 10</M>
        </div>
        <div style={{ height: 4, background: 'var(--color-line-1)', position: 'relative' }}>
          <div style={{ position: 'absolute', inset: 0, width: '70%', background: 'var(--color-accent-700)' }} />
        </div>
        <M>RESETS IN 47 MIN — 10 MSG / IP / HOUR</M>
      </div>
    </aside>
  );
}

// ---- User message (subtle surface shift, no bubbles) ----------------

function UserMsg({ children }) {
  return (
    <article style={{
      borderTop: '2px solid var(--color-line-3)',
      borderBottom: '1px solid var(--color-line-2)',
      background: 'var(--color-surface-1)',
      padding: '32px 64px',
      display: 'grid', gridTemplateColumns: '120px 1fr 120px', gap: 32
    }}>
      <L color="text-strong">YOU →</L>
      <p className="t-body-lg t-strong" style={{ textWrap: 'pretty' }}>{children}</p>
      <M style={{ textAlign: 'right' }}>14:22 · TODAY</M>
    </article>
  );
}

// ---- Assistant response with grounded citations ---------------------

function AssistantMsg() {
  return (
    <article style={{
      borderBottom: '2px solid var(--color-line-3)',
      padding: '32px 64px 48px'
    }}>
      <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr 200px', gap: 32, marginBottom: 24 }}>
        <L color="accent-700">ATLAS ⟶</L>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ width: 8, height: 8, background: 'var(--color-accent-700)', display: 'inline-block' }} />
          <M color="accent-700">GROUNDED IN 3 NOTES — GEMINI FLASH</M>
        </div>
        <M style={{ textAlign: 'right' }}>STREAMED · 1.4s</M>
      </div>

      {/* Body */}
      <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr 200px', gap: 32 }}>
        <div />
        <div className="t-body-lg" style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: '64ch' }}>
          <p style={{ textWrap: 'pretty' }}>
            For normalized embeddings — which the OpenRouter pipeline returns by default — cosine and inner product are <em>mathematically equivalent</em>, but pgvector indexes them differently. The practical difference shows up in <span style={{ background: 'var(--color-accent-100)', color: 'var(--color-accent-900)', padding: '0 4px' }}>recall under HNSW</span>, not in similarity scores.
          </p>
          <p style={{ textWrap: 'pretty' }}>
            In Note 041, I measured this against 4,200 personal notes: cosine kept top-10 recall at 0.94 even when m=8, while inner-product fell to 0.81 below m=12. The fix was switching the index opclass — not the query operator.
          </p>

          {/* Inline blueprint panel — code/diagram per styleguide §5.6 */}
          <div style={{ border: '2px solid var(--color-line-3)', background: 'var(--color-surface-2)', marginTop: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 16px', borderBottom: '1px solid var(--color-line-2)' }}>
              <L>SQL · DRIZZLE</L>
              <M>FROM NOTE 041 · §3</M>
            </div>
            <pre className="t-code" style={{
              margin: 0, padding: '20px 16px',
              fontFamily: '"Space Grotesk", monospace',
              fontSize: 13, lineHeight: 1.6,
              color: 'var(--color-text-strong)',
              whiteSpace: 'pre-wrap'
            }}>
{`-- HNSW index using cosine ops:
CREATE INDEX notes_emb_hnsw
  ON glass_atlas.notes
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Query (Drizzle sql\`\`):
sql\`SELECT slug, 1 - (embedding <=> \${q}) AS score
    FROM glass_atlas.notes
    ORDER BY embedding <=> \${q} LIMIT 8\`;`}
            </pre>
          </div>

          <p style={{ textWrap: 'pretty' }}>
            Short answer: stick with cosine (<code className="t-code" style={{ background: 'var(--color-surface-2)', padding: '2px 6px', border: '1px solid var(--color-line-2)' }}>{'<=>'}</code>) and tune <code className="t-code" style={{ background: 'var(--color-surface-2)', padding: '2px 6px', border: '1px solid var(--color-line-2)' }}>m</code> upward before changing operators.
          </p>
        </div>

        {/* Right rail — citation index */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <L>CITED NOTES</L>
          <div style={{ borderTop: '1px solid var(--color-line-2)' }}>
            {CITED_NOTES.map((c, i) => (
              <div key={c.n} style={{
                padding: '14px 0', borderBottom: '1px solid var(--color-line-2)',
                display: 'flex', flexDirection: 'column', gap: 4
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <M color="accent-700">NOTE {c.n}</M>
                  <M>↗</M>
                </div>
                <span className="t-body-sm t-strong" style={{ lineHeight: 1.35, fontSize: 14 }}>{c.title}</span>
                <M>{c.date} · MATCH {c.score.toFixed(2)}</M>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Action row */}
      <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr 200px', gap: 32, marginTop: 32 }}>
        <div />
        <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
          <button className="t-meta" style={{ color: 'var(--color-text-muted)', borderBottom: '1px solid var(--color-line-2)', paddingBottom: 4 }}>↻ REGENERATE</button>
          <button className="t-meta" style={{ color: 'var(--color-text-muted)', borderBottom: '1px solid var(--color-line-2)', paddingBottom: 4 }}>⧉ COPY</button>
          <button className="t-meta" style={{ color: 'var(--color-text-muted)', borderBottom: '1px solid var(--color-line-2)', paddingBottom: 4 }}>+ SAVE TO NOTES</button>
          <M>HELPFUL?  [Y] [N]</M>
        </div>
        <div />
      </div>
    </article>
  );
}

// ---- Out-of-scope refusal example (styleguide: chat declines) -------

function RefusalMsg() {
  return (
    <article style={{
      borderBottom: '2px solid var(--color-line-3)',
      padding: '24px 64px 32px',
      background: 'var(--color-surface-1)'
    }}>
      <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr 200px', gap: 32 }}>
        <L color="warning">ATLAS ⟶</L>
        <div className="t-body" style={{ maxWidth: '64ch' }}>
          <p>I don&apos;t have a note on Kubernetes operators. The archive only answers from notes that have been published, and that topic isn&apos;t covered yet.</p>
          <div style={{ marginTop: 12, display: 'flex', gap: 16 }}>
            <M color="text-strong">CLOSEST MATCHES &nbsp; →</M>
            <M color="accent-700">NOTE 028 · CONTAINER ORCHESTRATION ON RAILWAY</M>
          </div>
        </div>
        <M style={{ textAlign: 'right' }}>NO MATCH · 0.31 SCORE</M>
      </div>
    </article>
  );
}

// ---- Composer (line-led input, no rounded corners) ------------------

function Composer() {
  const [v, setV] = useState('');
  return (
    <div style={{ borderTop: '4px solid var(--color-line-3)', background: 'var(--color-surface-1)', padding: '24px 64px 32px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr 200px', gap: 32, alignItems: 'flex-end' }}>
        <L color="text-strong">YOU →</L>
        <div style={{
          border: '2px solid var(--color-line-3)',
          background: 'var(--color-bg)',
          display: 'flex', flexDirection: 'column'
        }}>
          <textarea
            value={v}
            onChange={e => setV(e.target.value)}
            placeholder="Ask anything grounded in the archive…"
            rows={3}
            className="t-body"
            style={{
              padding: '18px 20px',
              resize: 'none',
              minHeight: 90,
              color: 'var(--color-text-strong)'
            }}
          />
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '12px 20px', borderTop: '1px solid var(--color-line-2)'
          }}>
            <div style={{ display: 'flex', gap: 16 }}>
              <M>↑ HISTORY</M>
              <M>⌘↵ SEND</M>
              <M>ESC CLEAR</M>
            </div>
            <button className="t-label" style={{
              border: '2px solid var(--color-accent-900)',
              background: 'var(--color-accent-700)',
              color: 'var(--color-bg)',
              padding: '10px 20px'
            }}>SEND ⟶</button>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
          <M>STREAMING · SSE</M>
          <M>10 MSG / IP / HOUR</M>
        </div>
      </div>

      {/* Suggestion chips (line-only, sharp) */}
      <div style={{
        display: 'grid', gridTemplateColumns: '120px 1fr 200px', gap: 32, marginTop: 20
      }}>
        <L>TRY ASKING</L>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {[
            'What does Aden know about CI/CD?',
            'When does he reach for Drizzle\u2019s sql tag?',
            'Show notes on writing workflow.',
            'Compare Railway vs Vercel.'
          ].map(s => (
            <button key={s} className="t-meta" style={{
              border: '1px solid var(--color-line-2)',
              padding: '8px 12px',
              color: 'var(--color-text-muted)'
            }}>{s}</button>
          ))}
        </div>
        <div />
      </div>
    </div>
  );
}

// ---- Top bar inside the chat surface --------------------------------

function ChatTopBar() {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '20px 64px', borderBottom: '2px solid var(--color-line-3)'
    }}>
      <div style={{ display: 'flex', gap: 32, alignItems: 'baseline' }}>
        <L>CONVERSATION</L>
        <span className="t-h3" style={{ fontSize: 22 }}>pgvector cosine vs inner product, in practice</span>
      </div>
      <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
        <M>7 TURNS</M>
        <M>3 NOTES CITED</M>
        <M color="text-strong">⤓ EXPORT</M>
        <M color="text-strong">⌫ CLEAR</M>
      </div>
    </div>
  );
}

// ---- Compose page ----------------------------------------------------

function GAChat({ theme = 'light' }) {
  return (
    <div className={`ga-root ga-theme-${theme} ga-paper`} style={{ display: 'grid', gridTemplateColumns: '320px 1fr', minHeight: 1200 }}>
      <Sidebar />
      <section style={{ display: 'flex', flexDirection: 'column' }}>
        <ChatTopBar />
        <div className="ga-scroll" style={{ flex: 1 }}>
          <UserMsg>How does pgvector cosine compare to inner product when I&apos;m using normalized embeddings? Is there ever a reason to switch?</UserMsg>
          <AssistantMsg />
          <UserMsg>Got it — what about Kubernetes operators for managing the index lifecycle?</UserMsg>
          <RefusalMsg />
        </div>
        <Composer />
      </section>
    </div>
  );
}

window.GAChat = GAChat;
