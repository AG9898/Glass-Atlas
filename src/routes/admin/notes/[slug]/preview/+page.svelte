<script lang="ts">
  import NoteDetail from '$lib/components/NoteDetail.svelte';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  const { note, bodyHtml, allPublished, relatedNotes } = $derived(data);
</script>

<svelte:head>
  <title>Preview {note.title} | Glass Atlas Admin</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<NoteDetail {note} {bodyHtml} {allPublished} {relatedNotes} />
