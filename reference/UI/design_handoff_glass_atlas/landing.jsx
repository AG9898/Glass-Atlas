/* global React */
const { useState, useMemo } = React;

// =====================================================================
// Glass Atlas — Landing Page artboard
// Implements styleguide.md §2 "Landing" rules:
//   - highest visual expression, asymmetry + offset blocks allowed
//   - hero may break grid; body modules return to structural rhythm
//   - row-first feed (notes index pattern carried over)
//   - dividers at 1/2/4px, 0px radius, sage as single accent
// =====================================================================

const NOTES = [
{
  n: '042',
  cat: 'Build · CI/CD',
  title: 'Why my Vercel previews stopped honoring monorepo workspace deps',
  excerpt: 'Three weeks of phantom 404s on imported packages. The fix was one line in turbo.json — but understanding why it broke required tracing how Vercel resolves the build root.',
  date: '24 APR 2026',
  read: '11 MIN',
  tags: ['vercel', 'turborepo', 'monorepo'],
  accent: false
},
{
  n: '041',
  cat: 'Database · Postgres',
  title: 'pgvector cosine vs. inner product, in practice',
  excerpt: 'Read every blog post. They all say "use cosine for normalized embeddings." Here is what actually changes in recall when you don\u2019t — measured against 4,200 of my own notes.',
  date: '19 APR 2026',
  read: '14 MIN',
  tags: ['postgres', 'pgvector', 'rag'],
  accent: true
},
{
  n: '040',
  cat: 'Process',
  title: 'A note-first workflow, from outliner to public publish',
  excerpt: 'I stopped writing drafts. Every note now starts as a Takeaway sentence and grows from there. Here is the editor, the prompts, and the cadence that made it stick.',
  date: '12 APR 2026',
  read: '9 MIN',
  tags: ['writing', 'workflow'],
  accent: false
},
{
  n: '039',
  cat: 'Auth · OAuth',
  title: 'Auth.js + SvelteKit: the JWT vs DB-session decision, finally',
  excerpt: 'JWT is the default for a reason. But three real problems push toward database sessions, and I hit all of them this month.',
  date: '06 APR 2026',
  read: '7 MIN',
  tags: ['auth', 'sveltekit'],
  accent: false
},
{
  n: '038',
  cat: 'Debugging',
  title: 'The Neon serverless driver vs. node-postgres, told as a bug hunt',
  excerpt: 'Production timed out. Local was fine. The trail led from connection pooling, through TCP keepalive, to a single import line.',
  date: '02 APR 2026',
  read: '12 MIN',
  tags: ['neon', 'postgres', 'serverless'],
  accent: false
}];


const TOPICS = [
{ label: 'Systems', n: 38 },
{ label: 'Databases', n: 24 },
{ label: 'CI/CD', n: 17 },
{ label: 'Auth', n: 11 },
{ label: 'Writing', n: 9 },
{ label: 'Debugging', n: 31 },
{ label: 'RAG & LLMs', n: 14 },
{ label: 'TypeScript', n: 22 }];


// ---- Atoms -----------------------------------------------------------

function Rule({ weight = 1, vertical = false, color = 'line-3', style = {} }) {
  const w = weight === 1 ? 1 : weight === 2 ? 2 : 4;
  const c = `var(--color-${color})`;
  return (
    <div
      style={{
        background: c,
        ...(vertical ? { width: w, alignSelf: 'stretch' } : { height: w, width: '100%' }),
        ...style
      }} />);


}

function Label({ children, color = 'text-muted', style = {} }) {
  return (
    <span className="t-label" style={{ color: `var(--color-${color})`, ...style }}>
      {children}
    </span>);

}

function Meta({ children, color = 'text-muted', style = {} }) {
  return (
    <span className="t-meta" style={{ color: `var(--color-${color})`, ...style }}>
      {children}
    </span>);

}

function Tag({ children }) {
  return (
    <span
      className="t-meta"
      style={{
        color: 'var(--color-text-muted)',
        border: '1px solid var(--color-line-2)',
        padding: '4px 8px',
        whiteSpace: 'nowrap'
      }}>
      
      {children}
    </span>);

}

function Btn({ children, variant = 'line', onClick, style = {} }) {
  const base = {
    padding: '14px 22px',
    cursor: 'pointer',
    transition: 'all .12s ease',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 12,
    whiteSpace: 'nowrap'
  };
  const variants = {
    line: { border: '2px solid var(--color-line-3)', background: 'transparent', color: 'var(--color-text-strong)' },
    fill: { border: '2px solid var(--color-line-3)', background: 'var(--color-line-3)', color: 'var(--color-bg)' },
    accent: { border: '2px solid var(--color-accent-700)', background: 'var(--color-accent-700)', color: 'var(--color-bg)' },
    'accent-line': { border: '2px solid var(--color-accent-700)', background: 'transparent', color: 'var(--color-accent-700)' }
  };
  return (
    <button className="t-label" style={{ ...base, ...variants[variant], ...style, backgroundColor: "rgb(147, 177, 132)" }} onClick={onClick}>
      {children}
    </button>);

}

// ---- Header ----------------------------------------------------------

function Header() {
  return (
    <header style={{ borderBottom: '2px solid var(--color-line-3)' }}>
      {/* Top utility row */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '14px 48px', borderBottom: '1px solid var(--color-line-1)'
      }}>
        <Meta color="text-muted">VOL. 02 — APRIL 2026</Meta>
        <Meta color="text-muted">187 NOTES PUBLISHED · LAST EDIT 2 DAYS AGO</Meta>
        <div style={{ display: 'flex', gap: 18 }}>
          <Meta color="text-muted">RSS</Meta>
          <Meta color="text-muted">LIGHT / DARK</Meta>
        </div>
      </div>

      {/* Brand row */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center',
        padding: '28px 48px', gap: 32
      }}>
        <div style={{ display: 'flex', gap: 32 }}>
          <a className="t-label t-strong" style={{ borderBottom: '2px solid var(--color-line-3)', paddingBottom: 4 }}>NOTES</a>
          <a className="t-label t-muted">CHAT</a>
          <a className="t-label t-muted">TOPICS</a>
          <a className="t-label t-muted">ABOUT</a>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div className="t-display" style={{ fontSize: 44, lineHeight: 1, letterSpacing: '-0.04em' }}>
            Glass&nbsp;Atlas
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 24, alignItems: 'center' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            borderBottom: '1px solid var(--color-line-2)', padding: '6px 0', minWidth: 220
          }}>
            <span className="t-meta t-muted">⌕</span>
            <span className="t-meta t-muted">SEARCH NOTES &nbsp; ⌘K</span>
          </div>
        </div>
      </div>
    </header>);

}

// ---- Hero ------------------------------------------------------------

function Hero() {
  return (
    <section style={{ borderBottom: '4px solid var(--color-line-3)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1px 5fr 1px 4fr', minHeight: 520 }}>
        {/* Left rail: vertical issue marker */}
        <div style={{
          display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
          padding: '32px 16px', writingMode: 'vertical-lr'
        }}>
          <Meta color="text-muted">ISSUE 02 / NOTE 042</Meta>
          <Meta color="text-muted">EST. 2025 — SINGLE AUTHOR</Meta>
        </div>

        <Rule vertical color="line-3" weight={1} />

        {/* Center: headline */}
        <div style={{ padding: '64px 48px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 48 }}>
          <div>
            <Label color="accent-700" style={{ marginBottom: 24, display: 'inline-block' }}>FEATURED · BUILD LOG</Label>
            <h1 className="t-display" style={{ fontSize: 88, lineHeight: 0.93, letterSpacing: '-0.035em', textWrap: 'balance' }}>
              Notes from a developer who would rather&nbsp;
              <span style={{ fontStyle: 'italic', fontFamily: 'Literata', fontWeight: 500 }}>
                show his work
              </span>
              .
            </h1>
          </div>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <Btn variant="line">READ THE LATEST &nbsp; →</Btn>
          </div>
        </div>

        <Rule vertical color="line-3" weight={1} />

        {/* Right: ASK module — the chat affordance front-and-center */}
        <div style={{
          background: 'var(--color-accent-100)',
          padding: '40px 36px',
          display: 'flex', flexDirection: 'column', gap: 20,
          position: 'relative', backgroundColor: "rgb(225, 231, 221)"
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Label color="accent-900">⟶ &nbsp; ASK THE ARCHIVE</Label>
            <Meta color="accent-900">RAG · 187 NOTES INDEXED</Meta>
          </div>

          <p className="t-body" style={{ color: 'var(--color-accent-900)' }}>
            Every answer here is grounded in a real note — with citations. Try a query.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 0, marginTop: 'auto' }}>
            <Rule weight={1} color="accent-700" />
            {[
            'What does Aden think about CI/CD on Railway vs Vercel?',
            'Summarize the pgvector vs. inner-product debate.',
            'How do I scaffold an Auth.js + SvelteKit project?'].
            map((q, i) =>
            <React.Fragment key={i}>
                <div style={{
                padding: '18px 0', display: 'flex', justifyContent: 'space-between',
                alignItems: 'center', gap: 16
              }}>
                  <span className="t-body-sm" style={{ color: 'var(--color-accent-900)', fontStyle: 'italic' }}>"{q}"</span>
                  <span className="t-meta" style={{ color: 'var(--color-accent-700)' }}>→</span>
                </div>
                <Rule weight={1} color="accent-700" />
              </React.Fragment>
            )}
          </div>

          <div style={{
            marginTop: 8, display: 'flex', alignItems: 'center', gap: 12,
            border: '2px solid var(--color-accent-900)', padding: '14px 16px', background: 'var(--color-bg)'
          }}>
            <span className="t-label" style={{ color: 'var(--color-accent-900)' }}>›</span>
            <span className="t-body-sm" style={{ color: 'var(--color-text-muted)' }}>Ask anything grounded in these notes…</span>
            <span className="t-meta" style={{ marginLeft: 'auto', color: 'var(--color-accent-700)' }}>↵</span>
          </div>
        </div>
      </div>
    </section>);

}

// ---- Index meta strip ------------------------------------------------

function MetaStrip() {
  const stats = [
  { k: 'Published notes', v: '187' },
  { k: 'Topics covered', v: '12' },
  { k: 'Avg. words / note', v: '1,420' },
  { k: 'Chat citations served', v: '3,108' }];

  return (
    <section style={{ borderBottom: '2px solid var(--color-line-3)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)' }}>
        {stats.map((s, i) =>
        <div key={s.k} style={{
          padding: '32px 32px',
          borderRight: i < stats.length - 1 ? '1px solid var(--color-line-2)' : 'none',
          display: 'flex', flexDirection: 'column', gap: 12
        }}>
            <Meta>{s.k}</Meta>
            <div className="t-h2" style={{ fontSize: 48, lineHeight: 1 }}>{s.v}</div>
          </div>
        )}
      </div>
    </section>);

}

// ---- Notes feed (row-first, per styleguide §2 Notes Index) -----------

function NoteRow({ note, isFirst, isLast }) {
  return (
    <article
      style={{
        display: 'grid',
        gridTemplateColumns: '120px 1px 1.4fr 1px 2fr 1px 200px',
        alignItems: 'stretch',
        background: note.accent ? 'var(--color-accent-100)' : 'transparent',
        borderTop: isFirst ? '2px solid var(--color-line-3)' : 'none',
        borderBottom: '2px solid var(--color-line-3)'
      }}>
      
      {/* Number column */}
      <div style={{ padding: '36px 24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <Meta color={note.accent ? 'accent-900' : 'text-muted'}>NOTE</Meta>
        <div className="t-h2" style={{ fontSize: 44, lineHeight: 1, color: note.accent ? 'var(--color-accent-900)' : 'var(--color-text-strong)' }}>
          {note.n}
        </div>
      </div>

      <Rule vertical color="line-2" />

      {/* Category + meta */}
      <div style={{ padding: '36px 24px', display: 'flex', flexDirection: 'column', gap: 16, justifyContent: 'space-between' }}>
        <div>
          <Label color={note.accent ? 'accent-900' : 'text-muted'}>{note.cat}</Label>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <Meta color={note.accent ? 'accent-900' : 'text-muted'}>{note.date}</Meta>
          <Meta color={note.accent ? 'accent-700' : 'text-muted'}>{note.read} READ</Meta>
        </div>
      </div>

      <Rule vertical color="line-2" />

      {/* Title + excerpt */}
      <div style={{ padding: '36px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <h3 className="t-h3" style={{
          color: note.accent ? 'var(--color-accent-900)' : 'var(--color-text-strong)',
          textWrap: 'balance'
        }}>{note.title}</h3>
        <p className="t-body-sm" style={{
          color: note.accent ? 'var(--color-accent-900)' : 'var(--color-text)',
          maxWidth: '52ch'
        }}>{note.excerpt}</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
          {note.tags.map((t) => <Tag key={t}>#{t}</Tag>)}
        </div>
      </div>

      <Rule vertical color="line-2" />

      {/* CTA column */}
      <div style={{
        padding: '36px 24px',
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        alignItems: 'flex-start', gap: 16
      }}>
        <Meta color={note.accent ? 'accent-900' : 'text-muted'}>
          {note.accent ? '★ EDITOR\u2019S PICK' : 'OPEN ↗'}
        </Meta>
        <span className="t-label" style={{
          borderBottom: `2px solid ${note.accent ? 'var(--color-accent-900)' : 'var(--color-line-3)'}`,
          paddingBottom: 6,
          color: note.accent ? 'var(--color-accent-900)' : 'var(--color-text-strong)'
        }}>READ NOTE</span>
      </div>
    </article>);

}

function NotesFeed() {
  return (
    <section>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
        padding: '64px 48px 32px'
      }}>
        <div>
          <Label color="accent-700" style={{ marginBottom: 16, display: 'inline-block' }}>SECTION 01 — RECENT NOTES</Label>
          <h2 className="t-h1" style={{ fontSize: 56 }}>The latest field notes.</h2>
        </div>
        <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
          <Meta>SORT — NEWEST FIRST</Meta>
          <Meta>FILTER — ALL TOPICS ↓</Meta>
        </div>
      </div>
      <div>
        {NOTES.map((n, i) =>
        <NoteRow key={n.n} note={n} isFirst={i === 0} isLast={i === NOTES.length - 1} />
        )}
      </div>
      <div style={{ padding: '32px 48px', display: 'flex', justifyContent: 'space-between', borderBottom: '4px solid var(--color-line-3)' }}>
        <Meta>SHOWING 5 OF 187</Meta>
        <Meta color="text-strong">VIEW ALL NOTES &nbsp; →</Meta>
      </div>
    </section>);

}

// ---- Topics + about (asymmetric breakout) ----------------------------

function TopicsAndAuthor() {
  return (
    <section style={{ borderBottom: '2px solid var(--color-line-3)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '7fr 1px 5fr', minHeight: 540 }}>
        {/* Left — topics list */}
        <div style={{ padding: '64px 48px', display: 'flex', flexDirection: 'column', gap: 40 }}>
          <div>
            <Label color="accent-700" style={{ marginBottom: 16, display: 'inline-block' }}>SECTION 02 — TOPICS</Label>
            <h2 className="t-h1" style={{ fontSize: 56 }}>Browse by what you came for.</h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)' }}>
            {TOPICS.map((t, i) =>
            <a key={t.label} style={{
              padding: '24px 16px',
              borderTop: '1px solid var(--color-line-2)',
              borderBottom: i >= TOPICS.length - 2 ? '1px solid var(--color-line-2)' : 'none',
              borderRight: i % 2 === 0 ? '1px solid var(--color-line-2)' : 'none',
              display: 'flex', justifyContent: 'space-between', alignItems: 'baseline'
            }}>
                <span className="t-h3" style={{ fontSize: 24 }}>{t.label}</span>
                <Meta>{t.n} NOTES</Meta>
              </a>
            )}
          </div>
        </div>

        <Rule vertical color="line-3" weight={1} />

        {/* Right — author block, an offset overlap-style module */}
        <div style={{ padding: '64px 48px', display: 'flex', flexDirection: 'column', gap: 32, position: 'relative' }}>
          <Label color="accent-700">ABOUT THE AUTHOR</Label>

          <div style={{
            border: '2px solid var(--color-line-3)',
            background: 'var(--color-surface-1)',
            padding: '24px',
            display: 'flex', gap: 20,
            transform: 'translateY(-4px)'
          }}>
            <div className="ga-placeholder" style={{ width: 96, height: 96, flex: '0 0 auto' }}>
              <span className="t-label">PHOTO</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span className="t-h3" style={{ fontSize: 22 }}>Aden Guo</span>
              <Meta>SOFTWARE DEVELOPER · CALGARY → REMOTE</Meta>
              <p className="t-body-sm t-muted" style={{ marginTop: 8 }}>
                Building Glass Atlas in public. Mostly Postgres, SvelteKit, and the slow craft of writing things down.
              </p>
            </div>
          </div>

          <p className="t-body-lg">
            Glass Atlas is a single-author notebook. Not a portfolio, not a tutorial site — a record of what I&apos;ve actually shipped, debugged, and learned, with the chat trained only on those notes.
          </p>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <Btn variant="line">FULL COLOPHON</Btn>
            <Btn variant="accent-line">FOLLOW ON GITHUB</Btn>
          </div>
        </div>
      </div>
    </section>);

}

// ---- Footer ----------------------------------------------------------

function Footer() {
  return (
    <footer style={{ padding: '48px 48px 64px', display: 'flex', flexDirection: 'column', gap: 32 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 48 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <span className="t-display" style={{ fontSize: 32 }}>Glass Atlas</span>
          <p className="t-body-sm t-muted" style={{ maxWidth: '40ch' }}>
            Notes from a software developer, indexed and queryable. Soft Editorial Brutalism, single accent, sharp corners.
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Label>BROWSE</Label>
          <a className="t-body-sm">All notes</a>
          <a className="t-body-sm">Topics</a>
          <a className="t-body-sm">Chat</a>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Label>ELSEWHERE</Label>
          <a className="t-body-sm">GitHub</a>
          <a className="t-body-sm">Bluesky</a>
          <a className="t-body-sm">RSS feed</a>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Label>COLOPHON</Label>
          <a className="t-body-sm">Stack</a>
          <a className="t-body-sm">Style guide</a>
          <a className="t-body-sm">Privacy</a>
        </div>
      </div>
      <Rule weight={1} color="line-2" />
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <Meta>© 2026 ADEN GUO · ALL NOTES SOURCED, ALL ANSWERS GROUNDED.</Meta>
        <Meta>BUILT IN SVELTEKIT · DEPLOYED ON RAILWAY</Meta>
      </div>
    </footer>);

}

// ---- Compose ---------------------------------------------------------

function GALanding({ theme = 'light' }) {
  return (
    <div className={`ga-root ga-theme-${theme} ga-paper`}>
      <Header />
      <Hero />
      <MetaStrip />
      <NotesFeed />
      <TopicsAndAuthor />
      <Footer />
    </div>);

}

window.GALanding = GALanding;