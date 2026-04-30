<script lang="ts">
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  const { note, bodyHtml, allPublished, relatedNotes } = $derived(data);

  const dateFormatter = new Intl.DateTimeFormat('en', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const shortDateFormatter = new Intl.DateTimeFormat('en', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  const formattedDate = $derived(
    note.publishedAt ? dateFormatter.format(note.publishedAt) : null,
  );

  const shortDate = $derived(
    note.publishedAt ? shortDateFormatter.format(note.publishedAt) : null,
  );

  function firstSentence(text: string): string {
    const normalized = text.replace(/\s+/g, ' ').trim();
    if (!normalized) return '';
    const match = normalized.match(/^(.+?[.!?])(?:\s|$)/);
    return (match?.[1] ?? normalized).trim();
  }

  const metaDescription = $derived(firstSentence(note.body) || note.title);

  const isVideo = $derived(note.mediaType === 'video-mp4');

</script>

<svelte:head>
  <title>{note.title} | Glass Atlas</title>
  <meta name="description" content={metaDescription} />
</svelte:head>

<div class="note-viewer">

  <!-- -----------------------------------------------------------------------
   * Left sidebar: NEW CONVERSATION CTA + notes catalog
   * --------------------------------------------------------------------- -->
  <aside class="sidebar-left" aria-label="Notes catalog">

    <div class="sidebar-left__cta-wrap">
      <a href="/" class="sidebar-left__cta ga-btn ga-btn-sm">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true"
          stroke="currentColor" stroke-width="1.5" stroke-linecap="square">
          <path d="M1 6h10M6 1v10" />
        </svg>
        NEW CONVERSATION
      </a>
    </div>

    <nav class="sidebar-left__catalog" aria-label="All published notes">
      <p class="sidebar-left__catalog-label">TODAY</p>
      <ul class="sidebar-left__note-list">
        {#each allPublished as n (n.slug)}
          <li class="sidebar-left__note-item {n.slug === note.slug ? 'sidebar-left__note-item--active' : ''}">
            <a href="/notes/{n.slug}" class="sidebar-left__note-link">
              <span class="sidebar-left__note-title">{n.title}</span>
              {#if n.tags && n.tags.length > 0}
                <span class="sidebar-left__note-tags">{n.tags.slice(0, 2).join(' · ')}</span>
              {/if}
            </a>
          </li>
        {/each}
      </ul>
    </nav>

  </aside>

  <!-- -----------------------------------------------------------------------
   * Main column: cover + header + body
   * --------------------------------------------------------------------- -->
  <main class="note-main" aria-labelledby="note-title">

    {#if note.image}
      <div class="cover-media">
        {#if isVideo}
          <video
            src={note.image}
            controls
            preload="metadata"
            aria-label="Cover video for {note.title}"
          >
            <track kind="captions" />
          </video>
        {:else}
          <img src={note.image} alt="Cover for {note.title}" />
        {/if}
      </div>
    {/if}

    <header class="note-header">
      {#if note.category}
        <p class="eyebrow">{note.category}</p>
      {/if}

      <h1 id="note-title" class="note-title">{note.title}</h1>

      <div class="note-meta">
        {#if formattedDate}
          <time class="note-date" datetime={note.publishedAt?.toISOString() ?? ''}>
            {formattedDate}
          </time>
        {/if}
        {#if note.series}
          <span class="note-series">{note.series}</span>
        {/if}
      </div>

      {#if note.tags && note.tags.length > 0}
        <div class="tag-list" aria-label="Tags">
          {#each note.tags as tag (tag)}
            <span class="tag-badge">#{tag}</span>
          {/each}
        </div>
      {/if}

      {#if note.takeaway}
        <p class="note-takeaway">{note.takeaway}</p>
      {/if}
    </header>

    <div class="note-body prose">
      <!-- eslint-disable-next-line svelte/no-at-html-tags -->
      {@html bodyHtml}
    </div>

  </main>

  <!-- -----------------------------------------------------------------------
   * Right sidebar: related notes + cite section
   * --------------------------------------------------------------------- -->
  <aside class="sidebar-right" aria-label="Related notes and citation">

    {#if relatedNotes.length > 0}
      <section class="sidebar-right__section">
        <h2 class="sidebar-right__section-label">OTHER NOTES</h2>
        <ul class="sidebar-right__related-list">
          {#each relatedNotes as related (related.slug)}
            <li class="sidebar-right__related-item">
              <a href="/notes/{related.slug}" class="sidebar-right__related-link">
                <span class="sidebar-right__related-title">{related.title}</span>
                {#if related.publishedAt}
                  <time
                    class="sidebar-right__related-date"
                    datetime={related.publishedAt.toISOString()}
                  >
                    {shortDateFormatter.format(related.publishedAt)}
                  </time>
                {/if}
              </a>
            </li>
          {/each}
        </ul>
      </section>
    {/if}

    <section class="sidebar-right__section sidebar-right__cite">
      <h2 class="sidebar-right__section-label">CITE THIS NOTE</h2>
      <dl class="sidebar-right__cite-list">
        <div class="sidebar-right__cite-row">
          <dt class="sidebar-right__cite-key">SLUG</dt>
          <dd class="sidebar-right__cite-value sidebar-right__cite-mono">{note.slug}</dd>
        </div>
        {#if shortDate}
          <div class="sidebar-right__cite-row">
            <dt class="sidebar-right__cite-key">DATE</dt>
            <dd class="sidebar-right__cite-value">{shortDate}</dd>
          </div>
        {/if}
        <div class="sidebar-right__cite-row">
          <dt class="sidebar-right__cite-key">URL</dt>
          <dd class="sidebar-right__cite-value sidebar-right__cite-mono sidebar-right__cite-url">
            /notes/{note.slug}
          </dd>
        </div>
      </dl>
    </section>

  </aside>

</div>

<style>
  /* -------------------------------------------------------------------------
   * Three-column wrapper
   * ----------------------------------------------------------------------- */
  .note-viewer {
    display: grid;
    grid-template-columns: 220px minmax(0, 1fr) 200px;
    grid-template-areas: "left main right";
    align-items: start;
    min-height: calc(100vh - 120px);
    max-width: 1440px;
    margin: 0 auto;
  }

  /* -------------------------------------------------------------------------
   * Left sidebar — notes catalog
   * ----------------------------------------------------------------------- */
  .sidebar-left {
    grid-area: left;
    position: sticky;
    top: 0;
    max-height: 100vh;
    overflow-y: auto;
    border-right: var(--line-std) solid var(--color-line-3);
    display: flex;
    flex-direction: column;
  }

  .sidebar-left__cta-wrap {
    padding: 1.25rem 1rem;
    border-bottom: var(--line-thin) solid var(--color-line-1);
  }

  .sidebar-left__cta {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    width: 100%;
    justify-content: center;
    text-decoration: none;
    border-color: var(--color-line-3);
    color: var(--color-text-strong);
    font-size: 0.68rem;
    letter-spacing: 0.1em;
  }

  .sidebar-left__cta:hover {
    background: var(--color-surface-2);
  }

  .sidebar-left__catalog {
    padding: 1rem 0;
    flex: 1;
  }

  .sidebar-left__catalog-label {
    margin: 0 0 0.5rem;
    padding: 0 1rem;
    color: var(--color-text-muted);
    font-family: 'Space Grotesk', 'Inter', 'Segoe UI', sans-serif;
    font-size: 0.6rem;
    font-weight: 600;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  .sidebar-left__note-list {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .sidebar-left__note-item {
    border-bottom: var(--line-thin) solid var(--color-line-1);
  }

  .sidebar-left__note-item--active {
    background: var(--color-surface-1);
    border-left: var(--line-strong) solid var(--color-accent-700);
  }

  .sidebar-left__note-link {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    padding: 0.65rem 1rem;
    text-decoration: none;
    transition: background 100ms ease;
  }

  .sidebar-left__note-item--active .sidebar-left__note-link {
    padding-left: calc(1rem - var(--line-strong));
  }

  .sidebar-left__note-link:hover {
    background: var(--color-surface-1);
  }

  .sidebar-left__note-title {
    color: var(--color-text-strong);
    font-family: 'Space Grotesk', 'Inter', 'Segoe UI', sans-serif;
    font-size: 0.72rem;
    font-weight: 600;
    line-height: 1.3;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .sidebar-left__note-item--active .sidebar-left__note-title {
    color: var(--color-accent-700);
  }

  .sidebar-left__note-tags {
    color: var(--color-text-muted);
    font-family: 'Space Grotesk', 'Inter', 'Segoe UI', sans-serif;
    font-size: 0.6rem;
    font-weight: 500;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  /* -------------------------------------------------------------------------
   * Main column
   * ----------------------------------------------------------------------- */
  .note-main {
    grid-area: main;
    min-width: 0;
    padding-bottom: 6rem;
  }

  /* Cover media — full-width, 16/9 */
  .cover-media {
    width: 100%;
    aspect-ratio: 16 / 9;
    overflow: hidden;
  }

  .cover-media img,
  .cover-media video {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  /* Header */
  .note-header {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    border-top: var(--line-strong) solid var(--color-line-3);
    border-bottom: var(--line-std) solid var(--color-line-3);
    padding: 2.5rem 3rem;
  }

  .eyebrow {
    margin: 0;
    color: var(--color-text-muted);
    font-family: 'Space Grotesk', 'Inter', 'Segoe UI', sans-serif;
    font-size: 0.72rem;
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }

  .note-title {
    margin: 0;
    color: var(--color-text-strong);
    font-family: 'Space Grotesk', 'Inter', 'Segoe UI', sans-serif;
    font-size: clamp(2rem, 4vw, 3.25rem);
    font-weight: 700;
    letter-spacing: -0.03em;
    line-height: 1;
  }

  .note-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 1.25rem;
    align-items: center;
  }

  .note-date,
  .note-series {
    color: var(--color-text-muted);
    font-family: 'Space Grotesk', 'Inter', 'Segoe UI', sans-serif;
    font-size: 0.72rem;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .note-series {
    border-left: var(--line-std) solid var(--color-line-2);
    padding-left: 1.25rem;
  }

  .tag-list {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
  }

  .tag-badge {
    border: var(--line-thin) solid var(--color-line-2);
    color: var(--color-text-muted);
    font-family: 'Space Grotesk', 'Inter', 'Segoe UI', sans-serif;
    font-size: 0.65rem;
    font-weight: 600;
    letter-spacing: 0.08em;
    padding: 0.2rem 0.5rem;
    text-transform: uppercase;
  }

  .note-takeaway {
    margin: 0;
    border-left: var(--line-strong) solid var(--color-accent-700);
    color: var(--color-text);
    font-family: 'Literata', Georgia, serif;
    font-size: 1.15rem;
    font-style: italic;
    line-height: 1.6;
    padding-left: 1.25rem;
  }

  /* Prose body */
  .note-body {
    padding: 3rem 3rem 0;
    max-width: 72ch;
  }

  .note-body :global(h1),
  .note-body :global(h2),
  .note-body :global(h3),
  .note-body :global(h4) {
    color: var(--color-text-strong);
    font-family: 'Space Grotesk', 'Inter', 'Segoe UI', sans-serif;
    font-weight: 700;
    letter-spacing: -0.02em;
    line-height: 1.15;
    margin: 2.5rem 0 0.75rem;
  }

  .note-body :global(h1) { font-size: 2rem; }
  .note-body :global(h2) { font-size: 1.65rem; }
  .note-body :global(h3) { font-size: 1.35rem; }
  .note-body :global(h4) { font-size: 1.1rem; }

  .note-body :global(p) {
    color: var(--color-text);
    font-family: 'Literata', Georgia, serif;
    font-size: 1.125rem;
    line-height: 1.75;
    margin: 0 0 1.25rem;
  }

  .note-body :global(a) {
    color: var(--color-accent-700);
    text-decoration: underline;
    text-underline-offset: 3px;
  }

  .note-body :global(a:hover) {
    color: var(--color-accent-900);
  }

  .note-body :global(code) {
    background: var(--color-surface-2);
    border: var(--line-thin) solid var(--color-line-1);
    border-radius: 0;
    font-family: 'Fira Code', 'Cascadia Code', 'Courier New', monospace;
    font-size: 0.88em;
    padding: 0.1em 0.35em;
  }

  .note-body :global(pre) {
    margin: 1.5rem 0;
    overflow-x: auto;
    padding: 1.25rem 1.5rem;
  }

  .note-body :global(pre code) {
    background: none;
    border: none;
    font-size: 0.875rem;
    padding: 0;
  }

  .note-body :global(blockquote) {
    border-left: var(--line-strong) solid var(--color-accent-700);
    color: var(--color-text-muted);
    font-family: 'Literata', Georgia, serif;
    font-style: italic;
    margin: 1.5rem 0;
    padding-left: 1.25rem;
  }

  .note-body :global(ul),
  .note-body :global(ol) {
    color: var(--color-text);
    font-family: 'Literata', Georgia, serif;
    font-size: 1.125rem;
    line-height: 1.75;
    margin: 0 0 1.25rem;
    padding-left: 1.75rem;
  }

  .note-body :global(li) {
    margin-bottom: 0.4rem;
  }

  .note-body :global(table) {
    border-collapse: collapse;
    font-size: 0.95rem;
    margin: 1.5rem 0;
    width: 100%;
  }

  .note-body :global(th),
  .note-body :global(td) {
    border: var(--line-std) solid var(--color-line-2);
    padding: 0.5rem 0.75rem;
    text-align: left;
  }

  .note-body :global(th) {
    background: var(--color-surface-1);
    color: var(--color-text-strong);
    font-family: 'Space Grotesk', 'Inter', 'Segoe UI', sans-serif;
    font-weight: 600;
  }

  .note-body :global(hr) {
    border: none;
    border-top: var(--line-std) solid var(--color-line-3);
    margin: 2.5rem 0;
  }

  .note-body :global(img) {
    display: block;
    max-width: 100%;
    height: auto;
  }

  /* -------------------------------------------------------------------------
   * Right sidebar — related notes + cite
   * ----------------------------------------------------------------------- */
  .sidebar-right {
    grid-area: right;
    position: sticky;
    top: 0;
    max-height: 100vh;
    overflow-y: auto;
    border-left: var(--line-std) solid var(--color-line-3);
    display: flex;
    flex-direction: column;
    gap: 0;
  }

  .sidebar-right__section {
    padding: 1.25rem 1rem;
    border-bottom: var(--line-thin) solid var(--color-line-1);
  }

  .sidebar-right__section:last-child {
    border-bottom: none;
  }

  .sidebar-right__section-label {
    margin: 0 0 0.75rem;
    color: var(--color-text-muted);
    font-family: 'Space Grotesk', 'Inter', 'Segoe UI', sans-serif;
    font-size: 0.6rem;
    font-weight: 600;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  /* Related notes */
  .sidebar-right__related-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0;
  }

  .sidebar-right__related-item {
    border-bottom: var(--line-thin) solid var(--color-line-1);
  }

  .sidebar-right__related-item:last-child {
    border-bottom: none;
  }

  .sidebar-right__related-link {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    padding: 0.6rem 0;
    text-decoration: none;
    transition: color 100ms ease;
  }

  .sidebar-right__related-link:hover .sidebar-right__related-title {
    color: var(--color-accent-700);
  }

  .sidebar-right__related-title {
    color: var(--color-text-strong);
    font-family: 'Space Grotesk', 'Inter', 'Segoe UI', sans-serif;
    font-size: 0.72rem;
    font-weight: 600;
    line-height: 1.3;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    transition: color 100ms ease;
  }

  .sidebar-right__related-date {
    color: var(--color-text-muted);
    font-family: 'Space Grotesk', 'Inter', 'Segoe UI', sans-serif;
    font-size: 0.6rem;
    font-weight: 500;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  /* Cite section */
  .sidebar-right__cite-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin: 0;
  }

  .sidebar-right__cite-row {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
  }

  .sidebar-right__cite-key {
    color: var(--color-text-muted);
    font-family: 'Space Grotesk', 'Inter', 'Segoe UI', sans-serif;
    font-size: 0.58rem;
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }

  .sidebar-right__cite-value {
    margin: 0;
    color: var(--color-text);
    font-family: 'Space Grotesk', 'Inter', 'Segoe UI', sans-serif;
    font-size: 0.68rem;
    font-weight: 500;
    line-height: 1.4;
    word-break: break-all;
  }

  .sidebar-right__cite-mono {
    font-family: 'Fira Code', 'Cascadia Code', 'Courier New', monospace;
    font-size: 0.64rem;
  }

  .sidebar-right__cite-url {
    color: var(--color-text-muted);
  }

  /* -------------------------------------------------------------------------
   * Responsive — collapse sidebars on smaller screens
   * ----------------------------------------------------------------------- */
  @media (max-width: 1100px) {
    .note-viewer {
      grid-template-columns: 200px minmax(0, 1fr);
      grid-template-areas:
        "left main"
        "left right";
    }

    .sidebar-right {
      grid-area: right;
      position: static;
      max-height: none;
      border-left: none;
      border-top: var(--line-std) solid var(--color-line-3);
      flex-direction: row;
      flex-wrap: wrap;
      align-items: start;
      padding: 0;
    }

    .sidebar-right__section {
      flex: 1;
      min-width: 200px;
    }
  }

  @media (max-width: 768px) {
    .note-viewer {
      grid-template-columns: 1fr;
      grid-template-areas:
        "main"
        "left"
        "right";
    }

    .sidebar-left {
      position: static;
      max-height: none;
      border-right: none;
      border-top: var(--line-std) solid var(--color-line-3);
    }

    .sidebar-left__catalog {
      overflow: hidden;
    }

    .sidebar-right {
      flex-direction: column;
    }

    .note-header,
    .note-body {
      padding-left: 1.25rem;
      padding-right: 1.25rem;
    }
  }
</style>
