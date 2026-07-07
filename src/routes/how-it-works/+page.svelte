<script lang="ts">
</script>

<svelte:head>
  <title>How It Works | Glass Atlas</title>
  <meta
    name="description"
    content="How Glass Atlas works: the note-grounded chat, the stack, and the high-level architecture behind the site."
  />
</svelte:head>

<main class="hiw-shell" aria-labelledby="hiw-title">
  <header class="hiw-header">
    <p class="eyebrow">Colophon</p>
    <h1 id="hiw-title">How this site works.</h1>
    <p class="hiw-lede">
      Glass Atlas is an editorial notebook, not a product demo. Every note is written by hand, and
      the chat on the homepage answers only from what has actually been published here. This page
      explains both in plain terms, then goes one layer deeper for anyone curious about the stack
      underneath.
    </p>
  </header>

  <section class="hiw-section" aria-labelledby="hiw-notes-title">
    <h2 id="hiw-notes-title">The notes</h2>
    <p>
      Each note is a piece of structured writing — a concept, a workflow, a decision, a piece of
      practice. Notes carry a category and tags, can link to one another the way a personal wiki
      does, and are organized for browsing and for search on the
      <a href="/notes">notes index</a>.
    </p>
  </section>

  <section class="hiw-section" aria-labelledby="hiw-chat-title">
    <h2 id="hiw-chat-title">The chat</h2>
    <p>
      The chat on the homepage is grounded retrieval, not a general-purpose assistant. A question
      is compared against the published notes using semantic search, the most relevant excerpts are
      assembled into context, and the answer is built from that context. When the notes don't cover
      a question well, the chat says so plainly instead of guessing — it will not answer from
      general knowledge outside what's been published here. Every grounded answer links back to the
      notes it drew from, so the source is always checkable.
    </p>
  </section>

  <section class="hiw-section" aria-labelledby="hiw-stack-title">
    <h2 id="hiw-stack-title">The stack</h2>
    <p>A high-level look at what the site is built with, for anyone who wants the technical version.</p>

    <div class="blueprint-panel">
      <div class="blueprint-panel__header">
        <span class="blueprint-panel__label">Stack</span>
      </div>
      <div class="blueprint-panel__body">
        <dl class="stack-list">
          <div class="stack-row">
            <dt>App framework</dt>
            <dd>SvelteKit + Svelte 5 (runes), TypeScript</dd>
          </div>
          <div class="stack-row">
            <dt>Styling</dt>
            <dd>Tailwind CSS v4, a small custom design token system, Bits UI for accessible primitives</dd>
          </div>
          <div class="stack-row">
            <dt>Database</dt>
            <dd>Neon PostgreSQL with the pgvector extension, accessed through Drizzle ORM</dd>
          </div>
          <div class="stack-row">
            <dt>Language model</dt>
            <dd>OpenRouter for chat completions and embeddings</dd>
          </div>
          <div class="stack-row">
            <dt>Authoring</dt>
            <dd>A protected admin editor (GitHub OAuth via Auth.js) plus an optional local, agent-assisted drafting workflow</dd>
          </div>
          <div class="stack-row">
            <dt>Hosting</dt>
            <dd>Railway, auto-deployed from the main branch</dd>
          </div>
        </dl>
      </div>
    </div>
  </section>

  <section class="hiw-section" aria-labelledby="hiw-architecture-title">
    <h2 id="hiw-architecture-title">How the pieces fit</h2>

    <div class="blueprint-panel">
      <div class="blueprint-panel__header">
        <span class="blueprint-panel__label">Architecture</span>
      </div>
      <div class="blueprint-panel__body">
        <ol class="arch-steps">
          <li>
            <span class="arch-step-num">01</span>
            <div>
              <p class="arch-step-title">Writing a note</p>
              <p>
                A note is written in Markdown, either in the admin editor or through the local
                authoring workflow. On save, an embedding is generated for the note and stored
                alongside it so it can be found by meaning, not just by keyword.
              </p>
            </div>
          </li>
          <li>
            <span class="arch-step-num">02</span>
            <div>
              <p class="arch-step-title">Reading a note</p>
              <p>
                Published notes render as ordinary pages, with related notes, links to and from
                other notes, and a small graph of the note's nearest connections.
              </p>
            </div>
          </li>
          <li>
            <span class="arch-step-num">03</span>
            <div>
              <p class="arch-step-title">Asking the chat</p>
              <p>
                A question is embedded and compared against note content, the closest matches are
                assembled into a compact context, and the language model answers from that context
                — streamed back token by token — with links to the notes it used.
              </p>
            </div>
          </li>
        </ol>
      </div>
    </div>
  </section>

  <footer class="hiw-footer">
    <p>
      Curious what's actually been written? Start at the
      <a href="/notes">notes index</a>
      or just <a href="/">ask the chat</a> a question.
    </p>
  </footer>
</main>

<style>
  .hiw-shell {
    width: min(100%, 900px);
    margin: 0 auto;
    padding: 4rem 3rem 6rem;
  }

  .hiw-header {
    border-top: var(--line-strong) solid var(--color-line-3);
    border-bottom: var(--line-std) solid var(--color-line-3);
    padding: 2rem 0 2.5rem;
    margin-bottom: 3rem;
  }

  .eyebrow {
    margin: 0 0 0.75rem;
    color: var(--color-text-muted);
    font-family: 'Space Grotesk', 'Inter', 'Segoe UI', sans-serif;
    font-size: 0.72rem;
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }

  h1 {
    margin: 0 0 1.25rem;
    color: var(--color-text-strong);
    font-family: 'Space Grotesk', 'Inter', 'Segoe UI', sans-serif;
    font-size: clamp(2.25rem, 6vw, 3.75rem);
    font-weight: 700;
    letter-spacing: -0.03em;
    line-height: 0.98;
  }

  .hiw-lede {
    margin: 0;
    max-width: 60ch;
    color: var(--color-text);
    font-family: 'Literata', Georgia, serif;
    font-size: 1.2rem;
    line-height: 1.65;
  }

  .hiw-section {
    padding: 2.5rem 0;
    border-bottom: var(--line-thin) solid var(--color-line-1);
  }

  .hiw-section:last-of-type {
    border-bottom: none;
  }

  h2 {
    margin: 0 0 1rem;
    color: var(--color-text-strong);
    font-family: 'Space Grotesk', 'Inter', 'Segoe UI', sans-serif;
    font-size: clamp(1.5rem, 3vw, 2rem);
    font-weight: 600;
    letter-spacing: -0.01em;
  }

  .hiw-section p {
    margin: 0 0 1rem;
    max-width: 68ch;
    color: var(--color-text);
    font-family: 'Literata', Georgia, serif;
    font-size: 1.05rem;
    line-height: 1.7;
  }

  .hiw-section p:last-child {
    margin-bottom: 0;
  }

  .hiw-section a {
    color: var(--color-accent-700);
    text-decoration: underline;
  }

  /* Blueprint technical panel recipe: 2px border, uppercase header strip,
     tonal surface, 1px internal rules (see .ga-code-block in app.css for the
     same recipe applied to code fences). */
  .blueprint-panel {
    margin-top: 1.5rem;
    border: var(--line-std) solid var(--color-line-3);
    background: var(--color-surface-2);
  }

  .blueprint-panel__header {
    padding: 0.6rem 1rem;
    border-bottom: var(--line-thin) solid var(--color-line-2);
  }

  .blueprint-panel__label {
    color: var(--color-text-muted);
    font-family: 'Space Grotesk', 'Inter', 'Segoe UI', sans-serif;
    font-size: 0.68rem;
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }

  .blueprint-panel__body {
    padding: 1.25rem 1.5rem 1.5rem;
  }

  .stack-list {
    margin: 0;
    display: grid;
    gap: 0.9rem;
  }

  .stack-row {
    display: grid;
    grid-template-columns: minmax(0, 9rem) 1fr;
    gap: 1rem;
    padding-bottom: 0.9rem;
    border-bottom: var(--line-thin) solid var(--color-line-1);
  }

  .stack-row:last-child {
    padding-bottom: 0;
    border-bottom: none;
  }

  .stack-row dt {
    color: var(--color-text-muted);
    font-family: 'Space Grotesk', 'Inter', 'Segoe UI', sans-serif;
    font-size: 0.7rem;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .stack-row dd {
    margin: 0;
    color: var(--color-text);
    font-family: 'Literata', Georgia, serif;
    font-size: 0.98rem;
    line-height: 1.55;
  }

  .arch-steps {
    margin: 0;
    padding: 0;
    list-style: none;
    display: grid;
    gap: 1.25rem;
  }

  .arch-steps li {
    display: grid;
    grid-template-columns: 2.5rem 1fr;
    gap: 1rem;
    padding-bottom: 1.25rem;
    border-bottom: var(--line-thin) solid var(--color-line-1);
  }

  .arch-steps li:last-child {
    padding-bottom: 0;
    border-bottom: none;
  }

  .arch-step-num {
    color: var(--color-text-muted);
    font-family: 'Space Grotesk', 'Inter', 'Segoe UI', sans-serif;
    font-size: 0.85rem;
    font-weight: 600;
    letter-spacing: 0.05em;
  }

  .arch-step-title {
    margin: 0 0 0.35rem;
    color: var(--color-text-strong);
    font-family: 'Space Grotesk', 'Inter', 'Segoe UI', sans-serif;
    font-size: 0.95rem;
    font-weight: 600;
  }

  .arch-steps p {
    margin: 0;
    color: var(--color-text);
    font-family: 'Literata', Georgia, serif;
    font-size: 0.98rem;
    line-height: 1.6;
  }

  .arch-steps p:last-child {
    margin: 0;
  }

  .arch-steps div p:first-child {
    margin-bottom: 0.35rem;
  }

  .hiw-footer {
    margin-top: 1rem;
    padding-top: 2rem;
    border-top: var(--line-std) solid var(--color-line-3);
  }

  .hiw-footer p {
    margin: 0;
    color: var(--color-text-muted);
    font-family: 'Space Grotesk', 'Inter', 'Segoe UI', sans-serif;
    font-size: 0.85rem;
  }

  .hiw-footer a {
    color: var(--color-accent-700);
    text-decoration: underline;
  }

  @media (max-width: 700px) {
    .hiw-shell {
      padding: 3rem 1.25rem 5rem;
    }

    .stack-row {
      grid-template-columns: 1fr;
      gap: 0.35rem;
    }

    .arch-steps li {
      grid-template-columns: 1fr;
      gap: 0.5rem;
    }
  }
</style>
