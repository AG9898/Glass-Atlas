<script lang="ts">
  import FullNoteGraph from '$lib/components/FullNoteGraph.svelte';
  import type { PublishedNoteGraph } from '$lib/utils/note-graph';

  let { data }: { data: { graph: PublishedNoteGraph } } = $props();
</script>

<svelte:head>
  <title>Node View — Glass Atlas</title>
  <meta
    name="description"
    content="Explore authored links and semantic relationships across every published Glass Atlas note."
  />
</svelte:head>

<main class="node-view-page">
  <header class="node-view-page__header">
    <div>
      <p class="node-view-page__eyebrow">Knowledge map</p>
      <h1>Node View</h1>
    </div>
    <p class="node-view-page__intro">
      Explore how the published notes connect. Solid lines are links written into the notes;
      dashed lines are relationships inferred from their semantic index.
    </p>
  </header>

  <div class="node-view-page__graph">
    <FullNoteGraph graph={data.graph} />
  </div>
</main>

<style>
  .node-view-page {
    max-width: 1440px;
    margin: 0 auto;
    padding: 2rem 3rem 3rem;
  }

  .node-view-page__header {
    display: grid;
    grid-template-columns: minmax(0, 0.75fr) minmax(18rem, 1.25fr);
    gap: 3rem;
    align-items: end;
    border-top: var(--line-strong) solid var(--color-line-3);
    border-bottom: var(--line-std) solid var(--color-line-3);
    padding: 1.5rem 0;
  }

  .node-view-page__eyebrow {
    margin: 0 0 0.45rem;
    color: var(--color-text-muted);
    font-family: 'Space Grotesk', 'Inter', 'Segoe UI', sans-serif;
    font-size: 0.68rem;
    font-weight: 600;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  h1 {
    margin: 0;
    color: var(--color-text-strong);
    font-family: 'Space Grotesk', 'Inter', 'Segoe UI', sans-serif;
    font-size: clamp(2.4rem, 5vw, 4.5rem);
    line-height: 0.95;
    letter-spacing: -0.035em;
    text-transform: uppercase;
  }

  .node-view-page__intro {
    margin: 0;
    max-width: 52rem;
    color: var(--color-text);
    font-family: 'Literata', Georgia, serif;
    font-size: clamp(1rem, 1.5vw, 1.2rem);
    line-height: 1.65;
  }

  .node-view-page__graph {
    height: max(34rem, calc(100svh - var(--ga-nav-height, 7rem) - 14rem));
    margin-top: 1.25rem;
  }

  @media (max-width: 768px) {
    .node-view-page {
      padding: 1.25rem 1.25rem 2rem;
    }

    .node-view-page__header {
      grid-template-columns: 1fr;
      gap: 1rem;
    }

    .node-view-page__graph {
      height: 68svh;
      min-height: 30rem;
    }
  }
</style>
