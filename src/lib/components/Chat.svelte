<script lang="ts">
  type ChatRole = 'user' | 'assistant';

  type ChatMessage = {
    role: ChatRole;
    content: string;
  };

  const PLACEHOLDER = 'Ask anything grounded in these notes…';
  const SEARCHING_MESSAGE = 'Searching notes…';
  const RATE_LIMIT_MESSAGE = 'Rate limit reached — try again in an hour.';

  let { compact = false }: { compact?: boolean } = $props();

  let messages = $state<ChatMessage[]>([]);
  let input = $state('');
  let loading = $state(false);
  let error = $state('');

  function setLastAssistantMessage(content: string): void {
    if (messages.length === 0) return;

    const lastIndex = messages.length - 1;
    const lastMessage = messages[lastIndex];
    if (!lastMessage || lastMessage.role !== 'assistant') return;

    messages = messages.map((message, index) =>
      index === lastIndex ? { ...message, content } : message,
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
      let assistantText = '';
      let receivedToken = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split('\n\n');
        buffer = events.pop() ?? '';

        for (const eventBlock of events) {
          const dataLines = parseSseChunk(eventBlock);

          for (const dataLine of dataLines) {
            if (dataLine === '[DONE]') {
              continue;
            }

            let token = '';
            try {
              token = extractToken(JSON.parse(dataLine));
            } catch {
              token = dataLine;
            }

            if (!token) continue;

            if (!receivedToken) {
              assistantText = '';
              receivedToken = true;
            }

            assistantText += token;
            setLastAssistantMessage(assistantText);
          }
        }
      }

      const tailEvents = parseSseChunk(buffer);
      for (const dataLine of tailEvents) {
        if (dataLine === '[DONE]') continue;

        let token = '';
        try {
          token = extractToken(JSON.parse(dataLine));
        } catch {
          token = dataLine;
        }

        if (!token) continue;

        if (!receivedToken) {
          assistantText = '';
          receivedToken = true;
        }

        assistantText += token;
        setLastAssistantMessage(assistantText);
      }

      if (!receivedToken) {
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

<section class="ga-chat" class:ga-chat--compact={compact}>
  <header class="ga-chat__header">
    <p class="ga-chat__label">Grounded Chat</p>
    <p class="ga-chat__hint">Answers stream from the note index only.</p>
  </header>

  <div class="ga-chat__messages" role="log" aria-live="polite">
    {#if messages.length === 0}
      <p class="ga-chat__empty">Ask a question to begin a grounded search.</p>
    {:else}
      {#each messages as message}
        <article class="ga-chat__message" class:ga-chat__message--assistant={message.role === 'assistant'}>
          <p class="ga-chat__message-label">{message.role === 'user' ? 'You' : 'Atlas'}</p>
          <p class="ga-chat__message-content">{message.content}</p>
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
    min-height: 26rem;
  }

  .ga-chat--compact {
    min-height: 20rem;
  }

  .ga-chat__header {
    border-bottom: var(--line-thin) solid var(--color-line-2);
    padding: 0.9rem 1rem;
    display: grid;
    gap: 0.2rem;
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
      min-height: 18rem;
    }

    .ga-chat--compact {
      min-height: 16rem;
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
