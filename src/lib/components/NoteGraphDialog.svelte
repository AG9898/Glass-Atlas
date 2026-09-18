<script lang="ts">
  import { Dialog } from '$lib/components/ui';
  import FullNoteGraph from '$lib/components/FullNoteGraph.svelte';
  import type { PublishedNoteGraph } from '$lib/utils/note-graph';

  let { focusSlug }: { focusSlug: string } = $props();

  let graph = $state<PublishedNoteGraph | null>(null);
  let loading = $state(false);
  let loadError = $state('');

  function isPublishedNoteGraph(value: unknown): value is PublishedNoteGraph {
    if (!value || typeof value !== 'object') return false;
    const candidate = value as { nodes?: unknown; edges?: unknown };
    return Array.isArray(candidate.nodes) && Array.isArray(candidate.edges);
  }

  async function loadGraph(): Promise<void> {
    if (graph || loading) return;
    loading = true;
    loadError = '';

    try {
      const response = await fetch('/api/note-graph');
      if (!response.ok) throw new Error(`Graph request failed with ${response.status}`);
      const payload: unknown = await response.json();
      if (!isPublishedNoteGraph(payload)) throw new Error('Graph response was malformed');
      graph = payload;
    } catch {
      loadError = 'Unable to load the full note graph right now.';
    } finally {
      loading = false;
    }
  }

  function handleOpenChange(open: boolean): void {
    if (open) void loadGraph();
  }
</script>

<Dialog
  title="Node View"
  description="All published notes. Solid lines are authored links; dashed lines are semantic similarity."
  closeText="Close graph"
  class="node-graph-dialog"
  triggerClass="note-graph-expand"
  onOpenChange={handleOpenChange}
>
  {#snippet trigger()}
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M9.5 2H14v4.5M14 2 9.5 6.5M6.5 14H2V9.5M2 14l4.5-4.5" stroke="currentColor" stroke-width="1.5" />
    </svg>
    <span class="sr-only">Expand full node graph</span>
  {/snippet}

  {#snippet children()}
    {#if loading}
      <p class="node-graph-dialog__status" role="status">Loading node graph…</p>
    {:else if loadError}
      <div class="node-graph-dialog__error" role="alert">
        <p>{loadError}</p>
        <button type="button" class="ga-btn ga-btn-sm ga-btn-ghost" onclick={() => void loadGraph()}>
          Try again
        </button>
      </div>
    {:else if graph}
      <FullNoteGraph {graph} {focusSlug} />
    {/if}
  {/snippet}
</Dialog>

<style>
  :global(.note-graph-expand) {
    inline-size: 1.65rem;
    block-size: 1.65rem;
    min-inline-size: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    border: var(--line-thin) solid var(--color-line-2);
    color: var(--color-text-muted);
  }

  :global(.note-graph-expand:hover),
  :global(.note-graph-expand:focus-visible) {
    color: var(--color-text-strong);
    border-color: var(--color-line-3);
  }

  :global(.note-graph-expand svg) {
    inline-size: 0.8rem;
    block-size: 0.8rem;
  }

  :global(.node-graph-dialog) {
    width: min(92vw, 1040px);
    height: min(88vh, 900px);
    max-height: none;
    overflow: hidden;
    padding: 0;
    display: grid;
    grid-template-rows: auto minmax(0, 1fr) auto;
  }

  :global(.node-graph-dialog .ga-dialog-header) {
    margin: 0;
    padding: 1rem 1.25rem 0.85rem;
  }

  :global(.node-graph-dialog .ga-dialog-body) {
    min-height: 0;
    padding: 0 1.25rem;
  }

  :global(.node-graph-dialog .ga-dialog-footer) {
    margin: 0;
    padding: 0.75rem 1.25rem 1rem;
  }

  .node-graph-dialog__status,
  .node-graph-dialog__error {
    margin: 0;
    min-block-size: 24rem;
    display: grid;
    place-content: center;
    gap: 1rem;
    color: var(--color-text-muted);
    font-family: 'Space Grotesk', 'Inter', 'Segoe UI', sans-serif;
    font-size: 0.72rem;
    letter-spacing: 0.08em;
    text-align: center;
    text-transform: uppercase;
  }

  .node-graph-dialog__error p {
    margin: 0;
  }

  .sr-only {
    position: absolute;
    inline-size: 1px;
    block-size: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  @media (max-width: 640px) {
    :global(.node-graph-dialog) {
      width: 96vw;
      height: 88vh;
    }

    :global(.node-graph-dialog .ga-dialog-body) {
      padding: 0 0.75rem;
    }
  }
</style>
