<script lang="ts">
  import Chat from '$lib/components/Chat.svelte';
  import NoteCard from '$lib/components/NoteCard.svelte';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  const numberFormatter = new Intl.NumberFormat('en-US');

  const statItems = $derived([
    {
      label: 'Published Notes',
      value: numberFormatter.format(data.stats.publishedNotes),
    },
    {
      label: 'Distinct Topics',
      value: numberFormatter.format(data.stats.distinctTopics),
    },
    {
      label: 'Avg Words / Note',
      value: numberFormatter.format(data.stats.averageWordCount),
    },
    {
      label: 'Citations Served',
      value: numberFormatter.format(data.stats.totalCitations),
    },
  ]);
</script>

<svelte:head>
  <title>Glass Atlas | Notes From Practice</title>
  <meta
    name="description"
    content="Grounded engineering notes with live chat and the latest field entries from Glass Atlas."
  />
</svelte:head>

<main class="landing-shell" aria-labelledby="landing-title">
  <section class="hero" aria-label="Landing hero">
    <div class="hero-copy">
      <p class="hero-eyebrow">Glass Atlas</p>
      <h1 id="landing-title">Notes from a developer who would rather show his work.</h1>
      <a class="ga-btn ga-btn-primary ga-btn-lg hero-cta ga-focus-ring" href="/notes">Read The Latest</a>
    </div>

    <aside class="hero-chat" aria-label="Grounded chat panel">
      <Chat compact />
    </aside>
  </section>

  <section class="stats" aria-label="Site statistics">
    {#each statItems as stat}
      <article class="stat-item">
        <p class="stat-value">{stat.value}</p>
        <p class="stat-label">{stat.label}</p>
      </article>
    {/each}
  </section>

  <section class="latest" aria-labelledby="latest-title">
    <header class="latest-header">
      <p class="latest-eyebrow">Archive</p>
      <h2 id="latest-title">The latest field notes.</h2>
    </header>

    {#if data.latestNotes.length === 0}
      <p class="latest-empty">No published notes yet.</p>
    {:else}
      <div class="latest-list">
        {#each data.latestNotes as note, index (note.slug)}
          <NoteCard {note} {index} />
        {/each}
      </div>
    {/if}
  </section>
</main>

<style>
  .landing-shell {
    width: min(100%, 1440px);
    margin: 0 auto;
    padding: 3rem 3rem 6rem;
  }

  .hero {
    display: grid;
    grid-template-columns: minmax(0, 2fr) minmax(0, 3fr);
    gap: 2rem;
    align-items: stretch;
    border-top: var(--line-strong) solid var(--color-line-3);
    border-bottom: var(--line-std) solid var(--color-line-3);
    padding: 2.25rem 0;
  }

  .hero-copy {
    display: grid;
    align-content: start;
    gap: 1.5rem;
    padding-right: 1.25rem;
  }

  .hero-eyebrow {
    margin: 0;
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
    font-family: 'Literata', Georgia, 'Times New Roman', serif;
    font-size: clamp(2.2rem, 5.2vw, 4.6rem);
    font-weight: 500;
    letter-spacing: -0.02em;
    line-height: 0.98;
    max-width: 14ch;
  }

  .hero-cta {
    justify-self: start;
    text-decoration: none;
    min-width: 14rem;
  }

  .hero-chat {
    inline-size: min(100%, 790px);
    min-width: 0;
    background: var(--color-surface-1);
    justify-self: end;
  }

  .stats {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    border-bottom: var(--line-std) solid var(--color-line-3);
  }

  .stat-item {
    display: grid;
    gap: 0.35rem;
    padding: 1.15rem 1rem;
    border-right: var(--line-thin) solid var(--color-line-2);
    background: var(--color-surface-1);
  }

  .stat-item:last-child {
    border-right: 0;
  }

  .stat-value {
    color: var(--color-text-strong);
    font-family: 'Space Grotesk', 'Inter', 'Segoe UI', sans-serif;
    font-size: clamp(1.2rem, 2.4vw, 2rem);
    font-weight: 700;
    line-height: 1;
    letter-spacing: -0.01em;
  }

  .stat-label {
    color: var(--color-text-muted);
    font-family: 'Space Grotesk', 'Inter', 'Segoe UI', sans-serif;
    font-size: 0.66rem;
    font-weight: 600;
    letter-spacing: 0.09em;
    text-transform: uppercase;
  }

  .latest {
    padding-top: 2rem;
  }

  .latest-header {
    border-bottom: var(--line-std) solid var(--color-line-3);
    margin-bottom: 0;
    padding-bottom: 1rem;
  }

  .latest-eyebrow {
    margin-bottom: 0.6rem;
    color: var(--color-text-muted);
    font-family: 'Space Grotesk', 'Inter', 'Segoe UI', sans-serif;
    font-size: 0.72rem;
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }

  h2 {
    color: var(--color-text-strong);
    font-family: 'Space Grotesk', 'Inter', 'Segoe UI', sans-serif;
    font-size: clamp(2rem, 5.4vw, 4rem);
    font-weight: 700;
    letter-spacing: -0.03em;
    line-height: 0.96;
  }

  .latest-list {
    border-top: var(--line-std) solid var(--color-line-3);
  }

  .latest-empty {
    margin-top: 1.25rem;
    padding: 1.25rem;
    border: var(--line-std) solid var(--color-line-3);
    background: var(--color-surface-1);
    color: var(--color-text-muted);
  }

  @media (max-width: 1100px) {
    .hero {
      grid-template-columns: 1fr;
    }

    .hero-copy {
      padding-right: 0;
    }

    h1 {
      max-width: 100%;
    }

    .hero-chat {
      inline-size: 100%;
      justify-self: stretch;
    }

    .stats {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .stat-item:nth-child(2n) {
      border-right: 0;
    }

    .stat-item:nth-child(-n + 2) {
      border-bottom: var(--line-thin) solid var(--color-line-2);
    }
  }

  @media (max-width: 700px) {
    .landing-shell {
      padding: 2.5rem 1.25rem 5rem;
    }

    h1 {
      font-size: clamp(2rem, 10vw, 3rem);
      line-height: 1;
    }

    .stats {
      grid-template-columns: 1fr;
    }

    .stat-item {
      border-right: 0;
      border-bottom: var(--line-thin) solid var(--color-line-2);
    }

    .stat-item:last-child {
      border-bottom: 0;
    }
  }
</style>
