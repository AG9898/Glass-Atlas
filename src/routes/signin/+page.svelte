<script lang="ts">
  import { onMount } from 'svelte';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
  let signInForm: HTMLFormElement | undefined;

  onMount(() => {
    // If Auth.js bounced back with an error, keep the page interactive and
    // avoid an automatic retry loop.
    const error = new URLSearchParams(window.location.search).get('error');
    if (error) {
      return;
    }

    signInForm?.requestSubmit();
  });
</script>

<svelte:head>
  <title>Sign In | Glass Atlas</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<main class="signin-shell">
  <section class="signin-card">
    <p class="eyebrow">Admin Access</p>
    <h1>Sign In</h1>
    <p class="lede">Use your GitHub account to access the Glass Atlas admin dashboard.</p>

    <form method="POST" bind:this={signInForm}>
      <!--
        providerId tells the Auth.js SvelteKitAuth action which provider to use.
        redirectTo is forwarded to Auth.js as the post-sign-in destination.
        Auth.js reads these fields from FormData in its signIn action wrapper.
      -->
      <input type="hidden" name="providerId" value="github" />
      <input type="hidden" name="redirectTo" value={data.callbackUrl} />
      <button type="submit" class="signin-btn">Sign in with GitHub</button>
    </form>
  </section>
</main>

<style>
  .signin-shell {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 60vh;
    padding: var(--space-8) var(--space-4);
  }

  .signin-card {
    width: 100%;
    max-width: 24rem;
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  h1 {
    font-size: var(--text-2xl);
    font-weight: 600;
    margin: 0;
  }

  .lede {
    color: var(--color-muted);
    margin: 0;
  }

  .signin-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    padding: var(--space-3) var(--space-4);
    background: var(--color-surface-raised);
    border: 1px solid var(--color-border);
    font-size: var(--text-sm);
    font-weight: 500;
    cursor: pointer;
    transition: background 150ms ease;
  }

  .signin-btn:hover {
    background: var(--color-surface-hover);
  }
</style>
