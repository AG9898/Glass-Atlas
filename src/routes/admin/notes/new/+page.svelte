<script lang="ts">
  import MarkdownEditor from '$lib/components/MarkdownEditor.svelte';
  import { CATEGORIES } from '$lib/utils/note-taxonomy';
  import type { ActionData } from './$types';

  type NoteStatus = 'draft' | 'published';
  type FormValues = NonNullable<ActionData>['values'];

  let { form }: { form: ActionData } = $props();

  function valuesFromForm(): FormValues | undefined {
    return form?.values;
  }

  const initialValues = valuesFromForm();

  let title = $state(initialValues?.title ?? '');
  let takeaway = $state(initialValues?.takeaway ?? '');
  let body = $state(initialValues?.body ?? '');
  let category = $state(initialValues?.category ?? '');
  let status = $state<NoteStatus>(initialValues?.status ?? 'draft');
  let publishedAt = $state(initialValues?.publishedAt ?? '');
  let series = $state(initialValues?.series ?? '');
  let image = $state(initialValues?.image ?? '');
  let tags = $state<string[]>(initialValues?.tags ?? []);
  let tagDraft = $state('');

  let formValues = $derived(valuesFromForm());
  let tagsValue = $derived(
    [...tags, normalizeTag(tagDraft)].filter((tag, index, all) => tag && all.indexOf(tag) === index).join(','),
  );
  let slugPreview = $derived(slugPreviewFromTitle(title));
  let wordCount = $derived(body.trim() === '' ? 0 : body.trim().split(/\s+/).length);

  $effect(() => {
    if (!formValues) return;

    title = formValues.title;
    takeaway = formValues.takeaway;
    body = formValues.body;
    category = formValues.category;
    status = formValues.status;
    publishedAt = formValues.publishedAt;
    series = formValues.series;
    image = formValues.image;
    tags = formValues.tags;
  });

  function normalizeTag(value: string): string {
    return value
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9_-]/g, '');
  }

  function slugPreviewFromTitle(value: string): string {
    return value
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  function addTag(): void {
    const nextTag = normalizeTag(tagDraft);
    if (nextTag && !tags.includes(nextTag)) {
      tags = [...tags, nextTag];
    }
    tagDraft = '';
  }

  function removeTag(tag: string): void {
    tags = tags.filter((currentTag) => currentTag !== tag);
  }

  function handleTagKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Enter' && event.key !== ',') return;

    event.preventDefault();
    addTag();
  }
</script>

<svelte:head>
  <title>New Note | Glass Atlas Admin</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<main class="editor-shell" aria-labelledby="page-title">
  <header class="editor-header">
    <div>
      <p class="eyebrow">Admin / Notes / New</p>
      <h1 id="page-title">Create note</h1>
      <p class="lede">Draft a structured note, assign publication metadata, and redirect into the edit workflow after save.</p>
    </div>
    <a class="back-link" href="/admin">All notes</a>
  </header>

  {#if form?.message}
    <p class="form-message" role="alert">{form.message}</p>
  {/if}

  <form method="POST" action="?/create" class="editor-grid">
    <input type="hidden" name="body" value={body} />
    <input type="hidden" name="tags" value={tagsValue} />

    <section class="editor-main" aria-label="Note content fields">
      <div class="status-panel" aria-label="Generated note metadata">
        <div>
          <span class="panel-label">Slug</span>
          <strong>{slugPreview || 'generated-after-title'}</strong>
          <span>Auto-generated with slugify.ts on create.</span>
        </div>
        <div>
          <span class="panel-label">Body</span>
          <strong>{wordCount} words</strong>
          <span>Embedding generation is wired in ADMIN-05.</span>
        </div>
      </div>

      <div class="form-panel">
        <label class="field-row">
          <span class="field-label">
            <strong>Title *</strong>
            <small>Headline as it appears in feeds.</small>
          </span>
          <input bind:value={title} name="title" required placeholder="A clear, specific title" />
        </label>

        <label class="field-row">
          <span class="field-label">
            <strong>Takeaway</strong>
            <small>Single-sentence LLM context summary.</small>
          </span>
          <textarea bind:value={takeaway} name="takeaway" rows="3" placeholder="What should a reader remember?" ></textarea>
        </label>

        <label class="field-row">
          <span class="field-label">
            <strong>Category</strong>
            <small>Canonical list from note-taxonomy.ts.</small>
          </span>
          <select bind:value={category} name="category">
            <option value="">Uncategorized</option>
            {#each CATEGORIES as option}
              <option value={option}>{option}</option>
            {/each}
          </select>
        </label>

        <div class="field-row">
          <span class="field-label">
            <strong>Tags</strong>
            <small>Add several tags; stored as text[].</small>
          </span>
          <div class="tag-input">
            <div class="tag-list" aria-label="Selected tags">
              {#each tags as tag (tag)}
                <button type="button" class="tag-chip" onclick={() => removeTag(tag)}>#{tag} ×</button>
              {/each}
              <input
                bind:value={tagDraft}
                onkeydown={handleTagKeydown}
                onblur={addTag}
                placeholder="add tag, press enter"
                aria-label="Add tag"
              />
            </div>
          </div>
        </div>
      </div>

      <section class="body-section" aria-labelledby="body-title">
        <div class="section-heading">
          <p class="eyebrow" id="body-title">Body / Markdown</p>
          <p>CodeMirror 6 markdown mode</p>
        </div>
        <MarkdownEditor bind:value={body} placeholder="Start with the note thesis, then write in Markdown..." />
      </section>
    </section>

    <aside class="editor-sidebar" aria-label="Publication settings">
      <section class="sidebar-card">
        <p class="eyebrow">Publish State</p>
        <label>
          <span>Status</span>
          <select bind:value={status} name="status">
            <option value="draft">Draft</option>
            <option value="published">Published</option>
          </select>
        </label>
        <label>
          <span>Published date</span>
          <input bind:value={publishedAt} name="publishedAt" type="date" />
        </label>
      </section>

      <section class="sidebar-card">
        <p class="eyebrow">Editorial Metadata</p>
        <label>
          <span>Series</span>
          <input bind:value={series} name="series" placeholder="Optional series name" />
        </label>
        <label>
          <span>Cover media URL</span>
          <input bind:value={image} name="image" inputmode="url" placeholder="https://.../cover.png" />
        </label>
        <p class="hint">Accepts pasted JPEG, PNG, SVG, GIF, or MP4 URLs. First-party upload controls are handled in ADMIN-07.</p>
      </section>

      <section class="sidebar-card checklist">
        <p class="eyebrow">Preflight</p>
        <span class:complete={title.trim() !== ''}>Title set</span>
        <span class:complete={body.trim() !== ''}>Body set</span>
        <span class:complete={category !== ''}>Category assigned</span>
        <span class:complete={tagsValue !== ''}>Tags added</span>
      </section>

      <button class="submit-button" type="submit">Create note</button>
    </aside>
  </form>
</main>

<style>
  .editor-shell {
    width: min(100%, 1440px);
    margin: 0 auto;
    padding: 3rem 3rem 6rem;
  }

  .editor-header {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 2rem;
    align-items: end;
    border-top: var(--line-strong) solid var(--color-line-3);
    border-bottom: var(--line-std) solid var(--color-line-3);
    padding: 1.75rem 0;
  }

  .eyebrow,
  .back-link,
  .panel-label,
  .field-label strong,
  .field-label small,
  .sidebar-card span,
  .hint,
  .submit-button,
  .checklist span,
  .section-heading p {
    font-family: 'Space Grotesk', 'Inter', 'Segoe UI', sans-serif;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  h1,
  p {
    margin: 0;
  }

  h1 {
    color: var(--color-text-strong);
    font-family: 'Space Grotesk', 'Inter', 'Segoe UI', sans-serif;
    font-size: clamp(2.75rem, 7vw, 5.25rem);
    letter-spacing: -0.04em;
    line-height: 0.95;
  }

  .eyebrow {
    margin-bottom: 0.75rem;
    color: var(--color-text-muted);
    font-size: 0.72rem;
    font-weight: 600;
  }

  .lede {
    max-width: 48rem;
    margin-top: 1rem;
    color: var(--color-text-muted);
  }

  .back-link {
    border-bottom: var(--line-thin) solid var(--color-line-2);
    color: var(--color-text-strong);
    font-size: 0.72rem;
    font-weight: 700;
    padding-bottom: 0.35rem;
    text-decoration: none;
  }

  .form-message {
    margin-top: 1rem;
    border: var(--line-std) solid var(--color-error);
    color: var(--color-error);
    padding: 0.875rem 1rem;
  }

  .editor-grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(19rem, 24rem);
    border-bottom: var(--line-strong) solid var(--color-line-3);
  }

  .editor-main {
    border-right: var(--line-std) solid var(--color-line-3);
    padding: 2rem 2rem 2rem 0;
  }

  .status-panel {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    border: var(--line-std) solid var(--color-line-3);
    background: var(--color-surface-1);
  }

  .status-panel div {
    display: grid;
    gap: 0.5rem;
    padding: 1.25rem 1.5rem;
  }

  .status-panel div + div {
    border-left: var(--line-thin) solid var(--color-line-2);
  }

  .status-panel strong {
    color: var(--color-text-strong);
    font-family: 'Space Grotesk', 'Inter', 'Segoe UI', sans-serif;
    font-size: clamp(1.1rem, 2vw, 1.4rem);
    line-height: 1;
  }

  .status-panel span:last-child {
    color: var(--color-text-muted);
    font-size: 0.78rem;
  }

  .panel-label,
  .field-label small,
  .sidebar-card span,
  .hint,
  .checklist span,
  .section-heading p {
    color: var(--color-text-muted);
    font-size: 0.68rem;
    font-weight: 600;
  }

  .form-panel {
    margin-top: 2rem;
    border: var(--line-std) solid var(--color-line-3);
  }

  .field-row {
    display: grid;
    grid-template-columns: 13rem minmax(0, 1fr);
    border-top: var(--line-thin) solid var(--color-line-2);
  }

  .field-row:first-child {
    border-top: 0;
  }

  .field-label {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    border-right: var(--line-thin) solid var(--color-line-2);
    padding: 1.25rem 1.5rem;
  }

  .field-label strong {
    color: var(--color-text-strong);
    font-size: 0.72rem;
  }

  input,
  textarea,
  select {
    width: 100%;
    border: 0;
    border-bottom: var(--line-std) solid var(--color-line-3);
    border-radius: 0;
    background: transparent;
    color: var(--color-text-strong);
    font: inherit;
    padding: 0.75rem 0;
  }

  textarea {
    resize: vertical;
  }

  select {
    color: var(--color-text-strong);
  }

  input:focus,
  textarea:focus,
  select:focus,
  .tag-chip:focus,
  .submit-button:focus,
  .back-link:focus {
    outline: var(--line-std) solid var(--color-accent-700);
    outline-offset: 3px;
  }

  .field-row > input,
  .field-row > textarea,
  .field-row > select,
  .tag-input {
    align-self: center;
    margin: 0.875rem 1.5rem;
  }

  .tag-list {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    align-items: center;
  }

  .tag-list input {
    min-width: 12rem;
    flex: 1;
  }

  .tag-chip {
    border: var(--line-thin) solid var(--color-line-3);
    border-radius: 0;
    background: var(--color-surface-1);
    color: var(--color-text-strong);
    cursor: pointer;
    font-family: 'Space Grotesk', 'Inter', 'Segoe UI', sans-serif;
    font-size: 0.72rem;
    letter-spacing: 0.08em;
    padding: 0.45rem 0.65rem;
    text-transform: uppercase;
  }

  .body-section {
    margin-top: 2rem;
  }

  .section-heading {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 0.75rem;
  }

  .editor-sidebar {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    background: var(--color-surface-1);
    padding: 2rem 0 2rem 2rem;
  }

  .sidebar-card {
    display: grid;
    gap: 1rem;
    border: var(--line-std) solid var(--color-line-3);
    background: var(--color-bg);
    padding: 1.25rem;
  }

  .sidebar-card label {
    display: grid;
    gap: 0.5rem;
  }

  .hint {
    color: var(--color-text-muted);
    line-height: 1.5;
    text-transform: none;
  }

  .checklist span {
    display: flex;
    justify-content: space-between;
    border-top: var(--line-thin) solid var(--color-line-1);
    padding-top: 0.75rem;
  }

  .checklist span::after {
    content: 'OPEN';
    color: var(--color-text-muted);
  }

  .checklist span.complete::after {
    content: 'OK';
    color: var(--color-success);
  }

  .submit-button {
    border: var(--line-std) solid var(--color-accent-900);
    border-radius: 0;
    background: var(--color-accent-700);
    color: var(--color-bg);
    cursor: pointer;
    font-size: 0.78rem;
    font-weight: 700;
    padding: 1rem 1.25rem;
  }

  @media (max-width: 960px) {
    .editor-shell {
      padding: 2rem 1.25rem 4rem;
    }

    .editor-header,
    .editor-grid,
    .status-panel,
    .field-row {
      grid-template-columns: 1fr;
    }

    .editor-main,
    .editor-sidebar {
      border-right: 0;
      padding: 2rem 0;
    }

    .editor-sidebar {
      border-top: var(--line-std) solid var(--color-line-3);
    }

    .status-panel div + div,
    .field-label {
      border-left: 0;
      border-right: 0;
    }

    .field-label {
      border-bottom: var(--line-thin) solid var(--color-line-1);
      padding-bottom: 0.75rem;
    }
  }
</style>
