<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { basicSetup, EditorView } from 'codemirror';
  import { markdown } from '@codemirror/lang-markdown';
  import { placeholder as placeholderExtension } from '@codemirror/view';
  import { renderPreviewSync } from '$lib/utils/markdown-preview.js';

  type MarkdownEditorProps = {
    value?: string;
    placeholder?: string;
    onChange?: (value: string) => void;
    resolvedSlugs?: Set<string>;
  };

  let {
    value = $bindable(''),
    placeholder = '',
    onChange,
    resolvedSlugs = new Set<string>(),
  }: MarkdownEditorProps = $props();

  let container: HTMLDivElement | undefined;
  let view: EditorView | undefined;
  let syncingFromEditor = false;

  // Preview state — updated reactively from `value` without network calls.
  let previewHtml = $state('');
  let previewError = $state('');

  onMount(() => {
    if (!container) return;

    view = new EditorView({
      doc: value,
      extensions: [
        basicSetup,
        markdown(),
        placeholderExtension(placeholder),
        EditorView.lineWrapping,
        EditorView.updateListener.of((update) => {
          if (!update.docChanged) return;

          const nextValue = update.state.doc.toString();
          syncingFromEditor = true;
          value = nextValue;
          onChange?.(nextValue);
          syncingFromEditor = false;
        }),
      ],
      parent: container,
    });
  });

  // Sync external value changes back into CodeMirror (e.g. form reset / load).
  $effect(() => {
    if (!view || syncingFromEditor) return;

    const nextValue = value;
    const currentValue = view.state.doc.toString();
    if (nextValue === currentValue) return;

    view.dispatch({
      changes: { from: 0, to: currentValue.length, insert: nextValue },
    });
  });

  // Update preview whenever `value` or `resolvedSlugs` changes.
  // Uses the synchronous variant — the unified pipeline is synchronous and
  // renderPreviewSync never throws (fail-soft contract).
  $effect(() => {
    const result = renderPreviewSync(value, resolvedSlugs);
    if (result.ok) {
      previewHtml = result.html;
      previewError = '';
    } else {
      previewHtml = result.html; // contains preview-error fallback HTML
      previewError = result.errorMessage;
    }
  });

  onDestroy(() => {
    view?.destroy();
    view = undefined;
  });
</script>

<div class="markdown-editor" data-testid="markdown-editor">
  <!-- Left pane: CodeMirror source editor -->
  <div class="markdown-editor__pane markdown-editor__pane--source">
    <div class="markdown-editor__pane-header">
      <span>Markdown Source</span>
      <span>CodeMirror 6</span>
    </div>
    <div
      class="markdown-editor__body"
      bind:this={container}
      aria-label="Markdown editor"
    ></div>
  </div>

  <!-- Divider -->
  <div class="markdown-editor__divider" aria-hidden="true"></div>

  <!-- Right pane: live preview -->
  <div class="markdown-editor__pane markdown-editor__pane--preview">
    <div class="markdown-editor__pane-header">
      <span>Live Preview</span>
      {#if previewError}
        <span class="markdown-editor__preview-badge markdown-editor__preview-badge--error"
          >Error</span
        >
      {:else}
        <span class="markdown-editor__preview-badge">Live</span>
      {/if}
    </div>
    <div class="markdown-editor__preview prose" aria-label="Markdown preview" aria-live="polite">
      <!-- eslint-disable-next-line svelte/no-at-html-tags -->
      {@html previewHtml}
    </div>
  </div>
</div>

<style>
  /* ── Outer container ─────────────────────────────────────────────────────── */
  .markdown-editor {
    display: grid;
    grid-template-columns: 1fr var(--line-std) 1fr;
    min-height: 28rem;
    border: var(--line-std) solid var(--color-line-2);
    background: var(--color-surface-2);
    color: var(--color-text);
  }

  :global(.dark) .markdown-editor {
    background: var(--color-surface-1);
  }

  /* ── Vertical divider between panes ─────────────────────────────────────── */
  .markdown-editor__divider {
    width: var(--line-std);
    background: var(--color-line-2);
    align-self: stretch;
  }

  /* ── Individual panes ───────────────────────────────────────────────────── */
  .markdown-editor__pane {
    display: grid;
    grid-template-rows: auto 1fr;
    min-height: 28rem;
    overflow: hidden;
  }

  /* ── Pane header strip ──────────────────────────────────────────────────── */
  .markdown-editor__pane-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
    border-bottom: var(--line-thin) solid var(--color-line-1);
    padding: 0.75rem 1rem;
    color: var(--color-text-muted);
    font-family: 'Space Grotesk', 'Inter', 'Segoe UI', sans-serif;
    font-size: 0.6875rem;
    font-weight: 600;
    letter-spacing: 0.08em;
    line-height: 1.25;
    text-transform: uppercase;
  }

  /* ── Live / Error badge in preview header ───────────────────────────────── */
  .markdown-editor__preview-badge {
    color: var(--color-text-muted);
    font-size: 0.625rem;
  }

  .markdown-editor__preview-badge--error {
    color: var(--color-error);
  }

  /* ── Source pane — CodeMirror body ──────────────────────────────────────── */
  .markdown-editor__body {
    min-height: 24rem;
    overflow: hidden;
  }

  .markdown-editor__body :global(.cm-editor) {
    height: 100%;
    min-height: 24rem;
    background: transparent;
    color: var(--color-text);
    font-family: 'Literata', Georgia, 'Times New Roman', serif;
    font-size: 1rem;
    line-height: 1.65;
  }

  .markdown-editor__body :global(.cm-editor.cm-focused) {
    outline: var(--line-std) solid var(--color-line-3);
    outline-offset: calc(-1 * var(--line-std));
  }

  .markdown-editor__body :global(.cm-scroller) {
    font-family: 'Literata', Georgia, 'Times New Roman', serif;
  }

  .markdown-editor__body :global(.cm-content) {
    min-height: 24rem;
    padding: 1rem;
    caret-color: var(--color-text-strong);
  }

  .markdown-editor__body :global(.cm-line) {
    padding: 0;
  }

  .markdown-editor__body :global(.cm-gutters) {
    border-right: var(--line-thin) solid var(--color-line-1);
    background: color-mix(in srgb, var(--color-surface-1) 72%, transparent);
    color: var(--color-text-muted);
    font-family: 'Space Grotesk', 'Inter', 'Segoe UI', sans-serif;
    font-size: 0.6875rem;
  }

  :global(.dark) .markdown-editor__body :global(.cm-gutters) {
    background: color-mix(in srgb, var(--color-surface-2) 44%, transparent);
  }

  .markdown-editor__body :global(.cm-activeLine),
  .markdown-editor__body :global(.cm-activeLineGutter) {
    background: color-mix(in srgb, var(--color-accent-100) 58%, transparent);
  }

  .markdown-editor__body :global(.cm-selectionBackground),
  .markdown-editor__body :global(.cm-focused .cm-selectionBackground),
  .markdown-editor__body :global(.cm-content ::selection) {
    background: color-mix(in srgb, var(--color-accent-300) 72%, transparent);
  }

  .markdown-editor__body :global(.cm-placeholder) {
    color: var(--color-text-muted);
    font-family: 'Literata', Georgia, 'Times New Roman', serif;
  }

  /* ── Preview pane ───────────────────────────────────────────────────────── */
  .markdown-editor__preview {
    overflow-y: auto;
    padding: 1rem 1.25rem;
    font-family: 'Literata', Georgia, 'Times New Roman', serif;
    font-size: 1rem;
    line-height: 1.65;
    color: var(--color-text);
    word-break: break-word;
  }

  /* Prose resets for rendered markdown elements */
  .markdown-editor__preview :global(h1),
  .markdown-editor__preview :global(h2),
  .markdown-editor__preview :global(h3),
  .markdown-editor__preview :global(h4),
  .markdown-editor__preview :global(h5),
  .markdown-editor__preview :global(h6) {
    font-family: 'Space Grotesk', 'Inter', 'Segoe UI', sans-serif;
    font-weight: 600;
    color: var(--color-text-strong);
    margin: 1.25em 0 0.5em;
    line-height: 1.2;
  }

  .markdown-editor__preview :global(h1) { font-size: 1.5rem; }
  .markdown-editor__preview :global(h2) { font-size: 1.25rem; }
  .markdown-editor__preview :global(h3) { font-size: 1.1rem; }

  .markdown-editor__preview :global(p) {
    margin: 0 0 0.875em;
  }

  .markdown-editor__preview :global(a) {
    color: var(--color-accent-700);
    text-decoration: underline;
    text-underline-offset: 2px;
  }

  :global(.dark) .markdown-editor__preview :global(a) {
    color: var(--color-accent-700);
  }

  .markdown-editor__preview :global(.wiki-link-missing) {
    color: var(--color-warning);
    text-decoration: underline dotted;
    text-underline-offset: 2px;
    cursor: help;
  }

  .markdown-editor__preview :global(ul),
  .markdown-editor__preview :global(ol) {
    margin: 0 0 0.875em;
    padding-left: 1.5em;
  }

  .markdown-editor__preview :global(li) {
    margin-bottom: 0.25em;
  }

  .markdown-editor__preview :global(blockquote) {
    border-left: var(--line-strong) solid var(--color-accent-300);
    margin: 0 0 0.875em;
    padding: 0.5em 1em;
    color: var(--color-text-muted);
    font-style: italic;
  }

  .markdown-editor__preview :global(code) {
    background: color-mix(in srgb, var(--color-surface-1) 80%, transparent);
    border: var(--line-thin) solid var(--color-line-1);
    padding: 0.1em 0.35em;
    font-family: 'Space Grotesk', monospace;
    font-size: 0.875em;
  }

  :global(.dark) .markdown-editor__preview :global(code) {
    background: color-mix(in srgb, var(--color-surface-2) 80%, transparent);
  }

  .markdown-editor__preview :global(pre) {
    background: var(--color-surface-1);
    border: var(--line-thin) solid var(--color-line-1);
    padding: 1em;
    overflow-x: auto;
    margin: 0 0 0.875em;
  }

  :global(.dark) .markdown-editor__preview :global(pre) {
    background: var(--color-surface-2);
  }

  .markdown-editor__preview :global(pre code) {
    background: none;
    border: none;
    padding: 0;
    font-size: 0.875em;
  }

  .markdown-editor__preview :global(table) {
    width: 100%;
    border-collapse: collapse;
    margin: 0 0 0.875em;
    font-size: 0.9em;
  }

  .markdown-editor__preview :global(th),
  .markdown-editor__preview :global(td) {
    border: var(--line-thin) solid var(--color-line-2);
    padding: 0.4em 0.75em;
    text-align: left;
  }

  .markdown-editor__preview :global(th) {
    background: color-mix(in srgb, var(--color-surface-1) 60%, transparent);
    font-family: 'Space Grotesk', sans-serif;
    font-size: 0.75em;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--color-text-muted);
  }

  .markdown-editor__preview :global(hr) {
    border: none;
    border-top: var(--line-std) solid var(--color-line-2);
    margin: 1.5em 0;
  }

  .markdown-editor__preview :global(.inline-media) {
    margin: 1.5rem 0;
  }

  .markdown-editor__preview :global(.inline-media__asset) {
    display: block;
    width: 100%;
    max-width: 100%;
    height: auto;
    border: var(--line-thin) solid var(--color-line-1);
  }

  .markdown-editor__preview :global(.inline-media__asset--video) {
    aspect-ratio: 16 / 9;
    background: var(--color-surface-1);
  }

  .markdown-editor__preview :global(.inline-media__caption) {
    margin-top: 0.5rem;
    color: var(--color-text-muted);
    font-family: 'Space Grotesk', 'Inter', 'Segoe UI', sans-serif;
    font-size: 0.68rem;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .markdown-editor__preview :global(.inline-media--left) {
    width: min(70%, 28rem);
    margin-right: auto;
  }

  .markdown-editor__preview :global(.inline-media--center) {
    width: min(100%, 36rem);
    margin-left: auto;
    margin-right: auto;
  }

  .markdown-editor__preview :global(.inline-media--wide) {
    width: min(100%, 48rem);
    margin-left: auto;
    margin-right: auto;
  }

  /* Preview error notice */
  .markdown-editor__preview :global(.preview-error) {
    color: var(--color-error);
    font-family: 'Space Grotesk', sans-serif;
    font-size: 0.8125rem;
    padding: 0.5em 0;
  }

  /* ── Responsive: stack panes on narrow viewports ─────────────────────────── */
  @media (max-width: 768px) {
    .markdown-editor {
      grid-template-columns: 1fr;
      grid-template-rows: auto var(--line-std) auto;
    }

    .markdown-editor__divider {
      width: 100%;
      height: var(--line-std);
    }

    .markdown-editor__pane,
    .markdown-editor__body,
    .markdown-editor__body :global(.cm-editor),
    .markdown-editor__body :global(.cm-content) {
      min-height: 16rem;
    }

    .markdown-editor__preview {
      min-height: 14rem;
    }

    .markdown-editor__pane-header {
      flex-direction: column;
      gap: 0.25rem;
    }
  }
</style>
