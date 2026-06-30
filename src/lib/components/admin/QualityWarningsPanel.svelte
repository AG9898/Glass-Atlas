<script lang="ts">
  import { getContentQualityWarnings, type QualityWarning } from '$lib/utils/quality-warnings';

  type SemanticIndexWarning = {
    label: string;
    message: string;
    detail?: string | null;
  };

  let {
    title,
    takeaway,
    body,
    semanticIndex = null,
  }: {
    title: string;
    takeaway: string;
    body: string;
    semanticIndex?: SemanticIndexWarning | null;
  } = $props();

  // Live, advisory-only warnings derived from current (possibly unsaved)
  // editor form state. Never gates Save Draft / Publish. Semantic-index state
  // is passed in from the server load (it depends on saved DB timestamps that
  // don't change while typing); the remaining checks are recomputed on every
  // edit via the client-safe getContentQualityWarnings() helper.
  let warnings = $derived.by((): Array<QualityWarning & { detail?: string | null }> => {
    const contentWarnings = getContentQualityWarnings({ title, takeaway, body });

    if (!semanticIndex) return contentWarnings;

    return [
      {
        type: 'semantic-index',
        label: semanticIndex.label,
        message: semanticIndex.message,
        detail: semanticIndex.detail ?? null,
      },
      ...contentWarnings,
    ];
  });
</script>

{#if warnings.length > 0}
  <section class="quality-warnings" aria-label="Note quality warnings" role="status">
    <p class="eyebrow">Quality Warnings</p>
    <ul>
      {#each warnings as warning (warning.type)}
        <li>
          <span class="warning-label">{warning.label}</span>
          <span class="warning-message">{warning.message}</span>
          {#if warning.detail}
            <small>{warning.detail}</small>
          {/if}
        </li>
      {/each}
    </ul>
  </section>
{/if}

<style>
  .quality-warnings {
    margin-top: 1rem;
    border: var(--line-std) solid var(--color-warning);
    background: color-mix(in srgb, var(--color-warning) 9%, var(--color-bg));
    padding: 1rem 1.25rem;
  }

  .quality-warnings .eyebrow {
    margin: 0 0 0.75rem;
    color: var(--color-warning);
    font-family: 'Space Grotesk', 'Inter', 'Segoe UI', sans-serif;
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  ul {
    display: grid;
    gap: 0.75rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  li {
    display: grid;
    gap: 0.3rem;
    border-top: var(--line-thin) solid var(--color-line-2);
    padding-top: 0.75rem;
  }

  li:first-child {
    border-top: 0;
    padding-top: 0;
  }

  .warning-label {
    color: var(--color-text-strong);
    font-family: 'Space Grotesk', 'Inter', 'Segoe UI', sans-serif;
    font-size: 0.7rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .warning-message {
    max-width: 52rem;
    color: var(--color-text-muted);
    font-size: 0.88rem;
    line-height: 1.5;
  }

  small {
    color: var(--color-text-muted);
    font-family: 'Space Grotesk', 'Inter', 'Segoe UI', sans-serif;
    font-size: 0.72rem;
  }
</style>
