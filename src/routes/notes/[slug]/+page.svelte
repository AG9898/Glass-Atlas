<script lang="ts">
  import NoteDetail from '$lib/components/NoteDetail.svelte';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  const { note, bodyHtml, allPublished, relatedNotes } = $derived(data);

  function firstSentence(text: string): string {
    const normalized = text.replace(/\s+/g, ' ').trim();
    if (!normalized) return '';
    const match = normalized.match(/^(.+?[.!?])(?:\s|$)/);
    return (match?.[1] ?? normalized).trim();
  }

  const metaDescription = $derived(firstSentence(note.body) || note.title);
</script>

<svelte:head>
  <title>{note.title} | Glass Atlas</title>
  <meta name="description" content={metaDescription} />
</svelte:head>

<NoteDetail {note} {bodyHtml} {allPublished} {relatedNotes} />
