<script lang="ts">
  import MarkdownEditor from '$lib/components/MarkdownEditor.svelte';
  import { CATEGORIES } from '$lib/utils/note-taxonomy';
  import type { ActionData } from './$types';

  type NoteStatus = 'draft' | 'published';
  type NoteMediaType = 'image-jpeg' | 'image-png' | 'image-svg' | 'image-gif' | 'video-mp4';
  type FormValues = NonNullable<ActionData>['values'];
  type UploadStatus = 'idle' | 'uploading' | 'success' | 'error';
  type UploadResponse = {
    key: string;
    uploadUrl: string;
    uploadMethod: 'PUT';
    uploadHeaders: {
      'Content-Type': string;
    };
    imageUrl: string;
  };

  const MEDIA_TYPE_OPTIONS: Array<{ value: NoteMediaType; label: string }> = [
    { value: 'image-jpeg', label: 'JPEG image' },
    { value: 'image-png', label: 'PNG image' },
    { value: 'image-svg', label: 'SVG image' },
    { value: 'image-gif', label: 'GIF image' },
    { value: 'video-mp4', label: 'MP4 video' },
  ];

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
  let mediaType = $state<NoteMediaType>(initialValues?.mediaType ?? 'image-jpeg');
  let tags = $state<string[]>(initialValues?.tags ?? []);
  let tagDraft = $state('');
  let uploadStatus = $state<UploadStatus>('idle');
  let uploadMessage = $state('');

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
    mediaType = formValues.mediaType;
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

  function inferMediaTypeFromMime(mimeType: string): NoteMediaType {
    if (mimeType === 'image/png') return 'image-png';
    if (mimeType === 'image/svg+xml') return 'image-svg';
    if (mimeType === 'image/gif') return 'image-gif';
    if (mimeType === 'video/mp4') return 'video-mp4';
    return 'image-jpeg';
  }

  function isUploadResponse(value: unknown): value is UploadResponse {
    if (typeof value !== 'object' || value === null) return false;

    const candidate = value as Record<string, unknown>;
    return (
      typeof candidate.key === 'string' &&
      typeof candidate.uploadUrl === 'string' &&
      typeof candidate.imageUrl === 'string' &&
      typeof candidate.uploadHeaders === 'object' &&
      candidate.uploadHeaders !== null
    );
  }

  async function handleCoverUpload(event: Event): Promise<void> {
    const input = event.currentTarget;
    if (!(input instanceof HTMLInputElement)) return;

    const file = input.files?.[0];
    if (!file) return;

    uploadStatus = 'uploading';
    uploadMessage = 'Requesting upload URL...';

    try {
      const response = await fetch('/api/admin/media/upload-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type,
        }),
      });

      const payload: unknown = await response.json();
      if (!response.ok || !isUploadResponse(payload)) {
        throw new Error('Unable to prepare upload.');
      }

      uploadMessage = 'Uploading file...';

      const uploadResult = await fetch(payload.uploadUrl, {
        method: payload.uploadMethod,
        headers: payload.uploadHeaders,
        body: file,
      });

      if (!uploadResult.ok) {
        throw new Error('Upload failed.');
      }

      image = payload.imageUrl;
      mediaType = inferMediaTypeFromMime(file.type);
      uploadStatus = 'success';
      uploadMessage = `Uploaded ${file.name}`;
      input.value = '';
    } catch {
      uploadStatus = 'error';
      uploadMessage = 'Upload failed. Check bucket credentials/CORS and try again.';
    }
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
          <span>Upload cover media</span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/svg+xml,image/gif,video/mp4"
            onchange={handleCoverUpload}
          />
        </label>
        <div class="cover-fields">
          <label>
            <span>Media type</span>
            <select bind:value={mediaType} name="mediaType">
              {#each MEDIA_TYPE_OPTIONS as option (option.value)}
                <option value={option.value}>{option.label}</option>
              {/each}
            </select>
          </label>
          <label>
            <span>Cover media URL</span>
            <input bind:value={image} name="image" inputmode="url" placeholder="https://.../cover.png" />
          </label>
        </div>
        <p class="hint">Supports JPEG, PNG, SVG, GIF, and MP4. Upload sets a private-bucket access URL in this field.</p>
        {#if uploadStatus !== 'idle'}
          <p class:success={uploadStatus === 'success'} class:error={uploadStatus === 'error'} class="hint upload-status">
            {uploadMessage}
          </p>
        {/if}
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

  .cover-fields {
    display: grid;
    gap: 0.75rem;
    grid-template-columns: minmax(0, 11rem) minmax(0, 1fr);
  }

  .hint {
    color: var(--color-text-muted);
    line-height: 1.5;
    text-transform: none;
  }

  .upload-status.success {
    color: var(--color-success);
  }

  .upload-status.error {
    color: var(--color-error);
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

    .cover-fields {
      grid-template-columns: 1fr;
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
