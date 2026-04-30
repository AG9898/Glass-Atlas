<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { basicSetup, EditorView } from 'codemirror';
  import { markdown } from '@codemirror/lang-markdown';
  import { placeholder as placeholderExtension } from '@codemirror/view';

  type MarkdownEditorProps = {
    value?: string;
    placeholder?: string;
    onChange?: (value: string) => void;
  };

  let { value = $bindable(''), placeholder = '', onChange }: MarkdownEditorProps = $props();

  let container: HTMLDivElement | undefined;
  let view: EditorView | undefined;
  let syncingFromEditor = false;

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

  $effect(() => {
    if (!view || syncingFromEditor) return;

    const nextValue = value;
    const currentValue = view.state.doc.toString();
    if (nextValue === currentValue) return;

    view.dispatch({
      changes: { from: 0, to: currentValue.length, insert: nextValue },
    });
  });

  onDestroy(() => {
    view?.destroy();
    view = undefined;
  });
</script>

<div class="markdown-editor" data-testid="markdown-editor">
  <div class="markdown-editor__header">
    <span>Markdown Source</span>
    <span>CodeMirror 6</span>
  </div>
  <div class="markdown-editor__body" bind:this={container} aria-label="Markdown editor"></div>
</div>

<style>
  .markdown-editor {
    display: grid;
    min-height: 28rem;
    border: var(--line-std) solid var(--color-line-2);
    background: var(--color-surface-2);
    color: var(--color-text);
  }

  :global(.dark) .markdown-editor {
    background: var(--color-surface-1);
  }

  .markdown-editor__header {
    display: flex;
    justify-content: space-between;
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

  @media (max-width: 640px) {
    .markdown-editor,
    .markdown-editor__body,
    .markdown-editor__body :global(.cm-editor),
    .markdown-editor__body :global(.cm-content) {
      min-height: 20rem;
    }

    .markdown-editor__header {
      flex-direction: column;
      gap: 0.25rem;
    }
  }
</style>
