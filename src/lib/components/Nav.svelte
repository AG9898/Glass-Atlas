<script lang="ts">
  import { page } from '$app/stores';
  import { onMount } from 'svelte';

  // Auth session passed from layout data
  let { session = null }: { session?: { user?: { name?: string | null; email?: string | null; image?: string | null } | null } | null } = $props();

  // Dark mode state
  let isDark = $state(false);

  onMount(() => {
    // Read persisted preference or system preference
    const stored = localStorage.getItem('ga-theme');
    if (stored === 'dark') {
      isDark = true;
    } else if (stored === 'light') {
      isDark = false;
    } else {
      isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    applyTheme(isDark);
  });

  function applyTheme(dark: boolean) {
    if (dark) {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
    }
  }

  function toggleDark() {
    isDark = !isDark;
    localStorage.setItem('ga-theme', isDark ? 'dark' : 'light');
    applyTheme(isDark);
  }

  // Derive current path for active link detection
  let pathname: string = $derived($page.url.pathname);
</script>

<header class="ga-nav">
  <!-- Top utility row -->
  <div class="ga-nav__utility">
    <span class="ga-nav__utility-text">GLASS ATLAS</span>
    <span class="ga-nav__utility-text">SINGLE AUTHOR · NOTES PUBLISHED</span>
    <div class="ga-nav__utility-controls">
      <button
        class="ga-nav__theme-toggle"
        onclick={toggleDark}
        aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        title={isDark ? 'Light mode' : 'Dark mode'}
      >
        <span class="ga-nav__theme-icon">{isDark ? '◑' : '○'}</span>
        <span class="ga-nav__theme-label">{isDark ? 'DARK' : 'LIGHT'}</span>
      </button>
    </div>
  </div>

  <!-- Brand + nav row -->
  <div class="ga-nav__brand-row">
    <!-- Left nav links -->
    <nav class="ga-nav__links-left" aria-label="Primary navigation">
      <a
        href="/notes"
        class="ga-nav__link {pathname === '/notes' || pathname.startsWith('/notes/') ? 'ga-nav__link--active' : ''}"
      >
        NOTES
      </a>
      <a
        href="/#chat"
        class="ga-nav__link {pathname === '/' ? '' : ''}"
      >
        CHAT
      </a>
    </nav>

    <!-- Logo (centered) -->
    <a href="/" class="ga-nav__logo" aria-label="Glass Atlas home">
      Glass&nbsp;Atlas
    </a>

    <!-- Right controls -->
    <div class="ga-nav__controls-right">
      <!-- Search icon -->
      <a
        href="/notes?focus=search"
        class="ga-nav__icon-btn"
        aria-label="Search notes"
        title="Search notes"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 18 18"
          fill="none"
          aria-hidden="true"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="square"
        >
          <circle cx="7.5" cy="7.5" r="5" />
          <line x1="11.5" y1="11.5" x2="16" y2="16" />
        </svg>
      </a>

      <!-- Login / Logout -->
      {#if session?.user}
        <a href="/admin" class="ga-nav__link">ADMIN</a>
        <form method="POST" action="/auth/signout" class="ga-nav__auth-form">
          <button type="submit" class="ga-nav__link">
            SIGN OUT
          </button>
        </form>
      {:else}
        <a href="/signin" class="ga-nav__link ga-nav__link--auth">
          LOGIN
        </a>
      {/if}

      <!-- Dark mode toggle (visible on right side as well) -->
      <button
        class="ga-nav__theme-toggle ga-nav__theme-toggle--right"
        onclick={toggleDark}
        aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        title={isDark ? 'Light mode' : 'Dark mode'}
      >
        {isDark ? '◑' : '○'}
      </button>
    </div>
  </div>
</header>

<style>
  .ga-nav {
    border-bottom: 2px solid var(--color-line-3);
    background: var(--color-bg);
    font-family: 'Space Grotesk', 'Inter', 'Segoe UI', sans-serif;
  }

  /* Top utility row */
  .ga-nav__utility {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 48px;
    border-bottom: 1px solid var(--color-line-1);
  }

  .ga-nav__utility-text {
    font-size: 0.68rem;
    font-weight: 500;
    letter-spacing: 0.1em;
    color: var(--color-text-muted);
    text-transform: uppercase;
  }

  .ga-nav__utility-controls {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  /* Brand row */
  .ga-nav__brand-row {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    padding: 24px 48px;
    gap: 24px;
  }

  /* Left nav links */
  .ga-nav__links-left {
    display: flex;
    gap: 28px;
    align-items: center;
  }

  .ga-nav__link {
    font-size: 0.72rem;
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--color-text-muted);
    text-decoration: none;
    padding-bottom: 3px;
    border-bottom: 2px solid transparent;
    transition: color 120ms ease, border-color 120ms ease;
    background: none;
    cursor: pointer;
    font-family: inherit;
  }

  .ga-nav__link:hover {
    color: var(--color-text-strong);
    border-bottom-color: var(--color-line-2);
  }

  .ga-nav__link--active {
    color: var(--color-text-strong);
    border-bottom-color: var(--color-line-3);
  }

  .ga-nav__link--auth {
    border: none;
    padding: 0;
  }

  /* Logo */
  .ga-nav__logo {
    text-align: center;
    font-size: 2.4rem;
    font-weight: 700;
    letter-spacing: -0.035em;
    line-height: 1;
    color: var(--color-text-strong);
    text-decoration: none;
    white-space: nowrap;
    font-family: 'Space Grotesk', 'Inter', 'Segoe UI', sans-serif;
    transition: color 120ms ease;
  }

  .ga-nav__logo:hover {
    color: var(--color-accent-700);
  }

  /* Right controls */
  .ga-nav__controls-right {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 20px;
  }

  /* Auth form (inline form for signout POST) */
  .ga-nav__auth-form {
    display: contents;
  }

  /* Search icon button */
  .ga-nav__icon-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--color-text-muted);
    text-decoration: none;
    transition: color 120ms ease;
    cursor: pointer;
    background: none;
    border: none;
    padding: 2px;
  }

  .ga-nav__icon-btn:hover {
    color: var(--color-text-strong);
  }

  /* Theme toggle */
  .ga-nav__theme-toggle {
    background: none;
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 6px;
    color: var(--color-text-muted);
    font-family: inherit;
    font-size: 0.68rem;
    font-weight: 500;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    padding: 0;
    transition: color 120ms ease;
  }

  .ga-nav__theme-toggle:hover {
    color: var(--color-text-strong);
  }

  .ga-nav__theme-icon {
    font-size: 0.85rem;
  }

  /* Right-side theme toggle (icon only, no label) */
  .ga-nav__theme-toggle--right {
    font-size: 1rem;
    letter-spacing: 0;
    gap: 0;
  }

  /* Responsive: collapse utility row on mobile */
  @media (max-width: 768px) {
    .ga-nav__utility {
      padding: 8px 20px;
    }

    .ga-nav__utility-text:nth-child(2) {
      display: none;
    }

    .ga-nav__brand-row {
      padding: 16px 20px;
      gap: 12px;
    }

    .ga-nav__logo {
      font-size: 1.6rem;
    }

    .ga-nav__links-left {
      gap: 16px;
    }

    .ga-nav__controls-right {
      gap: 12px;
    }
  }

  @media (max-width: 480px) {
    .ga-nav__brand-row {
      grid-template-columns: auto 1fr auto;
    }

    .ga-nav__logo {
      font-size: 1.3rem;
      order: -1;
    }
  }
</style>
