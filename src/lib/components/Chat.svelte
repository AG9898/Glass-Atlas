<script lang="ts">
  import { tick } from 'svelte';
  import { renderChatMessageHtml, parseChatSourcesEvent, type ChatSource } from '$lib/utils/chat-format';
  import { canUseSpatialMotion, loadPublicGsap, type PublicGsap } from '$lib/motion';
  import { Dialog } from '$lib/components/ui';
  import WaveGridLoader from '$lib/components/WaveGridLoader.svelte';

  type ChatRole = 'user' | 'assistant';

  type ChatMessage = {
    role: ChatRole;
    content: string;
    /** Source-popup metadata for assistant messages; absent when there are no sources. */
    sources?: ChatSource[];
  };

  const PLACEHOLDER = 'Ask anything grounded in these notes…';
  const SEARCHING_MESSAGE = 'Searching notes…';
  const RATE_LIMIT_MESSAGE = 'Rate limit reached — try again in an hour.';

  let { compact = false }: { compact?: boolean } = $props();

  let messages = $state<ChatMessage[]>([]);
  let input = $state('');
  let loading = $state(false);
  let error = $state('');
  let messagesViewport: HTMLDivElement | undefined;

  const EXPAND_DURATION = 0.5;
  const EXPAND_EASE = 'power3.inOut';
  const BACKDROP_FADE_DURATION = 0.3;

  let rootEl: HTMLElement | undefined;
  let expandToggle: HTMLButtonElement | undefined;
  let expanded = $state(false);
  let expandAnimating = false;
  let placeholderEl: HTMLDivElement | null = null;
  let backdropEl: HTMLDivElement | null = null;
  let motionRef: PublicGsap | null = null;
  let backgroundScrollLocked = false;

  /** Centered enlarged rectangle — bigger than the in-flow panel, never full screen. */
  function getExpandedTargetRect(): { top: number; left: number; width: number; height: number } {
    const width = Math.min(window.innerWidth * 0.92, 1040);
    const height = Math.min(window.innerHeight * 0.88, 900);
    return {
      width,
      height,
      top: (window.innerHeight - height) / 2,
      left: (window.innerWidth - width) / 2,
    };
  }

  /**
   * Blocks page scroll behind the expanded panel. When the public
   * ScrollSmoother is active, pausing it is the reliable lock (it owns wheel
   * scrolling); the overflow toggle covers the reduced-motion/no-smoother case.
   */
  function setBackgroundScrollLocked(locked: boolean): void {
    backgroundScrollLocked = locked;
    const smoother = motionRef?.ScrollSmoother.get();
    if (smoother) {
      smoother.paused(locked);
    } else {
      document.documentElement.style.overflow = locked ? 'hidden' : '';
    }
  }

  /**
   * Expands the chat into a centered fixed-position rectangle. The section is
   * reparented to `document.body` first because it normally lives inside the
   * transformed `#smooth-content` wrapper, where `position: fixed` would
   * resolve against the smoother's transform instead of the viewport (see
   * AGENTS.md / PageTransitionOverlay). A same-size placeholder keeps the hero
   * grid cell from collapsing while the panel is out of flow.
   */
  async function expandChat(): Promise<void> {
    if (expanded || expandAnimating || !rootEl) return;
    expandAnimating = true;

    motionRef ??= await loadPublicGsap();
    const parent = rootEl?.parentElement;
    if (!motionRef || !rootEl || !parent) {
      expandAnimating = false;
      return;
    }

    const { gsap } = motionRef;
    const startRect = rootEl.getBoundingClientRect();
    const savedScrollTop = messagesViewport?.scrollTop ?? 0;

    placeholderEl = document.createElement('div');
    placeholderEl.setAttribute('aria-hidden', 'true');
    placeholderEl.style.inlineSize = `${startRect.width}px`;
    placeholderEl.style.blockSize = `${startRect.height}px`;
    parent.insertBefore(placeholderEl, rootEl);

    backdropEl = document.createElement('div');
    backdropEl.className = 'ga-chat-backdrop';
    backdropEl.addEventListener('click', () => void collapseChat());
    document.body.append(backdropEl);
    document.body.append(rootEl);

    gsap.set(rootEl, {
      position: 'fixed',
      top: startRect.top,
      left: startRect.left,
      width: startRect.width,
      height: startRect.height,
      margin: 0,
      zIndex: 51,
    });

    expanded = true;
    // Reparenting resets the scroll container and drops focus — restore both.
    if (messagesViewport) messagesViewport.scrollTop = savedScrollTop;
    expandToggle?.focus({ preventScroll: true });
    setBackgroundScrollLocked(true);

    const target = getExpandedTargetRect();

    if (!canUseSpatialMotion(window)) {
      gsap.set(backdropEl, { opacity: 1 });
      gsap.set(rootEl, target);
      expandAnimating = false;
      return;
    }

    gsap.fromTo(
      backdropEl,
      { opacity: 0 },
      { opacity: 1, duration: BACKDROP_FADE_DURATION, ease: 'power2.out' },
    );
    gsap.to(rootEl, {
      ...target,
      duration: EXPAND_DURATION,
      ease: EXPAND_EASE,
      onComplete: () => {
        expandAnimating = false;
      },
    });
  }

  async function collapseChat(): Promise<void> {
    if (!expanded || expandAnimating || !rootEl || !placeholderEl || !motionRef) return;
    expandAnimating = true;

    const { gsap } = motionRef;
    // Background scroll is locked while expanded, so the placeholder's
    // viewport rect is stable and is exactly where the fixed panel must land.
    const targetRect = placeholderEl.getBoundingClientRect();

    if (!canUseSpatialMotion(window)) {
      restoreCollapsedState();
      expandAnimating = false;
      return;
    }

    if (backdropEl) {
      gsap.to(backdropEl, { opacity: 0, duration: BACKDROP_FADE_DURATION, ease: 'power2.in' });
    }
    gsap.to(rootEl, {
      top: targetRect.top,
      left: targetRect.left,
      width: targetRect.width,
      height: targetRect.height,
      duration: EXPAND_DURATION,
      ease: EXPAND_EASE,
      onComplete: () => {
        restoreCollapsedState();
        expandAnimating = false;
      },
    });
  }

  /** Puts the section back into its original flow position and removes the overlay chrome. */
  function restoreCollapsedState(): void {
    const savedScrollTop = messagesViewport?.scrollTop ?? 0;
    if (rootEl && motionRef) {
      motionRef.gsap.set(rootEl, { clearProps: 'position,top,left,width,height,margin,zIndex' });
    }
    if (rootEl && placeholderEl) {
      placeholderEl.replaceWith(rootEl);
    } else {
      placeholderEl?.remove();
    }
    placeholderEl = null;
    backdropEl?.remove();
    backdropEl = null;
    setBackgroundScrollLocked(false);
    expanded = false;
    if (messagesViewport) messagesViewport.scrollTop = savedScrollTop;
    expandToggle?.focus({ preventScroll: true });
  }

  function onToggleExpand(): void {
    if (expanded) {
      void collapseChat();
    } else {
      void expandChat();
    }
  }

  function onWindowKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Escape' || event.defaultPrevented) return;
    if (!expanded || expandAnimating) return;
    event.preventDefault();
    void collapseChat();
  }

  function onWindowResize(): void {
    if (!expanded || expandAnimating || !rootEl || !motionRef) return;
    motionRef.gsap.set(rootEl, getExpandedTargetRect());
  }

  $effect(() => {
    return () => {
      // Unmount while expanded (e.g. navigation): drop the overlay chrome and
      // release the scroll lock; Svelte removes the section itself.
      backdropEl?.remove();
      backdropEl = null;
      placeholderEl?.remove();
      placeholderEl = null;
      if (backgroundScrollLocked) setBackgroundScrollLocked(false);
    };
  });

  async function scrollMessagesToBottom(): Promise<void> {
    await tick();
    messagesViewport?.scrollTo({ top: messagesViewport.scrollHeight, behavior: 'auto' });
  }

  function setLastAssistantMessage(content: string): void {
    if (messages.length === 0) return;

    const lastIndex = messages.length - 1;
    const lastMessage = messages[lastIndex];
    if (!lastMessage || lastMessage.role !== 'assistant') return;

    messages = messages.map((message, index) =>
      index === lastIndex ? { ...message, content } : message,
    );
    void scrollMessagesToBottom();
  }

  /**
   * Attaches source-popup metadata to the last assistant message. Called when
   * the trailing `{ sources }` SSE event arrives, after the answer text has
   * already streamed in. A no-op when there is no in-flight assistant message
   * (mirrors the guard in `setLastAssistantMessage`).
   */
  function setLastAssistantSources(sources: ChatSource[]): void {
    if (messages.length === 0) return;

    const lastIndex = messages.length - 1;
    const lastMessage = messages[lastIndex];
    if (!lastMessage || lastMessage.role !== 'assistant') return;

    messages = messages.map((message, index) =>
      index === lastIndex ? { ...message, sources } : message,
    );
  }

  function extractToken(payload: unknown): string {
    if (typeof payload === 'string') return payload;

    if (typeof payload !== 'object' || payload === null) {
      return '';
    }

    const firstChoice = (payload as { choices?: unknown[] }).choices?.[0];
    if (typeof firstChoice !== 'object' || firstChoice === null) {
      return '';
    }

    const delta = (firstChoice as { delta?: unknown }).delta;
    if (typeof delta === 'object' && delta !== null) {
      const content = (delta as { content?: unknown }).content;

      if (typeof content === 'string') {
        return content;
      }

      if (Array.isArray(content)) {
        return content
          .map((part) => {
            if (typeof part !== 'object' || part === null) return '';
            return typeof (part as { text?: unknown }).text === 'string'
              ? (part as { text: string }).text
              : '';
          })
          .join('');
      }
    }

    const text = (firstChoice as { text?: unknown }).text;
    return typeof text === 'string' ? text : '';
  }

  function parseSseChunk(chunk: string): string[] {
    return chunk
      .split('\n')
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trimStart())
      .filter((line) => line.length > 0);
  }

  /** Mutable per-stream accumulator threaded through `handleSseDataLine`. */
  type StreamState = { assistantText: string; receivedToken: boolean };

  /**
   * Handles one parsed SSE `data:` line for the in-flight assistant response.
   * Each line is either the `[DONE]` sentinel (ignored), the trailing
   * `{ sources }` source-popup event, or an OpenAI-shaped token chunk —
   * shared by both the live-read loop and the final buffered-tail pass so the
   * two never drift out of sync.
   */
  function handleSseDataLine(dataLine: string, state: StreamState): void {
    if (dataLine === '[DONE]') return;

    let parsed: unknown = null;
    try {
      parsed = JSON.parse(dataLine);
    } catch {
      parsed = null;
    }

    if (parsed !== null) {
      const sources = parseChatSourcesEvent(parsed);
      if (sources) {
        setLastAssistantSources(sources);
        return;
      }
    }

    const token = parsed !== null ? extractToken(parsed) : dataLine;
    if (!token) return;

    if (!state.receivedToken) {
      state.assistantText = '';
      state.receivedToken = true;
    }

    state.assistantText += token;
    setLastAssistantMessage(state.assistantText);
  }

  async function onSubmit(event: SubmitEvent): Promise<void> {
    event.preventDefault();

    if (loading) return;

    const message = input.trim();
    if (!message) return;

    error = '';
    input = '';
    loading = true;

    messages = [
      ...messages,
      { role: 'user', content: message },
      { role: 'assistant', content: SEARCHING_MESSAGE },
    ];
    void scrollMessagesToBottom();

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message }),
      });

      if (response.status === 429) {
        error = RATE_LIMIT_MESSAGE;
        setLastAssistantMessage(RATE_LIMIT_MESSAGE);
        return;
      }

      if (!response.ok) {
        const detail = await response.text().catch(() => '');
        throw new Error(detail || `Chat request failed with status ${response.status}.`);
      }

      const stream = response.body;
      if (!stream) {
        throw new Error('Chat stream was empty.');
      }

      const reader = stream.getReader();
      const decoder = new TextDecoder();

      let buffer = '';
      const state: StreamState = { assistantText: '', receivedToken: false };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split('\n\n');
        buffer = events.pop() ?? '';

        for (const eventBlock of events) {
          for (const dataLine of parseSseChunk(eventBlock)) {
            handleSseDataLine(dataLine, state);
          }
        }
      }

      for (const dataLine of parseSseChunk(buffer)) {
        handleSseDataLine(dataLine, state);
      }

      if (!state.receivedToken) {
        setLastAssistantMessage('No response returned.');
      }
    } catch (err: unknown) {
      const detail = err instanceof Error ? err.message : 'Request failed.';
      error = detail;
      setLastAssistantMessage('Unable to load a response right now.');
    } finally {
      loading = false;
    }
  }
</script>

<svelte:window onkeydown={onWindowKeydown} onresize={onWindowResize} />

<section
  class="ga-chat"
  class:ga-chat--compact={compact}
  class:ga-chat--expanded={expanded}
  bind:this={rootEl}
>
  <header class="ga-chat__header">
    <div class="ga-chat__header-text">
      <p class="ga-chat__label">Grounded Chat</p>
      <p class="ga-chat__hint">Answers stream from the note index only.</p>
    </div>
    <button
      type="button"
      class="ga-chat__expand-toggle ga-focus-ring"
      aria-expanded={expanded}
      aria-label={expanded ? 'Collapse chat' : 'Expand chat'}
      title={expanded ? 'Collapse chat' : 'Expand chat'}
      bind:this={expandToggle}
      onclick={onToggleExpand}
    >
      {#if expanded}
        <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M14 6.5H9.5V2M9.5 6.5 14 2M2 9.5h4.5V14M6.5 9.5 2 14" stroke="currentColor" stroke-width="1.5" />
        </svg>
      {:else}
        <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M9.5 2H14v4.5M14 2 9.5 6.5M6.5 14H2V9.5M2 14l4.5-4.5" stroke="currentColor" stroke-width="1.5" />
        </svg>
      {/if}
    </button>
  </header>

  <div class="ga-chat__messages" role="log" aria-live="polite" bind:this={messagesViewport}>
    {#if messages.length === 0}
      <p class="ga-chat__empty">Ask a question to begin a grounded search.</p>
    {:else}
      {#each messages as message}
        <article class="ga-chat__message" class:ga-chat__message--assistant={message.role === 'assistant'}>
          <p class="ga-chat__message-label">{message.role === 'user' ? 'You' : 'Atlas'}</p>
          {#if message.role === 'assistant' && message.content === SEARCHING_MESSAGE}
            <p class="ga-chat__message-content ga-chat__message-content--searching">
              <span class="ga-chat__searching-spinner"><WaveGridLoader variant="compact" /></span>
              <!-- eslint-disable-next-line svelte/no-at-html-tags -->
              {@html renderChatMessageHtml(message.content)}
            </p>
          {:else}
            <p class="ga-chat__message-content">
              <!-- eslint-disable-next-line svelte/no-at-html-tags -->
              {@html renderChatMessageHtml(message.content)}
            </p>
          {/if}
          {#if message.sources && message.sources.length > 0}
            {@const sources = message.sources}
            <div class="ga-chat__source-control">
              <Dialog
                title="Sources"
                description="Notes referenced in this answer."
                triggerClass="ga-chat__source-trigger"
                closeText="Close"
              >
                {#snippet trigger()}
                  Sources <span class="ga-chat__source-count">({sources.length})</span>
                {/snippet}
                {#snippet children()}
                  <ul class="ga-chat__source-list">
                    {#each sources as source (source.slug)}
                      <li class="ga-chat__source-item">
                        <a href={`/notes/${source.slug}`} class="ga-chat__source-title">{source.title}</a>
                        <p class="ga-chat__source-snippet">
                          <!-- eslint-disable-next-line svelte/no-at-html-tags -->
                          {@html source.snippet}
                        </p>
                      </li>
                    {/each}
                  </ul>
                {/snippet}
              </Dialog>
            </div>
          {/if}
        </article>
      {/each}
    {/if}
  </div>

  {#if error}
    <p class="ga-chat__error" role="status">{error}</p>
  {/if}

  <form class="ga-chat__composer" onsubmit={onSubmit}>
    <label class="ga-chat__sr-only" for="chat-input">Ask grounded question</label>
    <input
      id="chat-input"
      class="ga-chat__input ga-focus-ring"
      type="text"
      placeholder={PLACEHOLDER}
      bind:value={input}
      disabled={loading}
      autocomplete="off"
    />
    <button class="ga-chat__submit" type="submit" disabled={loading || input.trim().length === 0}>
      {loading ? 'Sending' : 'Send'}
    </button>
  </form>
</section>

<style>
  .ga-chat {
    display: grid;
    grid-template-rows: auto 1fr auto;
    gap: 0;
    border: var(--line-std) solid var(--color-line-3);
    background: var(--color-surface-1);
    inline-size: min(100%, 790px);
    block-size: 770px;
  }

  .ga-chat--compact {
    inline-size: min(100%, 790px);
    block-size: 770px;
  }

  .ga-chat__header {
    border-bottom: var(--line-thin) solid var(--color-line-2);
    padding: 0.9rem 1rem;
    display: grid;
    grid-template-columns: 1fr auto;
    align-items: start;
    gap: 0.75rem;
  }

  .ga-chat__header-text {
    display: grid;
    gap: 0.2rem;
    min-width: 0;
  }

  .ga-chat__expand-toggle {
    inline-size: 1.9rem;
    block-size: 1.9rem;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    border: var(--line-thin) solid var(--color-line-2);
    border-radius: 0;
    background: transparent;
    color: var(--color-text-muted);
    cursor: pointer;
  }

  .ga-chat__expand-toggle:hover {
    color: var(--color-text-strong);
    border-color: var(--color-line-3);
  }

  .ga-chat__expand-toggle svg {
    inline-size: 0.85rem;
    block-size: 0.85rem;
  }

  .ga-chat--expanded {
    box-shadow: 0 24px 80px rgb(16 16 14 / 35%);
  }

  /*
   * The backdrop element is created programmatically in `expandChat()` and
   * appended to `document.body`, outside this component's template — scoped
   * styles cannot reach it without `:global`. Scrim color mirrors
   * `.ga-dialog-overlay` in app.css; it sits below the sources Dialog
   * (overlay z-index 60) so sources opened from the expanded panel stack
   * above it.
   */
  :global(.ga-chat-backdrop) {
    position: fixed;
    inset: 0;
    z-index: 50;
    background: rgb(16 16 14 / 60%);
  }

  .ga-chat__label {
    margin: 0;
    font-family: 'Space Grotesk', 'Inter', 'Segoe UI', sans-serif;
    font-size: 0.68rem;
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--color-text-muted);
  }

  .ga-chat__hint {
    margin: 0;
    font-size: 0.9rem;
    line-height: 1.4;
    color: var(--color-text);
  }

  .ga-chat__messages {
    overflow: auto;
    display: grid;
    align-content: start;
    min-height: 0;
    overscroll-behavior: contain;
    scrollbar-gutter: stable both-edges;
  }

  .ga-chat__empty {
    margin: 0;
    padding: 1rem;
    color: var(--color-text-muted);
    font-size: 0.95rem;
    border-bottom: var(--line-thin) solid var(--color-line-1);
  }

  .ga-chat__message {
    display: grid;
    gap: 0.35rem;
    padding: 0.9rem 1rem;
    border-bottom: var(--line-thin) solid var(--color-line-1);
    background: var(--color-surface-2);
  }

  .ga-chat__message--assistant {
    background: var(--color-surface-1);
  }

  .ga-chat__message-label {
    margin: 0;
    font-family: 'Space Grotesk', 'Inter', 'Segoe UI', sans-serif;
    font-size: 0.64rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--color-text-muted);
  }

  .ga-chat__message-content {
    margin: 0;
    color: var(--color-text);
    font-size: 0.98rem;
    line-height: 1.6;
    white-space: pre-wrap;
  }

  .ga-chat__message-content :global(em) {
    font-style: italic;
  }

  .ga-chat__message-content--searching {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .ga-chat__searching-spinner {
    display: block;
    inline-size: 1.35rem;
    block-size: 1.35rem;
    flex-shrink: 0;
    border: var(--line-thin) solid var(--color-line-2);
  }

  .ga-chat__message-content :global(.ga-chat__note-link) {
    color: var(--color-accent-500);
    text-decoration: underline;
    text-underline-offset: 0.12em;
  }

  .ga-chat__source-control {
    display: flex;
    justify-content: flex-start;
  }

  /*
   * Overrides the Dialog wrapper's trigger button via the `triggerClass`
   * prop. The element is rendered inside `Dialog.svelte`'s own template, so
   * scoped styles here cannot reach it without `:global` — same
   * trigger-override pattern documented for `Select.svelte` in
   * docs/CONVENTIONS.md.
   */
  :global(.ga-chat__source-trigger) {
    min-height: 1.65rem;
    padding: 0.2rem 0.6rem;
    font-size: 0.62rem;
    letter-spacing: 0.08em;
    color: var(--color-text-muted);
    border-color: var(--color-line-2);
  }

  :global(.ga-chat__source-trigger:hover) {
    color: var(--color-text-strong);
    border-color: var(--color-line-3);
  }

  :global(.ga-chat__source-count) {
    color: var(--color-text-muted);
  }

  .ga-chat__source-list {
    margin: 0;
    padding: 0;
    list-style: none;
    display: grid;
    gap: 1rem;
  }

  .ga-chat__source-item {
    padding-bottom: 1rem;
    border-bottom: var(--line-thin) solid var(--color-line-1);
  }

  .ga-chat__source-item:last-child {
    padding-bottom: 0;
    border-bottom: 0;
  }

  .ga-chat__source-title {
    display: block;
    margin: 0 0 0.35rem;
    color: var(--color-accent-700);
    font-family: 'Space Grotesk', 'Inter', 'Segoe UI', sans-serif;
    font-size: 0.85rem;
    font-weight: 600;
    text-decoration: underline;
    text-underline-offset: 0.12em;
  }

  .ga-chat__source-snippet {
    margin: 0;
    color: var(--color-text);
    font-size: 0.88rem;
    line-height: 1.55;
  }

  .ga-chat__error {
    margin: 0;
    padding: 0.7rem 1rem;
    border-top: var(--line-thin) solid var(--color-line-2);
    border-bottom: var(--line-thin) solid var(--color-line-2);
    color: var(--color-error);
    font-family: 'Space Grotesk', 'Inter', 'Segoe UI', sans-serif;
    font-size: 0.72rem;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    background: color-mix(in srgb, var(--color-error) 8%, transparent);
  }

  .ga-chat__composer {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 0.75rem;
    align-items: end;
    border-top: var(--line-thin) solid var(--color-line-2);
    padding: 0.9rem 1rem 1rem;
  }

  .ga-chat__sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  .ga-chat__input {
    width: 100%;
    min-height: 2.5rem;
    border: 0;
    border-bottom: var(--line-std) solid var(--color-line-3);
    background: transparent;
    color: var(--color-text-strong);
    font-family: 'Literata', Georgia, 'Times New Roman', serif;
    font-size: 1rem;
    line-height: 1.5;
    padding: 0.4rem 0;
  }

  .ga-chat__input::placeholder {
    color: var(--color-text-muted);
  }

  .ga-chat__input:focus-visible {
    outline: none;
    border-bottom-color: var(--color-accent-700);
  }

  .ga-chat__submit {
    min-height: 2.5rem;
    padding: 0.5rem 0.9rem;
    border: var(--line-std) solid var(--color-line-3);
    border-radius: 0;
    background: var(--color-accent-100);
    color: var(--color-text-strong);
    font-family: 'Space Grotesk', 'Inter', 'Segoe UI', sans-serif;
    font-size: 0.7rem;
    font-weight: 600;
    letter-spacing: 0.09em;
    text-transform: uppercase;
    cursor: pointer;
  }

  .ga-chat__submit:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }

  @media (max-width: 900px) {
    .ga-chat {
      inline-size: 100%;
      block-size: min(770px, calc(100vh - 13rem));
    }

    .ga-chat__composer {
      grid-template-columns: 1fr;
      align-items: stretch;
    }

    .ga-chat__submit {
      width: 100%;
    }
  }
</style>
