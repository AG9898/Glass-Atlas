<script lang="ts">
  import { PUBLIC_SITE_URL } from '$env/static/public';
  import '../app.css';
  import Nav from '$lib/components/Nav.svelte';

  let { children, data } = $props();

  const SITE_TITLE = 'Glass Atlas';
  const SITE_DESCRIPTION =
    'Glass Atlas is an editorial knowledge base of software notes, with grounded chat answers linked to published writing.';
  const siteUrl = $derived(
    PUBLIC_SITE_URL.endsWith('/') ? PUBLIC_SITE_URL.slice(0, -1) : PUBLIC_SITE_URL,
  );
</script>

<svelte:head>
  <title>{SITE_TITLE}</title>
  <meta name="description" content={SITE_DESCRIPTION} />
  <meta property="og:title" content={SITE_TITLE} />
  <meta property="og:description" content={SITE_DESCRIPTION} />
  <meta property="og:type" content="website" />
  <meta property="og:url" content={siteUrl} />
</svelte:head>

<Nav session={data.session} />

{@render children()}
