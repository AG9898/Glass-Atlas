<script lang="ts">
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  const { note, bodyHtml } = $derived(data);

  const dateFormatter = new Intl.DateTimeFormat('en', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const formattedDate = $derived(
    note.publishedAt ? dateFormatter.format(note.publishedAt) : null,
  );

  /**
   * Determine whether the image URL points to an MP4 video.
   * Only checks for the .mp4 extension — sufficient for the allowed media
   * types (JPEG, PNG, SVG, GIF, MP4).
   */
  const isVideo = $derived(
    note.image ? /\.mp4(\?.*)?$/i.test(note.image) : false,
  );
</script>

<svelte:head>
  <title>{note.title} | Glass Atlas</title>
  <meta name="description" content={note.takeaway ?? note.title} />
</svelte:head>

<article class="note-detail" aria-labelledby="note-title">

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

</article>

<style>
  .note-detail {
    width: min(100%, 1440px);
    margin: 0 auto;
    padding-bottom: 6rem;
  }

  /* -------------------------------------------------------------------------
   * Cover media — full-width, 16/9, above the title (styleguide §6)
   * ----------------------------------------------------------------------- */
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

  /* -------------------------------------------------------------------------
   * Header
   * ----------------------------------------------------------------------- */
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
    font-size: clamp(2rem, 6vw, 4rem);
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

  /* -------------------------------------------------------------------------
   * Prose body
   * ----------------------------------------------------------------------- */
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
   * Responsive
   * ----------------------------------------------------------------------- */
  @media (max-width: 900px) {
    .note-header,
    .note-body {
      padding-left: 1.25rem;
      padding-right: 1.25rem;
    }
  }
</style>
