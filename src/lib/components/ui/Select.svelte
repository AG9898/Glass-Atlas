<script lang="ts">
  import { Select as BitsSelect } from 'bits-ui';
  import type { UiSelectOption } from './types';

  type Props = {
    items: UiSelectOption[];
    value?: string;
    name?: string;
    placeholder?: string;
    disabled?: boolean;
    class?: string;
    triggerClass?: string;
    contentClass?: string;
  };

  let {
    items,
    value = $bindable(''),
    name,
    placeholder = 'Select an option',
    disabled = false,
    class: className = '',
    triggerClass = '',
    contentClass = ''
  }: Props = $props();

  // ga-select-trigger already defines :focus-visible ring; ga-focus-ring is not needed here.
  const triggerClasses = $derived(['ga-select-trigger', triggerClass].filter(Boolean).join(' ').trim());
  const contentClasses = $derived(['ga-select-content', contentClass].join(' ').trim());
</script>

<div class={className}>
  <BitsSelect.Root type="single" bind:value {name} {disabled} {items}>
    <BitsSelect.Trigger class={triggerClasses}>
      <BitsSelect.Value>
        {#snippet children({ selection })}
          {#if selection.type === 'single' && selection.selected}
            {selection.selected.label}
          {:else}
            <span class="ga-select-placeholder">{placeholder}</span>
          {/if}
        {/snippet}
      </BitsSelect.Value>
      <span class="ga-select-chevron" aria-hidden="true">▾</span>
    </BitsSelect.Trigger>

    <BitsSelect.Portal>
      <BitsSelect.Content class={contentClasses} sideOffset={8}>
        <BitsSelect.Viewport>
          {#each items as item (item.value)}
            <BitsSelect.Item
              value={item.value}
              label={item.label}
              disabled={item.disabled}
              class="ga-select-item"
            >
              {#snippet children({ selected })}
                <span>{item.label}</span>
                {#if selected}
                  <span class="ga-select-indicator" aria-hidden="true">✓</span>
                {/if}
              {/snippet}
            </BitsSelect.Item>
          {/each}
        </BitsSelect.Viewport>
      </BitsSelect.Content>
    </BitsSelect.Portal>
  </BitsSelect.Root>
</div>
