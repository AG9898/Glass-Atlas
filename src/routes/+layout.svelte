<script lang="ts">
  import { env } from '$env/dynamic/public';
  import { afterNavigate } from '$app/navigation';
  import { onMount } from 'svelte';
  import '../app.css';
  import Nav from '$lib/components/Nav.svelte';
  import {
    schedulePublicScrollTriggerRefresh,
    setupPublicScrollTriggerAutoRefresh,
  } from '$lib/motion';

  let { children, data } = $props();

  const SITE_TITLE = 'Glass Atlas';
  const SITE_DESCRIPTION =
    'Glass Atlas is an editorial knowledge base of software notes, with grounded chat answers linked to published writing.';
  const configuredSiteUrl = env.PUBLIC_SITE_URL?.trim() || 'http://localhost:5173';
  const siteUrl = $derived(
    configuredSiteUrl.endsWith('/') ? configuredSiteUrl.slice(0, -1) : configuredSiteUrl,
  );

  afterNavigate(() => {
    schedulePublicScrollTriggerRefresh('route');
  });

  onMount(() => setupPublicScrollTriggerAutoRefresh());
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
