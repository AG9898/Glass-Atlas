<script lang="ts">
  import type { ActionData, PageData } from './$types';

  let { data, form }: { data: PageData; form: ActionData } = $props();

  const dateFormatter = new Intl.DateTimeFormat('en', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  });

  function formatPublishedDate(note: PageData['notes'][number]): string {
    if (note.status !== 'published') return 'Not published';
    return dateFormatter.format(note.publishedAt ?? note.createdAt);
  }
</script>

<svelte:head>
  <title>Admin | Glass Atlas</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<main class="admin-shell" aria-labelledby="admin-title">
  <section class="admin-header">
    <div>
      <p class="eyebrow">Control Room</p>
      <h1 id="admin-title">Notes</h1>
      <p class="lede">Review drafts, published notes, and editing entry points from one linear list.</p>
    </div>

    <a class="ga-btn ga-btn-primary ga-btn-md new-note" href="/admin/notes/new">New Note</a>
  </section>

  {#if form?.message}
    <p class="form-message" role="alert">{form.message}</p>
  {/if}

  {#if data.notes.length === 0}
    <section class="empty-state" aria-label="No notes">
      <p class="eyebrow">No Rows</p>
      <h2>No notes have been created yet.</h2>
      <p>Start with a draft, then publish once the note is ready for the public archive.</p>
      <a class="ga-btn ga-btn-accent ga-btn-md" href="/admin/notes/new">Create First Note</a>
    </section>
  {:else}
    <section class="notes-table" aria-label="Admin notes list">
      <div class="table-head" role="row">
        <span>No.</span>
        <span>Title</span>
        <span>Status</span>
        <span>Index</span>
        <span>Published</span>
        <span>Actions</span>
      </div>

      {#each data.notes as note, index (note.slug)}
        <article class="note-row">
          <p class="note-number">{String(index + 1).padStart(2, '0')}</p>

          <div class="note-title-block">
            <h2>{note.title}</h2>
            <p>{note.slug}</p>
          </div>

          <p class:published={note.status === 'published'} class="status-badge">
            {note.status === 'published' ? 'PUBLISHED' : 'DRAFT'}
          </p>

          <div class:warning={note.semanticIndexDisplay.showWarning} class="index-state">
            <strong>{note.semanticIndexDisplay.label}</strong>
            {#if note.semanticIndexDisplay.showWarning}
              <span>{note.semanticIndexDisplay.summary}</span>
            {/if}
          </div>

          <p class="published-date">{formatPublishedDate(note)}</p>

          <div class="row-actions">
            <a class="ga-btn ga-btn-ghost ga-btn-sm" href={`/admin/notes/${note.slug}/edit`}>Edit</a>
            <form method="POST" action="?/delete">
              <input type="hidden" name="slug" value={note.slug} />
              <button class="ga-btn ga-btn-danger ga-btn-sm" type="submit">Delete</button>
            </form>
          </div>
        </article>
      {/each}
    </section>
  {/if}
</main>

<style>
  .admin-shell {
    width: min(100%, 1440px);
    margin: 0 auto;
    padding: 4rem 3rem 6rem;
  }

  .admin-header {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 2rem;
    align-items: end;
    border-top: var(--line-strong) solid var(--color-line-3);
    border-bottom: var(--line-std) solid var(--color-line-3);
    padding: 2rem 0;
  }

  .eyebrow,
  .table-head,
  .note-number,
  .status-badge,
  .published-date {
    font-family: "Space Grotesk", "Inter", "Segoe UI", sans-serif;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }

  .eyebrow {
    margin: 0 0 0.75rem;
    color: var(--color-text-muted);
    font-size: 0.72rem;
    font-weight: 600;
  }

  h1,
  h2,
  p {
    margin: 0;
  }

  h1 {
    color: var(--color-text-strong);
    font-family: "Space Grotesk", "Inter", "Segoe UI", sans-serif;
    font-size: clamp(2.5rem, 8vw, 5.5rem);
    letter-spacing: -0.04em;
    line-height: 0.95;
  }

  .lede {
    max-width: 44rem;
    margin-top: 1rem;
    color: var(--color-text-muted);
    font-size: 1rem;
  }

  .new-note {
    align-self: end;
  }

  .form-message {
    margin-top: 1rem;
    border: var(--line-thin) solid var(--color-error);
    color: var(--color-error);
    padding: 0.75rem 1rem;
  }

  .empty-state {
    display: grid;
    gap: 1rem;
    margin-top: 2rem;
    border-bottom: var(--line-std) solid var(--color-line-3);
    background: var(--color-surface-1);
    padding: 2rem;
  }

  .empty-state h2 {
    color: var(--color-text-strong);
    font-family: "Space Grotesk", "Inter", "Segoe UI", sans-serif;
    font-size: clamp(1.75rem, 4vw, 3rem);
    line-height: 1;
  }

  .notes-table {
    margin-top: 2rem;
    border-top: var(--line-std) solid var(--color-line-3);
  }

  .table-head,
  .note-row {
    display: grid;
    grid-template-columns: 5rem minmax(14rem, 1fr) 9rem minmax(10rem, 15rem) 12rem 14rem;
    gap: 1rem;
    align-items: center;
  }

  .table-head {
    border-bottom: var(--line-thin) solid var(--color-line-2);
    color: var(--color-text-muted);
    font-size: 0.68rem;
    font-weight: 600;
    padding: 0.75rem 0;
  }

  .note-row {
    min-height: 6.5rem;
    border-bottom: var(--line-std) solid var(--color-line-3);
    padding: 1.25rem 0;
  }

  .note-number,
  .index-state strong,
  .published-date {
    color: var(--color-text-muted);
    font-size: 0.72rem;
    font-weight: 600;
  }

  .note-title-block {
    display: grid;
    gap: 0.35rem;
  }

  .note-title-block h2 {
    color: var(--color-text-strong);
    font-family: "Space Grotesk", "Inter", "Segoe UI", sans-serif;
    font-size: clamp(1.35rem, 2vw, 2rem);
    line-height: 1.1;
  }

  .note-title-block p {
    color: var(--color-text-muted);
    font-family: "Space Grotesk", "Inter", "Segoe UI", sans-serif;
    font-size: 0.8rem;
  }

  .status-badge {
    width: fit-content;
    border: var(--line-thin) solid var(--color-warning);
    color: var(--color-warning);
    font-size: 0.68rem;
    font-weight: 700;
    padding: 0.25rem 0.5rem;
  }

  .status-badge.published {
    border-color: var(--color-success);
    color: var(--color-success);
  }

  .index-state {
    display: grid;
    gap: 0.35rem;
  }

  .index-state strong,
  .index-state span {
    font-family: "Space Grotesk", "Inter", "Segoe UI", sans-serif;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .index-state strong {
    line-height: 1.2;
  }

  .index-state span {
    color: var(--color-text-muted);
    font-size: 0.68rem;
    font-weight: 600;
    letter-spacing: 0;
    line-height: 1.4;
    text-transform: none;
  }

  .index-state.warning strong {
    color: var(--color-warning);
  }

  .row-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    justify-content: flex-end;
  }

  @media (max-width: 900px) {
    .admin-shell {
      padding: 3rem 1.25rem 5rem;
    }

    .admin-header {
      grid-template-columns: 1fr;
      align-items: start;
    }

    .new-note {
      width: fit-content;
    }

    .table-head {
      display: none;
    }

    .note-row {
      grid-template-columns: 3rem minmax(0, 1fr);
      gap: 0.75rem 1rem;
      align-items: start;
    }

    .status-badge,
    .index-state,
    .published-date,
    .row-actions {
      grid-column: 2;
    }

    .row-actions {
      justify-content: flex-start;
    }
  }
</style>
