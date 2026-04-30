<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import NoteCard from '$lib/components/NoteCard.svelte';
  import { CATEGORIES } from '$lib/utils/note-taxonomy';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  let selectedTopic = $state('');
  let selectedSort = $state('newest');
  let searchQuery = $state('');
  let searchInput: HTMLInputElement | null = null;

  $effect(() => {
    selectedTopic = data.topic ?? '';
    selectedSort = data.sort ?? 'newest';
    searchQuery = data.q ?? '';
  });

  function buildFilterPath(next: { topic?: string; sort?: string; q?: string }): string {
    const params = new URLSearchParams();
    const topic = next.topic ?? '';
    const sort = next.sort ?? 'newest';
    const q = (next.q ?? '').trim();

    if (topic) params.set('topic', topic);
    if (q) params.set('q', q);
    if (sort !== 'newest') params.set('sort', sort);

    const query = params.toString();
    return `/notes${query ? `?${query}` : ''}`;
  }

  function applyFilters(next?: { topic?: string; sort?: string; q?: string }): void {
    void goto(
      buildFilterPath({
        topic: next?.topic ?? selectedTopic,
        sort: next?.sort ?? selectedSort,
        q: next?.q ?? searchQuery,
      }),
    );
  }

  function handleTopicChange(event: Event): void {
    selectedTopic = (event.currentTarget as HTMLSelectElement).value;
    applyFilters({ topic: selectedTopic });
  }

  function handleSortChange(event: Event): void {
    selectedSort = (event.currentTarget as HTMLSelectElement).value;
    applyFilters({ sort: selectedSort });
  }

  function handleSearchChange(event: Event): void {
    searchQuery = (event.currentTarget as HTMLInputElement).value;
    applyFilters({ q: searchQuery });
  }

  function handleSearchSubmit(event: SubmitEvent): void {
    event.preventDefault();
    applyFilters({ q: searchQuery });
  }

  $effect(() => {
    if ($page.url.searchParams.get('focus') !== 'search') return;
    searchInput?.focus();
  });
</script>

<svelte:head>
  <title>Field Notes | Glass Atlas</title>
  <meta
    name="description"
    content="Browse structured knowledge notes from Glass Atlas — engineering, architecture, and practice."
  />
</svelte:head>

<main class="notes-shell" aria-labelledby="notes-title">
  <header class="notes-header">
    <div class="header-text">
      <p class="eyebrow">Archive</p>
      <h1 id="notes-title">The latest field notes.</h1>
    </div>

    <form
      class="filter-bar"
      method="GET"
      action="/notes"
      aria-label="Filter notes"
      onsubmit={handleSearchSubmit}
    >
      <label class="filter-field filter-field--search">
        <span class="filter-label">Search</span>
        <input
          bind:this={searchInput}
          type="search"
          name="q"
          value={searchQuery}
          onchange={handleSearchChange}
          placeholder="Title or tag"
          aria-label="Search notes by title or tag"
        />
      </label>

      <label class="filter-field">
        <span class="filter-label">Topic</span>
        <select
          name="topic"
          value={selectedTopic}
          onchange={handleTopicChange}
          aria-label="Filter by topic"
        >
          <option value="">All topics</option>
          {#each CATEGORIES as category}
            <option value={category}>{category}</option>
          {/each}
        </select>
      </label>

      <label class="filter-field">
        <span class="filter-label">Sort</span>
        <select
          name="sort"
          value={selectedSort}
          onchange={handleSortChange}
          aria-label="Sort order"
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
        </select>
      </label>

      <noscript>
        <button class="filter-submit" type="submit">Apply</button>
      </noscript>
    </form>
  </header>

  {#if data.notes.length === 0}
    <section class="empty-state" aria-label="No notes found">
      <p class="eyebrow">No results</p>
      <h2>{data.q ? `No notes match "${data.q}".` : 'No notes match this filter.'}</h2>
      <p>
        Try a different topic or{' '}
        <a href="/notes">view all notes</a>.
      </p>
    </section>
  {:else}
    <section class="notes-feed" aria-label="Notes list">
      {#each data.notes as note, index (note.slug)}
        <NoteCard {note} {index} />
      {/each}
    </section>
  {/if}
</main>

<style>
  .notes-shell {
    width: min(100%, 1440px);
    margin: 0 auto;
    padding: 4rem 3rem 6rem;
  }

  .notes-header {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 2rem;
    align-items: end;
    border-top: var(--line-strong) solid var(--color-line-3);
    border-bottom: var(--line-std) solid var(--color-line-3);
    padding: 2rem 0;
    margin-bottom: 0;
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

  h1,
  h2,
  p {
    margin: 0;
  }

  h1 {
    color: var(--color-text-strong);
    font-family: 'Space Grotesk', 'Inter', 'Segoe UI', sans-serif;
    font-size: clamp(2.5rem, 8vw, 5.5rem);
    font-weight: 700;
    letter-spacing: -0.03em;
    line-height: 0.95;
  }

  .filter-bar {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    align-items: flex-end;
  }

  .filter-field {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
  }

  .filter-label {
    color: var(--color-text-muted);
    font-family: 'Space Grotesk', 'Inter', 'Segoe UI', sans-serif;
    font-size: 0.65rem;
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }

  input,
  select {
    border: 0;
    border-bottom: var(--line-std) solid var(--color-line-3);
    border-radius: 0;
    background: transparent;
    color: var(--color-text-strong);
    font-family: 'Space Grotesk', 'Inter', 'Segoe UI', sans-serif;
    font-size: 0.8rem;
    font-weight: 500;
    padding: 0.35rem 0;
    min-width: 10rem;
  }

  input {
    min-width: 12rem;
  }

  select {
    cursor: pointer;
  }

  .filter-field--search {
    min-width: 14rem;
  }

  input:focus,
  select:focus {
    outline: var(--line-std) solid var(--color-accent-700);
    outline-offset: 3px;
  }

  .filter-submit {
    border: var(--line-std) solid var(--color-line-3);
    border-radius: 0;
    background: transparent;
    color: var(--color-text-strong);
    cursor: pointer;
    font-family: 'Space Grotesk', 'Inter', 'Segoe UI', sans-serif;
    font-size: 0.72rem;
    font-weight: 600;
    letter-spacing: 0.1em;
    padding: 0.5rem 1rem;
    text-transform: uppercase;
  }

  .notes-feed {
    border-top: var(--line-std) solid var(--color-line-3);
  }

  .empty-state {
    display: grid;
    gap: 1rem;
    margin-top: 4rem;
    padding: 2rem;
    border: var(--line-std) solid var(--color-line-3);
    background: var(--color-surface-1);
  }

  .empty-state h2 {
    color: var(--color-text-strong);
    font-family: 'Space Grotesk', 'Inter', 'Segoe UI', sans-serif;
    font-size: clamp(1.75rem, 4vw, 3rem);
    line-height: 1;
  }

  .empty-state p {
    color: var(--color-text-muted);
    font-size: 1rem;
  }

  .empty-state a {
    color: var(--color-accent-700);
    text-decoration: underline;
  }

  @media (max-width: 900px) {
    .notes-shell {
      padding: 3rem 1.25rem 5rem;
    }

    .notes-header {
      grid-template-columns: 1fr;
      align-items: flex-start;
    }

    .filter-bar {
      flex-direction: row;
      flex-wrap: wrap;
      align-items: flex-end;
      gap: 1rem;
    }

    .filter-field {
      align-items: flex-start;
    }
  }
</style>
