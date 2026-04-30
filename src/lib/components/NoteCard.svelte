<script lang="ts">
  import type { Note } from '$lib/server/db/notes';

  let { note, index }: { note: Note; index: number } = $props();

  const dateFormatter = new Intl.DateTimeFormat('en', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  });

  const formattedDate = $derived(
    note.publishedAt ? dateFormatter.format(note.publishedAt) : '',
  );

  const noteNumber = $derived(String(index + 1).padStart(3, '0'));

  const excerpt = $derived(
    note.body.replace(/^#+\s.*$/gm, '').replace(/[_*`[\]()#>-]/g, '').trim().slice(0, 150) +
      (note.body.trim().length > 150 ? '…' : ''),
  );

  const isVideo = $derived(note.mediaType === 'video-mp4');
</script>

<article class="note-row" aria-label={note.title}>
  <div class="row-meta">
    <span class="note-number">{noteNumber}</span>
    {#if formattedDate}
      <time class="note-date" datetime={note.publishedAt?.toISOString() ?? ''}>
        {formattedDate}
      </time>
    {/if}
  </div>

  <div class="row-content">
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

    {#if note.tags && note.tags.length > 0}
      <div class="tag-list" aria-label="Tags">
        {#each note.tags as tag (tag)}
          <span class="tag-badge">#{tag}</span>
        {/each}
      </div>
    {/if}

    <h2 class="note-title">
      <a href="/notes/{note.slug}">{note.title}</a>
    </h2>

    {#if excerpt}
      <p class="note-excerpt">{excerpt}</p>
    {/if}

    <a class="read-link" href="/notes/{note.slug}" aria-label="Read note: {note.title}">
      Read note →
    </a>
  </div>
</article>

<style>
  .note-row {
    display: grid;
    grid-template-columns: 9rem minmax(0, 1fr);
    gap: 1.5rem;
    border-bottom: var(--line-std) solid var(--color-line-3);
    padding: 2rem 0;
  }

  .row-meta {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding-top: 0.15rem;
  }

  .note-number,
  .note-date,
  .tag-badge,
  .read-link {
    font-family: 'Space Grotesk', 'Inter', 'Segoe UI', sans-serif;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .note-number {
    color: var(--color-text-muted);
    font-size: 0.72rem;
    font-weight: 600;
  }

  .note-date {
    color: var(--color-text-muted);
    font-size: 0.68rem;
    font-weight: 500;
  }

  .row-content {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .cover-media {
    aspect-ratio: 16 / 9;
    overflow: hidden;
    width: 100%;
  }

  .cover-media img,
  .cover-media video {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  .tag-list {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
  }

  .tag-badge {
    border: var(--line-thin) solid var(--color-line-2);
    color: var(--color-text-muted);
    font-size: 0.65rem;
    font-weight: 600;
    padding: 0.2rem 0.5rem;
  }

  .note-title {
    margin: 0;
    color: var(--color-text-strong);
    font-family: 'Space Grotesk', 'Inter', 'Segoe UI', sans-serif;
    font-size: clamp(1.35rem, 2.5vw, 2rem);
    font-weight: 700;
    letter-spacing: -0.02em;
    line-height: 1.1;
  }

  .note-title a {
    color: inherit;
    text-decoration: none;
  }

  .note-title a:hover {
    color: var(--color-accent-700);
  }

  .note-title a:focus-visible {
    outline: var(--line-std) solid var(--color-accent-700);
    outline-offset: 3px;
  }

  .note-excerpt {
    margin: 0;
    color: var(--color-text);
    font-family: 'Literata', Georgia, serif;
    font-size: 1rem;
    line-height: 1.65;
  }

  .read-link {
    align-self: flex-start;
    border-bottom: var(--line-thin) solid var(--color-accent-700);
    color: var(--color-accent-700);
    font-size: 0.72rem;
    font-weight: 700;
    padding-bottom: 0.2rem;
    text-decoration: none;
  }

  .read-link:hover {
    color: var(--color-accent-900);
    border-color: var(--color-accent-900);
  }

  .read-link:focus-visible {
    outline: var(--line-std) solid var(--color-accent-700);
    outline-offset: 3px;
  }

  @media (max-width: 700px) {
    .note-row {
      grid-template-columns: 1fr;
      gap: 0.75rem;
    }

    .row-meta {
      flex-direction: row;
      gap: 1rem;
      align-items: center;
    }
  }
</style>
