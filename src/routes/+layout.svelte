<script lang="ts">
  import { env } from '$env/dynamic/public';
  import { afterNavigate } from '$app/navigation';
  import { page } from '$app/stores';
  import { onMount } from 'svelte';
  import '../app.css';
  import Nav from '$lib/components/Nav.svelte';
  import PageTransitionOverlay from '$lib/components/PageTransitionOverlay.svelte';
  import {
    isPublicSmoothScrollPath,
    publicSmoothScroll,
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
  const usePublicSmoothScroll = $derived(isPublicSmoothScrollPath($page.url.pathname));

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

<PageTransitionOverlay />

{#if usePublicSmoothScroll}
  <div id="smooth-wrapper" data-public-smooth-wrapper use:publicSmoothScroll>
    <div id="smooth-content" data-public-smooth-content>
      {@render children()}
    </div>
  </div>
{:else}
  {@render children()}
{/if}
