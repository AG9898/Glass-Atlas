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
- Nav/theme toggle: small icon crossfade/rotation and active-link underline movement. (**Shipped as `POLISH-07I`**, expanded beyond icon crossfade into a full-screen directional wipe — see below.)

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

Glass Atlas uses `ScrollSmoother` for public editorial page content only. The root layout wraps public routes in `#smooth-wrapper` / `#smooth-content` and mounts the `publicSmoothScroll` action from `src/lib/motion/smooth-scroll.ts`; admin, auth, sign-in, and API surfaces stay outside that wrapper.

Implementation requirements:

- Register `ScrollTrigger` and `ScrollSmoother` client-side only.
- Scope the smoother to public page content, not admin.
- Use the conservative shared `PUBLIC_SMOOTH_SCROLL_CONFIG` (`smooth: 0.45`, no effects, no touch smoothing, no `normalizeScroll`); the goal is creamy scroll, not heavy momentum.
- Disable ScrollSmoother when `prefers-reduced-motion: reduce` matches.
- Preserve native browser expectations: keyboard scroll, focus navigation, anchor links, browser find, and scroll restoration must remain usable.
- Call `ScrollTrigger.refresh()` after route changes, font/media load events that affect layout, or dynamic list changes.

Fallback:

- If ScrollSmoother creates route, focus, or accessibility problems, keep ScrollTrigger choreography and fall back to native scroll; add CSS `scroll-behavior: smooth` only where reduced-motion and anchor-navigation checks remain clean.

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
- `POLISH-07B` added the public smooth-scroll layer:
  - `loadPublicGsap()` now dynamically imports and registers `ScrollSmoother` with `ScrollTrigger`, still client-side only.
  - `publicSmoothScroll` mounts ScrollSmoother on the public route wrapper, watches `prefers-reduced-motion`, kills the smoother when reduction is requested or the wrapper unmounts, and schedules a `ScrollTrigger.refresh()` after setup/teardown.
  - `isPublicSmoothScrollPath()` keeps admin, auth, sign-in, and API paths outside the smoother while allowing current and future public editorial routes.
  - `src/app.css` defines only minimal wrapper sizing/reset styles so content remains readable before JS initializes and reduced-motion can remove active transforms.
- `POLISH-07C` added the first landing-page choreography in `src/routes/+page.svelte`:
  - The homepage root binds a local GSAP context and uses `data-motion` hooks for hero copy, CTA, chat panel, stats, latest-note rows, and structural rule lines.
  - First-paint motion stays short and staged: rule draw, hero copy, chat panel, then stat values. The latest-note section uses a one-shot ScrollTrigger reveal for its rule/header/rows.
  - Reduced-motion users get the normal static page immediately because the setup exits before applying spatial transforms.
  - Note rows expose `data-motion="latest-note"` from `NoteCard.svelte`; keep this hook stable for landing choreography, but do not make `NoteCard` own page-level timelines.
- `POLISH-07D` added notes-index and note-detail choreography:
  - `/notes` binds a page-local GSAP context keyed to the filtered note slug list. Note rows expose `data-note-motion="row"` and enter with capped transform/opacity staggers on first load and URL filter/sort changes; the existing `data-motion="latest-note"` hook remains reserved for landing-page choreography.
  - `NoteDetail.svelte` binds its own GSAP context and reveals cover media, title, metadata, tags, and takeaway as one short editorial sequence. Cover media uses a small clip/offset reveal, not autoplay or parallax.
  - Only the first four major direct article blocks are eligible for body reveal via a one-shot ScrollTrigger. The rest of the article is immediate so long-form reading is not paced paragraph-by-paragraph.
  - Reduced-motion users skip these spatial timelines entirely because both contexts exit before applying transforms.
- `POLISH-07E` added the public route transition/loader overlay:
  - `src/lib/motion/page-transition.ts` holds pure, testable logic only: `isPublicRouteTransitionPath()` (reuses `isPublicSmoothScrollPath()` so route gating stays a single source of truth), `shouldSkipPageTransition(fromPathname, toPathname)` (skips hash/query-only navigations to the same pathname and admin-to-admin/API-to-API navigations where neither side is public), the three `inset()` clip-path constants (idle/covered/revealed), and the cover/reveal duration + ease constants. No GSAP import lives in this file.
  - `src/lib/components/PageTransitionOverlay.svelte` owns the actual timeline: a single full-viewport `<div>` calls `beforeNavigate` to wipe a clip-path mask across the viewport (cover) and `afterNavigate` to wipe it back off (reveal), both as `gsap.fromTo(...)` calls inside a `createPublicGsapContext(...)` scope. The gate is `motion.canUseSpatialMotion` (checked once when GSAP finishes loading, matching the `POLISH-07C`/`POLISH-07D` single-check pattern) — reduced-motion users get instant native navigation because neither tween ever fires, and a `prefers-reduced-motion: reduce` CSS rule also force-pins the overlay's clip-path to fully hidden as a defense-in-depth backstop.
  - The overlay creates no `ScrollTrigger` instances at all (plain `gsap.fromTo` tweens only), so it cannot duplicate or interfere with the smooth-scroll layer's `ScrollTrigger.refresh()` scheduling.
  - `src/routes/+layout.svelte` mounts `<PageTransitionOverlay />` as a sibling of the `#smooth-wrapper`/`#smooth-content` block (not inside it). This is required, not stylistic: `ScrollSmoother` applies `transform` to `#smooth-content`, and a `transform` on an ancestor creates a new containing block for `position: fixed` descendants — a fixed-position overlay nested inside that content div would be fixed relative to the transformed content, not the real viewport.
  - The overlay itself has `pointer-events: none` for its entire lifecycle, so it is inert with respect to interaction even while visually covering the screen — it can never trap clicks/focus after navigation settles.
  - Visual treatment stays restrained: a flat `--color-bg` panel wiped by the clip-path `inset()` mask itself (the "sharp rectangular mask" called for in `docs/styleguide.md` section 7.4). No new accent family, no gradients, no blur. (Reworked in `POLISH-07H`: the panel's background is now the wave-grid loader rather than a plain repeating vertical rule — see below.)
- `POLISH-07F` shipped the first branded motion asset (§6): a wave-like, line-based 3D grid field.
  - `src/lib/components/WaveGridField.svelte` (since reworked into `WaveGridLoader.svelte`, see `POLISH-07H` below) rendered an SSR-safe static inline-SVG line-grid frame unconditionally, then — only in the browser and only when `shouldUseWaveGridMotion()` (`src/lib/motion/wave-grid.ts`) allows it — dynamically imported `three` inside `onMount` and layered a `<canvas>` on top driving a sparse `THREE.LineSegments` wireframe grid with a per-vertex sine-wave displacement.
  - This asset is **not GSAP** (Three.js, not `gsap`/`ScrollTrigger`) but follows the same reduced-motion-first, SSR-safe, full-teardown discipline as the rest of this spec, and lives in `src/lib/motion/` alongside the GSAP helpers per the shared "public motion foundation" module layout.
  - Originally integrated into `src/routes/+page.svelte` as a bounded structural band between the hero and stats sections; removed from the homepage in `POLISH-07H` (see below).
  - Colors are read live from the CSS custom properties via `getComputedStyle`, so light/dark parity is automatic; a hardcoded light-mode hex fallback covers non-browser/SSR contexts.
  - Reduced-motion users never trigger the `three` import — verified by inspecting the rendered DOM under `--force-prefers-reduced-motion` in headless Chrome, which showed no `<canvas>` element at all, only the static fallback frame.
  - Browser smoke verification (headless Chrome with software WebGL via `--use-angle=swiftshader --enable-unsafe-swiftshader`) confirmed nonblank canvas rendering with `data-engine="three.js r180"` present, responsive framing at both a 1440×900 desktop viewport and a 390×844 mobile viewport, and correct light/dark token parity.
- `POLISH-07G` ran the final integration QA pass across `07A`–`07F` together (smooth scroll + landing/notes/detail choreography + route transition overlay + wave-grid asset, all mounted at once) and found no regressions in the shipped motion work. Verified via a CDP-driven headless Chrome harness (see `docs/TESTING.md` "Motion QA" section for the technique): hero/stats/latest-note entrance timelines reach `opacity: 1` on load; reduced-motion (`--force-prefers-reduced-motion`) keeps hero content at `opacity: 1`/`transform: none` immediately, mounts no `<canvas>` for the wave-grid, and never creates a `ScrollSmoother` instance; `ScrollTrigger.getAll().length` and `ScrollSmoother.get()` stay at a stable, expected count (not growing) across repeated SPA navigation (`/` → `/notes` → `/notes/[slug]` → back/forward → repeated loops), confirming no duplicated instances; the route transition overlay's `clip-path` always settles back to fully hidden after navigation and stays `pointer-events: none` throughout, in both normal and reduced-motion navigation; anchor navigation (`/notes` → `/#chat`) and real keyboard `Tab` focus both work correctly alongside the mounted `ScrollSmoother`; and the wave-grid band does not overlap hero copy/CTA/chat or stats text at a 390×844 mobile viewport. No console errors were observed in any of these checks. A pre-existing, motion-unrelated `Nav.svelte` mobile overflow was found and is recorded in `AGENTS.md`/`CLAUDE.md` Discoveries rather than fixed here, since it is outside this task's scope (no `POLISH-07` task touches `Nav.svelte`).
- `POLISH-07H` reworked the wave-grid asset from a homepage decoration into the shared loading/spinner primitive across the app, following the exact direction this file (§7.4 references above) and `docs/styleguide.md` §7.3/§7.4 already anticipated ("a loader/transition plate", "loader frames, transition plates... when they match this style").
  - `src/lib/motion/wave-grid-engine.ts` is a new framework-agnostic module holding the scene/layer construction (`createWaveGridScene`, `createWaveGridLayers`, `createGridSegments`, `updateWaveGridLayer`) extracted out of the Svelte component, generalized so emphasis-row/column indices are computed from `config.rows`/`config.columns` fractions instead of hardcoded absolute indices — required so the same builder works for both grid sizes below.
  - `src/lib/motion/wave-grid.ts` now exposes two configs via `getWaveGridConfig(variant)`: `WAVE_GRID_OVERLAY_CONFIG` (the original full-viewport 18×9 grid, used for the transition overlay and initial-load splash) and a new, smaller/denser `WAVE_GRID_COMPACT_CONFIG` (8×5 grid, closer camera, faster wave speed) for the inline spinner.
  - `src/lib/components/WaveGridLoader.svelte` replaces `WaveGridField.svelte`: same SSR-safe-fallback-then-canvas-overlay discipline, but the static fallback is now a CSS `repeating-linear-gradient` grid pattern (both axes, no inline SVG paths) since the component no longer needs to match one fixed band shape.
  - `PageTransitionOverlay.svelte`: the loader is conditionally mounted (`{#if showLoader}`) only while the overlay is actually covering the screen — `showLoader` flips `true` in `beforeNavigate` alongside the cover tween and `false` in the reveal tween's `onComplete`, after `clip-path` resets to idle. This means the three.js scene is created and torn down fresh per navigation rather than running continuously between transitions.
  - `InitialLoadScreen.svelte` (new) wraps the overlay-variant loader as a fullscreen boot splash, mounted in `+layout.svelte` gated on the same public-route check as smooth scroll (`isPublicSmoothScrollPath`) — admin/auth pages never show it, matching §7.1's "admin stays low-motion" rule. It shows once per hard load (the root layout never remounts on SPA navigation), fades out via CSS opacity transition once **both** a fixed `MIN_DISPLAY_MS` (1500ms) has elapsed **and** `document.fonts.ready` has resolved (`Promise.all`, deliberately no upper-bound race/cap) — a fast load still holds the splash the full 1500ms so it reads as persisted rather than a flash, and a slow load simply waits longer rather than being cut off — and renders nothing at all under reduced motion.
  - `Chat.svelte` mounts the compact-variant loader inline next to the "Searching notes…" placeholder message, visible from the moment the user submits until the first streamed token arrives.
  - Verified end-to-end with the CDP-driven headless Chrome technique (`docs/TESTING.md` "Motion QA" section): confirmed the initial-load splash mounts a `<canvas>` and the homepage `.wave-band` is gone; the splash's DOM node is removed after its fade completes; navigating to `/notes` mounts a `.wave-grid-loader`/`<canvas>` inside `.page-transition-overlay` mid-transition and unmounts it after the reveal finishes; and submitting a chat message shows `.ga-chat__searching-spinner` containing a mounted wave grid within 150ms.
- `POLISH-07I` gave the Nav theme toggle (`src/lib/components/Nav.svelte`) a directional "wave" wipe on light/dark switch, per direct user request, reusing the exact clip-path wipe idiom `PageTransitionOverlay` already established rather than inventing a new visual language.
  - This is **not GSAP** — it uses the browser-native View Transitions API (`document.startViewTransition`), which automatically snapshots the before/after DOM paint as two full-viewport images and exposes them as the `::view-transition-old(root)`/`::view-transition-new(root)` pseudo-elements. `toggleDark()` in `Nav.svelte` wraps the existing `.dark` class toggle (`commitThemeChange`) in `document.startViewTransition(...)` only when both `typeof document.startViewTransition === 'function'` (feature detection — Chromium/Edge/Opera and Safari 18+ only, no polyfill) and `canUseSpatialMotion(window)` are true; otherwise it calls the theme change directly for an instant swap, matching this repo's existing reduced-motion-first, progressive-enhancement pattern for every other motion feature.
  - The wipe itself is pure CSS in `src/app.css` (global — `::view-transition-*` pseudo-elements are not real DOM nodes and cannot be targeted from a Svelte component's scoped `<style>` block): `::view-transition-old(root)` gets `animation: none` (stays fully visible, full opacity, for the whole transition), and `::view-transition-new(root)` animates `clip-path` from `inset(0 100% 0 0)` (fully hidden) to `inset(0 0 0 0)` (fully revealed) over 550ms — the same left-to-right sweep semantics as `PAGE_TRANSITION_IDLE_CLIP_PATH`/`PAGE_TRANSITION_COVERED_CLIP_PATH` in `page-transition.ts`, just expressed directly in CSS since `::view-transition-*` selectors can't be driven by a GSAP tween on a normal element reference. The effect: the old theme stays put and the new theme's rectangular reveal sweeps over it left-to-right, rather than the View Transitions API's own default (a plain cross-fade).
  - A `prefers-reduced-motion: reduce` media query force-disables all three `::view-transition-*` animations as a CSS-level backstop, mirroring the same defense-in-depth pattern used for `PageTransitionOverlay`'s clip-path rule — even though the JS-level `canUseSpatialMotion(window)` check already prevents `startViewTransition` from being called at all under reduced motion.
  - Verified via a CDP-driven headless Chrome session: confirmed `document.startViewTransition` is available in this repo's tested Chrome version, clicked the toggle button, and inspected `document.getAnimations({ subtree: true })` ~80ms into the transition to confirm a running animation named `theme-wave-wipe` (plus the browser's own auto-generated `-ua-view-transition-group-anim-root`); confirmed the `.dark` class and `localStorage['ga-theme']` reflect the new theme immediately (the callback runs synchronously; only the paint is deferred/animated) and that all transition animations have cleared (`document.getAnimations().length === 0`) roughly 700ms after the click, comfortably past the 550ms animation duration.

- `POLISH-07J` added an expand/collapse control to the public chat panel (`src/lib/components/Chat.svelte`), per direct user request.
  - A toggle button in the panel header's top right enlarges the chat from its in-flow hero position into a **centered fixed-position rectangle** (`min(92vw, 1040px)` × `min(88vh, 900px)` — deliberately not full screen) over a scrim backdrop matching `.ga-dialog-overlay`'s color, and collapses it back. Restrained motion per §2: a single GSAP FLIP-style rect tween (`power3.inOut`, 0.5s) plus a backdrop opacity fade (0.3s) — no scale/rotation/bounce.
  - Because the panel lives inside the ScrollSmoother-transformed `#smooth-content` (same containing-block constraint that forced `PageTransitionOverlay` to mount outside the wrapper), `expandChat()` reparents the live `<section>` to `document.body` before pinning it `position: fixed`, leaving a same-size placeholder `<div>` in the hero grid cell so layout doesn't collapse; `collapseChat()` tweens back to the placeholder's viewport rect and swaps the section back into flow, clearing all inline styles. Reparenting resets the inner messages viewport's scroll position and drops focus, so both are captured and restored around each move.
  - While expanded: background scroll is locked (pausing the active `ScrollSmoother` when present, `overflow: hidden` on the root element otherwise), Escape and backdrop click both collapse, a window resize re-centers the panel via `gsap.set`, and the toggle carries `aria-expanded` + swapped expand/collapse icons. The sources `Dialog` still stacks above (backdrop z-index 50 / panel 51, below the dialog overlay's 60).
  - Reduced-motion users get an instant snap (`gsap.set` for both rect and backdrop) via a live `canUseSpatialMotion(window)` check — the feature stays fully functional with zero animation. GSAP loads lazily on first expand through the shared `loadPublicGsap()` foundation.
  - Verified via the CDP-driven headless Chrome technique with the desktop-pointer `matchMedia` patch (forcing ScrollSmoother's fixed-wrapper branch — the mode where a non-portaled fixed panel breaks): post-expand rect matched the computed centered target exactly, the section's parent was `document.body`, mid-tween width confirmed real animation, and after Escape / backdrop-click collapse the section was back in the hero `<aside>` with an empty inline `style`, original rect restored, backdrop and placeholder removed, and no console errors.

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
- GSAP Staggers docs, `https://gsap.com/resources/getting-started/Staggers/` — supports the short row/header stagger timing used for notes index and detail header items.
- GSAP ScrollTrigger docs, `https://gsap.com/docs/v3/Plugins/ScrollTrigger/` — supports the one-shot first-block article reveal and cleanup through the shared context.
- GSAP Showcase, `https://gsap.com/showcase/` — reference for restrained sequencing and avoiding overlong intro delays.
- Codrops scroll tag, `https://tympanus.net/codrops/tag/scroll/` — reference for scroll-reveal structure; translated here into small editorial reveals rather than full-screen effects.
- GSAP `gsap.matchMedia()` docs, `https://gsap.com/docs/v3/GSAP/gsap.matchMedia%28%29/` — responsive and reduced-motion variants inside GSAP-managed contexts.
- GSAP `ScrollTrigger` docs, `https://gsap.com/docs/v3/Plugins/ScrollTrigger/` — refresh/kill semantics for scroll-coupled timelines.
- GSAP `ScrollSmoother` docs, `https://gsap.com/docs/v3/Plugins/ScrollSmoother/` — native-scroll-based smooth scrolling and wrapper/content setup.
- GSAP accessibility guide, `https://gsap.com/resources/a11y/` — reduced-motion gating and `matchMedia` guidance.
- GSAP Showcase, `https://gsap.com/showcase/` — timing/staging reference only; keep Glass Atlas sharper and more restrained.
- Codrops GSAP tag, `https://tympanus.net/codrops/tag/gsap/` — creative coding reference for scroll structure, not visual style.
- Codrops scroll tag, `https://tympanus.net/codrops/tag/scroll/` — later smooth-scroll choreography inspiration; avoid its heavier cinematic patterns for core reading pages.
- Codrops, "From Shader Uniforms to Clip-Path Wipes: How GSAP Drives My Portfolio" (2026-05-06), `https://tympanus.net/codrops/2026/05/06/from-shader-uniforms-to-clip-path-wipes-how-gsap-drives-my-portfolio/` — confirms `clip-path` wipes tweened by GSAP are a live, idiomatic pattern; `POLISH-07E` uses plain CSS `inset()` clip-path tweening (no shader/WebGL) to keep the transition flat and restrained.
- Codrops, "Creating Custom Page Transitions in Astro with Barba.js and GSAP" (2026-04-08), `https://tympanus.net/codrops/2026/04/08/creating-custom-page-transitions-in-astro-with-barba-js-and-gsap/` — general overlay-based enter/leave transition structure; translated to SvelteKit's native `beforeNavigate`/`afterNavigate` lifecycle instead of Barba.js for `POLISH-07E` since the project has no separate router to replace.
- GSAP forum, "Svelte Page Transitions with GSAP", `https://gsap.com/community/forums/topic/32347-svelte-page-transitions-with-gsap/` — community pattern of keeping a persistent overlay element in the DOM and driving visibility/opacity or pointer-events on navigation rather than mounting/unmounting a transition component per route; `POLISH-07E` follows the same persistent-overlay approach with a clip-path mask kept `pointer-events: none` for its entire lifecycle.
- `POLISH-07F` references (Three.js, not GSAP — recorded here since this is the shared motion-asset spec; hand forward to any later task that repositions, restyles, or reuses this asset): Three.js official docs for `LineSegments` (`https://threejs.org/docs/#api/en/objects/LineSegments`), `BufferGeometry`/`BufferAttribute` (`https://threejs.org/docs/#api/en/core/BufferGeometry`), `LineBasicMaterial` (`https://threejs.org/docs/#api/en/materials/LineBasicMaterial`), and `PerspectiveCamera` (`https://threejs.org/docs/#api/en/cameras/PerspectiveCamera`) — the API surface `WaveGridLoader.svelte`/`wave-grid-engine.ts` is built on (wireframe line geometry, not a shaded mesh, per the brand's flat-depth/no-glossy-material rule). Live web fetches of these and of creative-coding example galleries were attempted but blocked by this sandbox's network egress policy during `POLISH-07F`; a later task with working web access should do a fuller visual inspiration pass (e.g. Three.js "webgl_geometry_terrain"/"webgl_lines_dashed" example categories via `https://threejs.org/examples/`, and Codrops' WebGL tag `https://tympanus.net/codrops/tag/webgl/`) before any significant restyle of this asset, rather than treating this recorded list as exhaustive. `POLISH-07H` (the reuse this note anticipated) reused the existing implementation directly without needing that fuller inspiration pass, since the loader/transition-plate direction was already the approved target.
- SvelteKit docs, `$app/navigation` (`beforeNavigate`/`afterNavigate`), `https://svelte.dev/docs/kit/$app-navigation` — canonical navigation lifecycle hooks used to trigger the cover/reveal tweens.
