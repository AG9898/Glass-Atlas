<script lang="ts">
  import { onMount } from 'svelte';
  import Chat from '$lib/components/Chat.svelte';
  import NoteCard from '$lib/components/NoteCard.svelte';
  import WaveGridField from '$lib/components/WaveGridField.svelte';
  import { createPublicGsapContext, schedulePublicScrollTriggerRefresh } from '$lib/motion';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
  let landingShell: HTMLElement | null = $state(null);

  const numberFormatter = new Intl.NumberFormat('en-US');

  const statItems = $derived([
    {
      label: 'Published Notes',
      value: numberFormatter.format(data.stats.publishedNotes),
    },
    {
      label: 'Distinct Topics',
      value: numberFormatter.format(data.stats.distinctTopics),
    },
    {
      label: 'Avg Words / Note',
      value: numberFormatter.format(data.stats.averageWordCount),
    },
    {
      label: 'Citations Served',
      value: numberFormatter.format(data.stats.totalCitations),
    },
  ]);

  onMount(() => {
    if (!landingShell) return;

    const setup = createPublicGsapContext(landingShell, ({ gsap, canUseSpatialMotion }) => {
      if (!canUseSpatialMotion) return;

      gsap.set('[data-motion="hero-rule"], [data-motion="latest-rule"]', {
        transformOrigin: 'left center',
      });

      const heroTimeline = gsap.timeline({
        defaults: { duration: 0.42, ease: 'power3.out' },
      });

      heroTimeline
        .from('[data-motion="hero-rule"]', { scaleX: 0, duration: 0.56 }, 0)
        .from('[data-motion="hero-copy"]', { autoAlpha: 0, y: 12, stagger: 0.07 }, 0.08)
        .from('[data-motion="hero-chat"]', { autoAlpha: 0, y: 16, duration: 0.48 }, 0.16)
        .from('[data-motion="stat"]', { autoAlpha: 0, y: 10, stagger: 0.05 }, 0.34);

      gsap
        .timeline({
          defaults: { duration: 0.4, ease: 'power2.out' },
          scrollTrigger: {
            trigger: '[data-motion-section="latest"]',
            start: 'top 82%',
            once: true,
          },
        })
        .from('[data-motion="latest-rule"]', { scaleX: 0, duration: 0.5 }, 0)
        .from('[data-motion="latest-heading"]', { autoAlpha: 0, y: 10 }, 0.08)
        .from('[data-motion="latest-note"]', { autoAlpha: 0, y: 14, stagger: 0.06 }, 0.18);

      schedulePublicScrollTriggerRefresh('layout');
    });

    return () => {
      void setup.then((cleanup) => cleanup());
    };
  });
</script>

<svelte:head>
  <title>Glass Atlas | Notes From Practice</title>
  <meta
    name="description"
    content="Grounded engineering notes with live chat and the latest field entries from Glass Atlas."
  />
</svelte:head>

<main class="landing-shell" aria-labelledby="landing-title" bind:this={landingShell}>
  <section class="hero" aria-label="Landing hero" data-motion-section="hero">
    <span class="motion-rule motion-rule--top" data-motion="hero-rule" aria-hidden="true"></span>
    <span class="motion-rule motion-rule--bottom" data-motion="hero-rule" aria-hidden="true"></span>

    <aside id="chat" class="hero-chat" aria-label="Grounded chat panel" data-motion="hero-chat">
      <Chat compact />
    </aside>

    <div class="hero-copy">
      <p class="hero-eyebrow" data-motion="hero-copy">Glass Atlas</p>
      <h1 id="landing-title" data-motion="hero-copy">Notes from a developer who would rather show his work.</h1>
      <a class="ga-btn ga-btn-primary ga-btn-lg hero-cta ga-focus-ring" href="/notes" data-motion="hero-copy"
        >Read The Latest</a
      >
    </div>
  </section>

  <section class="wave-band" aria-hidden="true">
    <WaveGridField />
  </section>

  <section class="stats" aria-label="Site statistics">
    {#each statItems as stat}
      <article class="stat-item" data-motion="stat">
        <p class="stat-value">{stat.value}</p>
        <p class="stat-label">{stat.label}</p>
      </article>
    {/each}
  </section>

  <section class="latest" aria-labelledby="latest-title" data-motion-section="latest">
    <header class="latest-header" data-motion="latest-heading">
      <span class="motion-rule motion-rule--latest" data-motion="latest-rule" aria-hidden="true"></span>
      <p class="latest-eyebrow">Archive</p>
      <h2 id="latest-title">The latest field notes.</h2>
    </header>

    {#if data.latestNotes.length === 0}
      <p class="latest-empty">No published notes yet.</p>
    {:else}
      <div class="latest-list">
        {#each data.latestNotes as note, index (note.slug)}
          <NoteCard {note} {index} />
        {/each}
      </div>
    {/if}
  </section>
</main>

<style>
  .landing-shell {
    width: min(100%, 1440px);
    margin: 0 auto;
    padding: 3rem 3rem 6rem;
  }

  .hero {
    position: relative;
    display: grid;
    grid-template-columns: minmax(0, 2fr) minmax(0, 3fr);
    gap: 2rem;
    align-items: stretch;
    padding: 2.25rem 0;
  }

  .motion-rule {
    position: absolute;
    left: 0;
    right: 0;
    z-index: 1;
    display: block;
    pointer-events: none;
    background: var(--color-line-3);
  }

  .motion-rule--top {
    top: 0;
    height: var(--line-strong);
  }

  .motion-rule--bottom,
  .motion-rule--latest {
    bottom: 0;
    height: var(--line-std);
  }

  .hero-copy {
    display: grid;
    align-content: start;
    gap: 1.5rem;
    padding-right: 1.25rem;
    /*
     * Markup order puts the chat panel first so mobile (single-column)
     * stacking keeps the chat-first hierarchy without scrolling past the
     * headline. Desktop keeps copy on the left visually via explicit
     * grid-column/grid-row placement, independent of DOM order (grid-row
     * is required too — without it, auto-placement pushes the
     * out-of-DOM-order item to a second row instead of sharing row 1).
     */
    grid-column: 1 / 2;
    grid-row: 1;
  }

  .hero-eyebrow {
    margin: 0;
    color: var(--color-text-muted);
    font-family: 'Space Grotesk', 'Inter', 'Segoe UI', sans-serif;
    font-size: 0.72rem;
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }

  h1,
  h2,
  p {
    margin: 0;
  }

  h1 {
    color: var(--color-text-strong);
    font-family: 'Literata', Georgia, 'Times New Roman', serif;
    font-size: clamp(2.2rem, 5.2vw, 4.6rem);
    font-weight: 500;
    letter-spacing: -0.02em;
    line-height: 0.98;
    max-width: 14ch;
  }

  .hero-cta {
    justify-self: start;
    text-decoration: none;
    min-width: 14rem;
  }

  .hero-chat {
    grid-column: 2 / 3;
    grid-row: 1;
    inline-size: min(100%, 790px);
    min-width: 0;
    background: var(--color-surface-1);
    justify-self: end;
  }

  .wave-band {
    border-top: var(--line-std) solid var(--color-line-3);
    border-bottom: var(--line-std) solid var(--color-line-3);
  }

  .stats {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    border-bottom: var(--line-std) solid var(--color-line-3);
  }

  .stat-item {
    display: grid;
    gap: 0.35rem;
    padding: 1.15rem 1rem;
    border-right: var(--line-thin) solid var(--color-line-2);
    background: var(--color-surface-1);
  }

  .stat-item:last-child {
    border-right: 0;
  }

  .stat-value {
    color: var(--color-text-strong);
    font-family: 'Space Grotesk', 'Inter', 'Segoe UI', sans-serif;
    font-size: clamp(1.2rem, 2.4vw, 2rem);
    font-weight: 700;
    line-height: 1;
    letter-spacing: -0.01em;
  }

  .stat-label {
    color: var(--color-text-muted);
    font-family: 'Space Grotesk', 'Inter', 'Segoe UI', sans-serif;
    font-size: 0.66rem;
    font-weight: 600;
    letter-spacing: 0.09em;
    text-transform: uppercase;
  }

  .latest {
    padding-top: 2rem;
  }

  .latest-header {
    position: relative;
    margin-bottom: 0;
    padding-bottom: 1rem;
  }

  .latest-eyebrow {
    margin-bottom: 0.6rem;
    color: var(--color-text-muted);
    font-family: 'Space Grotesk', 'Inter', 'Segoe UI', sans-serif;
    font-size: 0.72rem;
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }

  h2 {
    color: var(--color-text-strong);
    font-family: 'Space Grotesk', 'Inter', 'Segoe UI', sans-serif;
    font-size: clamp(2rem, 5.4vw, 4rem);
    font-weight: 700;
    letter-spacing: -0.03em;
    line-height: 0.96;
  }

  .latest-list {
    border-top: var(--line-std) solid var(--color-line-3);
  }

  .latest-empty {
    margin-top: 1.25rem;
    padding: 1.25rem;
    border: var(--line-std) solid var(--color-line-3);
    background: var(--color-surface-1);
    color: var(--color-text-muted);
  }

  @media (max-width: 1100px) {
    .hero {
      grid-template-columns: 1fr;
    }

    .hero-copy {
      padding-right: 0;
      /* Single column now: fall back to DOM order (chat, then copy) so the
         chat panel stays first in the mobile viewport. */
      grid-column: auto;
      grid-row: auto;
    }

    h1 {
      max-width: 100%;
    }

    .hero-chat {
      grid-column: auto;
      grid-row: auto;
      inline-size: 100%;
      justify-self: stretch;
    }

    .stats {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .stat-item:nth-child(2n) {
      border-right: 0;
    }

    .stat-item:nth-child(-n + 2) {
      border-bottom: var(--line-thin) solid var(--color-line-2);
    }
  }

  @media (max-width: 700px) {
    .landing-shell {
      padding: 2.5rem 1.25rem 5rem;
    }

    h1 {
      font-size: clamp(2rem, 10vw, 3rem);
      line-height: 1;
    }

    .stats {
      grid-template-columns: 1fr;
    }

    .stat-item {
      border-right: 0;
      border-bottom: var(--line-thin) solid var(--color-line-2);
    }

    .stat-item:last-child {
      border-bottom: 0;
    }
  }
</style>
