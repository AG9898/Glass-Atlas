# GSAP Integration Spec

Status: `approved-for-public-motion-pass`

This document defines the first GSAP motion architecture for Glass Atlas. The initial implementation scope is the public-facing website only: `/`, `/notes`, `/notes/[slug]`, and public editorial routes such as `/how-it-works`.

Related docs:

- [styleguide.md](styleguide.md)
- [bits-ui.md](bits-ui.md)
- [CONVENTIONS.md](CONVENTIONS.md)
- [TESTING.md](TESTING.md)

---

## 1) Decision

- GSAP is the selected animation engine for advanced motion in this project.
- CSS/Svelte transitions remain the default for simple hover, focus, and show/hide states.
- Public editorial surfaces may use GSAP for staged reveals, section choreography, page transitions, smooth scroll, and multi-element timelines.
- Admin surfaces stay low-motion by default. Admin may use small state transitions, but no motion-heavy page choreography unless a separate task explicitly opts it in.

---

## 2) Motion Character

Glass Atlas motion should feel like **soft editorial brutalism in motion**:

- Structural: line-led, grid-aware, and aligned to the existing divider system.
- Editorial: paced for reading, not spectacle.
- Restrained: no bouncing, elastic UI, glow-heavy treatments, decorative blobs, or gratuitous parallax.
- Material-light: flat surfaces remain flat; motion should not introduce shadow/elevation systems.
- Enhancement-first: content order, readability, and navigation must work without motion.

Approved timing/easing defaults:

- Micro polish: `120ms-240ms`, CSS transitions preferred.
- Component entrance: `240ms-450ms`, `power2.out` or `power3.out`.
- Section choreography: `450ms-800ms`, small offsets only.
- Page transition overlay: `300ms-600ms`, must never block interaction after navigation settles.
- Smooth scroll: subtle smoothing only; avoid heavy inertia.

---

## 3) Tier 1: Subtle Polish

Tier 1 is the first layer of visible polish. It should be nearly invisible when done well.

Approved candidates:

- Landing hero: stagger eyebrow, title, CTA, and chat panel on first paint.
- Landing stats: softly reveal values and labels with a small stagger.
- Notes index: animate row entrance on load and after filter navigation.
- Note detail: reveal cover media, category, title, metadata, tags, and takeaway as one short timeline.
- Chat UI: animate new user/assistant messages and source controls after source metadata arrives.
- Nav/theme toggle: small icon crossfade/rotation and active-link underline movement.

Constraints:

- Use small movement only: usually `y: 8-20px` plus `autoAlpha`.
- Do not animate every repeated item if the list is long; cap/stagger responsibly.
- Do not delay readable text behind long intro animation.

---

## 4) Tier 2: Editorial Choreography

Tier 2 adds a more authored public-site feel while staying aligned with the visual system.

Approved candidates:

- Scroll-triggered public section reveals for landing modules and editorial route sections.
- Rule-line drawing: horizontal and vertical dividers animate as structural cues.
- Notes browse transitions: outgoing rows exit subtly and incoming rows enter after URL/filter changes.
- Note detail body: the first few major blocks can reveal on entry; the full article body must not animate paragraph-by-paragraph.
- Media blocks: cover and inline media may reveal with clip/fade timing when they enter the viewport.
- Public page transitions: use a fast line/grid wipe or editorial plate between route changes.

Constraints:

- Do not pin large reading sections by default.
- Do not use scroll-jacking patterns that trap the reader.
- Do not add motion that competes with long-form reading.
- ScrollTrigger timelines must be cleaned up on component destroy and refreshed after route/layout changes.

---

## 5) Smooth Scroll

Glass Atlas may use `ScrollSmoother` for the public site if it passes accessibility and route-navigation checks.

Implementation requirements:

- Register `ScrollTrigger` and `ScrollSmoother` client-side only.
- Scope the smoother to public page content, not admin.
- Use a conservative smoothing value; the goal is creamy scroll, not heavy momentum.
- Disable ScrollSmoother when `prefers-reduced-motion: reduce` matches.
- Preserve native browser expectations: keyboard scroll, focus navigation, anchor links, browser find, and scroll restoration must remain usable.
- Call `ScrollTrigger.refresh()` after route changes, font/media load events that affect layout, or dynamic list changes.

Fallback:

- If ScrollSmoother creates route, focus, or accessibility problems, keep ScrollTrigger choreography and fall back to native scroll plus CSS `scroll-behavior: smooth` where appropriate.

---

## 6) Branded Motion Assets

The first branded motion asset direction is an animated, wave-like 3D grid field using the Glass Atlas palette.

Visual requirements:

- Use line/grid language, not blobs, orbs, glassmorphism, or glossy gradients.
- Use the existing neutral, sage, and warm taupe tokens from [styleguide.md](styleguide.md).
- Keep it quiet enough to support editorial content; it should read as a structural atmosphere, not a hero competing with the text.
- Preserve sharp geometry and flat-depth brand rules.
- Provide a reduced-motion fallback as a static frame or very slow nonessential drift.

Implementation options:

- Prefer a lightweight real-time scene when the field is interactive or scroll-coupled. If implemented as true 3D, use Three.js and keep the scene unframed/full-bleed or structurally integrated rather than placed in a decorative card.
- Generated bitmap assets may be used for loader frames, transition plates, or static fallbacks when they match the brand tokens and do not look stock-like.
- Avoid shipping large video assets for this first pass unless a later task defines a performance budget.

---

## 7) Inspiration Pass Requirement

Before implementing public motion work, the agent must spend a short research pass on current GSAP inspiration/sample material. This is part of the task, not optional browsing.

Required sources:

- GSAP official docs for any plugin/API used.
- GSAP Showcase and/or official CodePen collections for motion pattern inspiration.
- One or two high-signal creative coding references such as Codrops GSAP/ScrollTrigger tutorials.

Rules:

- Use the references to study timing, staging, interaction patterns, and implementation structure.
- Do not copy a reference site's aesthetic wholesale.
- Translate inspiration back into Glass Atlas constraints: editorial, line-led, sharp, restrained, token-colored.
- Record the inspiration links in the task notes or final implementation summary.
- When a task finds useful references that apply to a later motion task, append those links and a one-line reason to that later task's notes or acceptance criteria. Prefer this targeted handoff over making every agent repeat the same broad inspiration search.

Useful starting points:

- GSAP Showcase: `https://gsap.com/showcase/`
- GSAP Scroll docs: `https://gsap.com/scroll/`
- ScrollSmoother docs: `https://gsap.com/docs/v3/Plugins/ScrollSmoother/`
- Codrops GSAP tag: `https://tympanus.net/codrops/tag/gsap/`
- Codrops scroll tag: `https://tympanus.net/codrops/tag/scroll/`

---

## 8) Svelte 5 Integration Pattern

Use component-scoped GSAP setup:

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { createPublicGsapContext } from '$lib/motion';

  let container: HTMLElement | null = $state(null);

  onMount(() => {
    if (!container) return;

    const setup = createPublicGsapContext(container, ({ gsap, canUseSpatialMotion }) => {
      if (!canUseSpatialMotion) return;

      gsap.from('[data-motion="item"]', {
        autoAlpha: 0,
        y: 12,
        duration: 0.36,
        stagger: 0.06,
        ease: 'power2.out',
      });
    });

    return () => {
      void setup.then((cleanup) => cleanup());
    };
  });
</script>

<section bind:this={container}>
  <slot />
</section>
```

Rules:

- Use `bind:this` root scopes and `gsap.context()` for cleanup.
- Create `ScrollTrigger` instances inside the same context.
- Use `gsap.matchMedia()` for reduced-motion and responsive variants.
- Never run GSAP setup during SSR.
- Prefer `data-motion` attributes over fragile route-global selectors.

---

## 9) Shipped Foundation

`POLISH-07A` introduced the public motion foundation in `src/lib/motion/`:

- `loadPublicGsap()` dynamically imports `gsap` and `ScrollTrigger`, registers the plugin only in the browser, and returns `null` during SSR.
- `createPublicGsapContext(scope, setup)` wraps component animation setup in `gsap.context(...)` and returns a cleanup that calls `context.revert()`.
- `prefersReducedMotion()` defaults to `true` without a browser window, so spatial choreography is disabled until a real client preference is known.
- `canUseSpatialMotion()` is the default gate for movement such as `x`, `y`, scale, pinning, scrubbed timelines, parallax, or smooth-scroll effects.
- `schedulePublicScrollTriggerRefresh()` and `setupPublicScrollTriggerAutoRefresh()` centralize `ScrollTrigger.refresh()` after route, resize, load, and font-layout changes; they no-op until a component has already loaded GSAP.
- `src/routes/+layout.svelte` wires route-level refresh scheduling for public pages without adding any page choreography.

Usage pattern for future ScrollTrigger work:

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { createPublicGsapContext } from '$lib/motion';

  let section: HTMLElement | null = $state(null);

  onMount(() => {
    if (!section) return;

    const setup = createPublicGsapContext(section, ({ gsap, canUseSpatialMotion }) => {
      if (!canUseSpatialMotion) return;

      gsap.from('[data-motion="rule"]', {
        scaleX: 0,
        transformOrigin: 'left center',
        duration: 0.45,
        ease: 'power2.out',
        scrollTrigger: {
          trigger: section,
          start: 'top 80%',
          once: true,
        },
      });
    });

    return () => {
      void setup.then((cleanup) => cleanup());
    };
  });
</script>
```

Inspiration links recorded for downstream motion tasks:

- GSAP `gsap.context()` docs, `https://gsap.com/docs/v3/GSAP/gsap.context%28%29/` — cleanup/revert contract for Svelte component scopes.
- GSAP `gsap.matchMedia()` docs, `https://gsap.com/docs/v3/GSAP/gsap.matchMedia%28%29/` — responsive and reduced-motion variants inside GSAP-managed contexts.
- GSAP `ScrollTrigger` docs, `https://gsap.com/docs/v3/Plugins/ScrollTrigger/` — refresh/kill semantics for scroll-coupled timelines.
- GSAP Showcase, `https://gsap.com/showcase/` — timing/staging reference only; keep Glass Atlas sharper and more restrained.
- Codrops GSAP tag, `https://tympanus.net/codrops/tag/gsap/` — creative coding reference for scroll structure, not visual style.
