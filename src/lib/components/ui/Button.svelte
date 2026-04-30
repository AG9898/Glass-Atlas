<script lang="ts">
  import { Button as BitsButton } from 'bits-ui';
  import type { Snippet } from 'svelte';

  const VARIANT_CLASSES = {
    primary: 'ga-btn-primary',
    ghost: 'ga-btn-ghost',
    accent: 'ga-btn-accent',
    danger: 'ga-btn-danger'
  } as const;

  const SIZE_CLASSES = {
    sm: 'ga-btn-sm',
    md: 'ga-btn-md',
    lg: 'ga-btn-lg'
  } as const;

  type UiButtonVariant = keyof typeof VARIANT_CLASSES;
  type UiButtonSize = keyof typeof SIZE_CLASSES;

  type Props = {
    variant?: UiButtonVariant;
    size?: UiButtonSize;
    class?: string;
    children?: Snippet;
    id?: string;
    title?: string;
    disabled?: boolean;
    href?: string;
    target?: string;
    rel?: string;
    download?: string;
    type?: 'button' | 'submit' | 'reset';
    name?: string;
    value?: string;
    form?: string;
    onclick?: (event: MouseEvent) => void;
  };

  let {
    variant = 'ghost',
    size = 'md',
    class: className = '',
    children,
    id,
    title,
    disabled = false,
    href,
    target,
    rel,
    download,
    type = 'button',
    name,
    value,
    form,
    onclick
  }: Props = $props();

  const buttonClass = $derived(
    ['ga-btn', 'ga-focus-ring', VARIANT_CLASSES[variant], SIZE_CLASSES[size], className].join(' ').trim()
  );
</script>

{#if href}
  <BitsButton.Root {href} {target} {rel} {download} {id} {title} {onclick} {disabled} class={buttonClass}>
    {#if children}
      {@render children()}
    {/if}
  </BitsButton.Root>
{:else}
  <BitsButton.Root {type} {name} {value} {form} {id} {title} {onclick} {disabled} class={buttonClass}>
    {#if children}
      {@render children()}
    {/if}
  </BitsButton.Root>
{/if}
