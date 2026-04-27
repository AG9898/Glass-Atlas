<script lang="ts">
  import { Dialog as BitsDialog } from 'bits-ui';
  import type { Snippet } from 'svelte';

  type Props = {
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    title: string;
    description?: string;
    triggerText?: string;
    closeText?: string;
    class?: string;
    triggerClass?: string;
    children?: Snippet;
    trigger?: Snippet;
  };

  let {
    open = $bindable(false),
    onOpenChange,
    title,
    description,
    triggerText = 'Open',
    closeText = 'Close',
    class: className = '',
    triggerClass = '',
    children,
    trigger
  }: Props = $props();

  const triggerButtonClass = $derived(
    ['ga-btn', 'ga-focus-ring', 'ga-btn-ghost', 'ga-btn-md', triggerClass].join(' ').trim()
  );
  const contentClass = $derived(['ga-dialog-content', className].join(' ').trim());
</script>

<BitsDialog.Root bind:open {onOpenChange}>
  <BitsDialog.Trigger class={triggerButtonClass}>
    {#if trigger}
      {@render trigger()}
    {:else}
      {triggerText}
    {/if}
  </BitsDialog.Trigger>

  <BitsDialog.Portal>
    <BitsDialog.Overlay class="ga-dialog-overlay" />
    <BitsDialog.Content class={contentClass}>
      <header class="ga-dialog-header">
        <BitsDialog.Title class="ga-dialog-title">{title}</BitsDialog.Title>
        {#if description}
          <BitsDialog.Description class="ga-dialog-description">{description}</BitsDialog.Description>
        {/if}
      </header>

      <section class="ga-dialog-body">
        {#if children}
          {@render children()}
        {/if}
      </section>

      <footer class="ga-dialog-footer">
        <BitsDialog.Close class="ga-btn ga-focus-ring ga-btn-ghost ga-btn-sm">{closeText}</BitsDialog.Close>
      </footer>
    </BitsDialog.Content>
  </BitsDialog.Portal>
</BitsDialog.Root>
