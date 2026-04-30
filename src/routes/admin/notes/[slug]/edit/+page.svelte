<script lang="ts">
  import MarkdownEditor from '$lib/components/MarkdownEditor.svelte';
  import { CATEGORIES } from '$lib/utils/note-taxonomy';
  import type { ActionData, PageData } from './$types';

  type NoteStatus = 'draft' | 'published';
  type NoteMediaType = 'image-jpeg' | 'image-png' | 'image-svg' | 'image-gif' | 'video-mp4';
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
  type FormValues = {
    title: string;
    takeaway: string;
    body: string;
    tags: string[];
    category: string;
    status: NoteStatus;
    publishedAt: string;
    series: string;
    image: string;
    mediaType: NoteMediaType;
  };

  const MEDIA_TYPE_OPTIONS: Array<{ value: NoteMediaType; label: string }> = [
    { value: 'image-jpeg', label: 'JPEG image' },
    { value: 'image-png', label: 'PNG image' },
    { value: 'image-svg', label: 'SVG image' },
    { value: 'image-gif', label: 'GIF image' },
    { value: 'video-mp4', label: 'MP4 video' },
  ];

  let { data, form }: { data: PageData; form: ActionData } = $props();

  let title = $state('');
  let takeaway = $state('');
  let body = $state('');
  let category = $state('');
  let status = $state<NoteStatus>('draft');
  let publishedAt = $state('');
  let series = $state('');
  let image = $state('');
  let mediaType = $state<NoteMediaType>('image-jpeg');
  let tags = $state<string[]>([]);
  let tagDraft = $state('');
  let uploadStatus = $state<UploadStatus>('idle');
  let uploadMessage = $state('');

  let formValues = $derived(valuesFromForm());
  let tagsValue = $derived(
    [...tags, normalizeTag(tagDraft)].filter((tag, index, all) => tag && all.indexOf(tag) === index).join(','),
  );
  let wordCount = $derived(body.trim() === '' ? 0 : body.trim().split(/\s+/).length);
  let checklist = $derived([
    { label: 'Title set', complete: title.trim() !== '' },
    { label: 'Takeaway present', complete: takeaway.trim() !== '' },
    { label: 'Category assigned', complete: category !== '' },
    { label: 'At least 1 tag', complete: tagsValue !== '' },
    { label: 'Cover image optional', complete: image.trim() === '' || isSupportedCoverUrl(image) },
  ]);

  $effect(() => {
    const nextValues = formValues ?? valuesFromNote(data.note);

    title = nextValues.title;
    takeaway = nextValues.takeaway;
    body = nextValues.body;
    category = nextValues.category;
    status = nextValues.status;
    publishedAt = nextValues.publishedAt;
    series = nextValues.series;
    image = nextValues.image;
    mediaType = nextValues.mediaType;
    tags = nextValues.tags;
  });

  function valuesFromForm(): FormValues | undefined {
    return form && 'values' in form ? form.values : undefined;
  }

  function valuesFromNote(note: PageData['note']): FormValues {
    return {
      title: note.title,
      takeaway: note.takeaway ?? '',
      body: note.body,
      tags: note.tags ?? [],
      category: note.category ?? '',
      status: note.status,
      publishedAt: note.publishedAtInput,
      series: note.series ?? '',
      image: note.image ?? '',
      mediaType: note.mediaType,
    };
  }

  function normalizeTag(value: string): string {
    return value
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9_-]/g, '');
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

  function isSupportedCoverUrl(value: string): boolean {
    const normalized = value.trim();
    if (normalized.startsWith('/api/admin/media/access-url?key=')) return true;
    return /\.(jpe?g|png|svg|gif|mp4)(\?.*)?$/i.test(normalized);
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
  <title>Edit {data.note.title} | Glass Atlas Admin</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<main class="editor-shell" aria-labelledby="page-title">
  <form method="POST" class="editor-form">
    <input type="hidden" name="body" value={body} />
    <input type="hidden" name="tags" value={tagsValue} />

    <header class="top-bar">
      <div class="breadcrumb-block">
        <a href="/admin">All notes</a>
        <span>/</span>
        <span>{title || data.note.title}</span>
        <p class:published={status === 'published'} class="status-badge">{status === 'published' ? 'Published' : 'Draft'}</p>
      </div>

      <div class="top-actions">
        <a class="ga-btn ga-btn-ghost ga-btn-lg" href={`/notes/${data.note.slug}`}>Preview</a>
        <button class="ga-btn ga-btn-ghost ga-btn-lg" type="submit" formaction="?/update">Save Draft</button>
        <button class="ga-btn ga-btn-primary ga-btn-lg" type="submit" formaction="?/publish">Publish</button>
      </div>
    </header>

    {#if form?.message}
      <p class:success={form.saved} class="form-message" role="status">{form.message}</p>
    {/if}

    <section class="editor-meta" aria-label="Note status metadata">
      <div>
        <span class="panel-label">Slug</span>
        <strong>{data.note.slug}</strong>
        <span>URL-stable; title edits do not change it.</span>
      </div>
      <div>
        <span class="panel-label">Body</span>
        <strong>{wordCount} words</strong>
        <span>Embedding refresh is wired in ADMIN-05.</span>
      </div>
      <div>
        <span class="panel-label">Version</span>
        <strong>{new Date(data.note.updatedAt).toLocaleDateString('en')}</strong>
        <span>Last database update timestamp.</span>
      </div>
    </section>

    <div class="editor-grid">
      <section class="editor-main" aria-label="Note content fields">
        <div class="form-panel">
          <label class="field-row">
            <span class="field-label">
              <strong>Title *</strong>
              <small>Headline as it appears in the archive.</small>
            </span>
            <input bind:value={title} name="title" required placeholder="A clear, specific title" />
          </label>

          <label class="field-row">
            <span class="field-label">
              <strong>Takeaway</strong>
              <small>Single-sentence context summary.</small>
            </span>
            <textarea bind:value={takeaway} name="takeaway" rows="4" placeholder="What should a reader remember?"></textarea>
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
              <small>Free-form, snake/kebab-case.</small>
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
          <MarkdownEditor bind:value={body} placeholder="Revise the note thesis, then write in Markdown..." />
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
          <p class="hint">Save Draft preserves the current database status. Publish saves these fields and sets status to published.</p>
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

        <section class="sidebar-card related-card">
          <p class="eyebrow">Related Notes</p>
          <p class="related-placeholder">Backlinks and wiki-link suggestions are planned for a later editor pass.</p>
        </section>

        <section class="sidebar-card checklist">
          <p class="eyebrow">Pre-publish Checklist</p>
          {#each checklist as item (item.label)}
            <span class:complete={item.complete}>{item.label}</span>
          {/each}
        </section>
      </aside>
    </div>
  </form>
</main>

<style>
  .editor-shell {
    width: min(100%, 1440px);
    margin: 0 auto;
    padding: 0 3rem 6rem;
  }

  .editor-form {
    display: grid;
    gap: 0;
  }

  .top-bar {
    position: sticky;
    top: 0;
    z-index: 10;
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 1.5rem;
    align-items: center;
    border-bottom: var(--line-std) solid var(--color-line-3);
    background: var(--color-bg);
    padding: 1.5rem 0;
  }

  .breadcrumb-block,
  .top-actions,
  .editor-meta,
  .section-heading,
  .tag-list,
  .checklist span {
    display: flex;
    align-items: center;
  }

  .breadcrumb-block {
    flex-wrap: wrap;
    gap: 0.75rem;
    min-width: 0;
  }

  .breadcrumb-block a,
  .breadcrumb-block span,
  .status-badge,
  .panel-label,
  .field-label strong,
  .field-label small,
  .sidebar-card span,
  .hint,
  .checklist span,
  .section-heading p,
  .related-placeholder {
    font-family: 'Space Grotesk', 'Inter', 'Segoe UI', sans-serif;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .breadcrumb-block a,
  .breadcrumb-block span {
    overflow: hidden;
    color: var(--color-text-muted);
    font-size: 0.72rem;
    font-weight: 700;
    text-decoration: none;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .breadcrumb-block span:last-of-type {
    max-width: min(38rem, 52vw);
    color: var(--color-text-strong);
    font-size: clamp(1rem, 2vw, 1.35rem);
    letter-spacing: -0.02em;
    text-transform: none;
  }

  .status-badge {
    border: var(--line-thin) solid var(--color-warning);
    color: var(--color-warning);
    font-size: 0.68rem;
    font-weight: 700;
    line-height: 1;
    padding: 0.35rem 0.55rem;
  }

  .status-badge.published {
    border-color: var(--color-success);
    color: var(--color-success);
  }

  .top-actions {
    flex-wrap: wrap;
    gap: 0.75rem;
    justify-content: flex-end;
  }

  .form-message {
    margin: 1rem 0 0;
    border: var(--line-std) solid var(--color-error);
    color: var(--color-error);
    padding: 0.875rem 1rem;
  }

  .form-message.success {
    border-color: var(--color-success);
    color: var(--color-success);
  }

  .editor-meta {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    margin-top: 1.5rem;
    border: var(--line-std) solid var(--color-line-3);
    background: var(--color-surface-1);
  }

  .editor-meta div {
    display: grid;
    gap: 0.5rem;
    min-width: 0;
    padding: 1.25rem 1.5rem;
  }

  .editor-meta div + div {
    border-left: var(--line-thin) solid var(--color-line-2);
  }

  .editor-meta strong {
    overflow: hidden;
    color: var(--color-text-strong);
    font-family: 'Space Grotesk', 'Inter', 'Segoe UI', sans-serif;
    font-size: clamp(1rem, 2vw, 1.35rem);
    line-height: 1;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .editor-meta span:last-child,
  .panel-label,
  .field-label small,
  .sidebar-card span,
  .hint,
  .checklist span,
  .section-heading p,
  .related-placeholder {
    color: var(--color-text-muted);
    font-size: 0.68rem;
    font-weight: 600;
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

  .form-panel {
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

  input:focus,
  textarea:focus,
  select:focus,
  .tag-chip:focus,
  .breadcrumb-block a:focus {
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
    flex-wrap: wrap;
    gap: 0.5rem;
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
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 0.75rem;
  }

  .eyebrow,
  p {
    margin: 0;
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

  .eyebrow {
    color: var(--color-text-muted);
    font-family: 'Space Grotesk', 'Inter', 'Segoe UI', sans-serif;
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .hint,
  .related-placeholder {
    line-height: 1.5;
    text-transform: none;
  }

  .upload-status.success {
    color: var(--color-success);
  }

  .upload-status.error {
    color: var(--color-error);
  }

  .related-card {
    background: color-mix(in srgb, var(--color-surface-1) 72%, var(--color-bg));
  }

  .checklist span {
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

  @media (max-width: 1040px) {
    .top-bar,
    .editor-grid,
    .editor-meta {
      grid-template-columns: 1fr;
    }

    .top-actions {
      justify-content: flex-start;
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

    .editor-meta div + div {
      border-top: var(--line-thin) solid var(--color-line-2);
      border-left: 0;
    }
  }

  @media (max-width: 720px) {
    .editor-shell {
      padding: 0 1.25rem 4rem;
    }

    .top-bar {
      position: static;
    }

    .top-actions,
    .top-actions :global(.ga-btn),
    .top-actions button,
    .top-actions a,
    .field-row {
      width: 100%;
    }

    .field-row {
      grid-template-columns: 1fr;
    }

    .field-label {
      border-right: 0;
      border-bottom: var(--line-thin) solid var(--color-line-1);
      padding-bottom: 0.75rem;
    }
  }
</style>
