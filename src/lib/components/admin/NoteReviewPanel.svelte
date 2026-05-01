<script lang="ts">
  import { NoteReviewError, streamNoteReview } from '$lib/utils/note-review';

  type ReviewStatus = 'idle' | 'loading' | 'streaming' | 'success' | 'error';

  let { title, takeaway, body }: { title: string; takeaway: string; body: string } = $props();

  let reviewStatus = $state<ReviewStatus>('idle');
  let reviewOutput = $state('');
  let reviewError = $state('');

  let reviewInFlight = $derived(reviewStatus === 'loading' || reviewStatus === 'streaming');

  function hasRequiredFields(): boolean {
    return title.trim() !== '' && takeaway.trim() !== '' && body.trim() !== '';
  }

  function formatError(error: unknown): string {
    if (error instanceof NoteReviewError) {
      return error.message;
    }

    if (error instanceof Error && error.message.trim() !== '') {
      return error.message;
    }

    return 'Unable to run review right now.';
  }

  async function runReview(): Promise<void> {
    if (reviewInFlight) return;

    reviewError = '';
    reviewOutput = '';

    if (!hasRequiredFields()) {
      reviewStatus = 'error';
      reviewError = 'Title, takeaway, and body are required before running review.';
      return;
    }

    reviewStatus = 'loading';

    try {
      await streamNoteReview(
        {
          title,
          takeaway,
          body,
        },
        {
          onStart: () => {
            reviewStatus = 'loading';
          },
          onChunk: (_token, aggregate) => {
            reviewStatus = 'streaming';
            reviewOutput = aggregate;
          },
          onComplete: (aggregate) => {
            reviewStatus = 'success';
            reviewOutput = aggregate;
          },
        },
      );
    } catch (error: unknown) {
      reviewStatus = 'error';
      reviewError = formatError(error);
    }
  }
</script>

<section class="sidebar-card review-card" aria-label="Manual note review">
  <p class="eyebrow">Review</p>
  <p class="hint">Run a manual critique from the current unsaved title, takeaway, and body.</p>
  <button type="button" class="ga-btn ga-btn-ghost ga-btn-lg review-button" onclick={runReview} disabled={reviewInFlight}>
    {#if reviewInFlight}
      Reviewing…
    {:else}
      Run Review
    {/if}
  </button>

  {#if reviewStatus === 'loading' || reviewStatus === 'streaming'}
    <p class="review-state" role="status">Streaming critique…</p>
  {/if}

  {#if reviewError}
    <p class="review-error" role="alert">{reviewError}</p>
  {/if}

  {#if reviewOutput}
    <pre class="review-output" aria-live="polite">{reviewOutput}</pre>
  {/if}
</section>

<style>
  .review-card {
    gap: 0.75rem;
  }

  .review-button {
    justify-content: center;
  }

  .review-state,
  .review-error,
  .review-output {
    margin: 0;
  }

  .review-state,
  .review-error {
    border: var(--line-thin) solid var(--color-line-2);
    font-family: 'Space Grotesk', 'Inter', 'Segoe UI', sans-serif;
    font-size: 0.68rem;
    font-weight: 600;
    letter-spacing: 0.06em;
    padding: 0.65rem 0.75rem;
    text-transform: uppercase;
  }

  .review-state {
    color: var(--color-text-muted);
  }

  .review-error {
    border-color: var(--color-error);
    color: var(--color-error);
  }

  .review-output {
    overflow-x: auto;
    border: var(--line-thin) solid var(--color-line-2);
    background: var(--color-surface-1);
    color: var(--color-text);
    font-family: 'Literata', Georgia, 'Times New Roman', serif;
    font-size: 0.92rem;
    line-height: 1.55;
    padding: 0.8rem;
    white-space: pre-wrap;
  }
</style>
