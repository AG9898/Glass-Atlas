<script lang="ts">
  import type { HTMLInputAttributes } from 'svelte/elements';

  const uid = $props.id();

  type Props = Omit<HTMLInputAttributes, 'class' | 'id'> & {
    id?: string;
    class?: string;
    label?: string;
    hint?: string;
    error?: string;
    type?: HTMLInputAttributes['type'];
    value?: HTMLInputAttributes['value'];
    name?: string;
    placeholder?: string;
    autocomplete?: HTMLInputAttributes['autocomplete'];
    inputmode?: HTMLInputAttributes['inputmode'];
    disabled?: boolean;
    readonly?: boolean;
    required?: boolean;
    min?: number | string;
    max?: number | string;
    minlength?: number;
    maxlength?: number;
    step?: number | string;
    pattern?: string;
    oninput?: HTMLInputAttributes['oninput'];
    onchange?: HTMLInputAttributes['onchange'];
    onblur?: HTMLInputAttributes['onblur'];
    onfocus?: HTMLInputAttributes['onfocus'];
  };

  let {
    id = `ui-input-${uid}`,
    class: className = '',
    label,
    hint,
    error,
    type = 'text',
    value,
    name,
    placeholder,
    autocomplete,
    inputmode,
    disabled = false,
    readonly = false,
    required = false,
    min,
    max,
    minlength,
    maxlength,
    step,
    pattern,
    oninput,
    onchange,
    onblur,
    onfocus
  }: Props = $props();

  const describedBy = $derived(error ? `${id}-error` : hint ? `${id}-hint` : undefined);
  const inputClass = $derived(['ga-input', error ? 'ga-input-error' : '', className].join(' ').trim());
</script>

<div class="ga-input-field">
  {#if label}
    <label class="ga-label" for={id}>{label}</label>
  {/if}

  <input
    {id}
    {type}
    {value}
    {name}
    {placeholder}
    {autocomplete}
    {inputmode}
    {disabled}
    {readonly}
    {required}
    {min}
    {max}
    {minlength}
    {maxlength}
    {step}
    {pattern}
    {oninput}
    {onchange}
    {onblur}
    {onfocus}
    class={inputClass}
    aria-invalid={error ? 'true' : undefined}
    aria-describedby={describedBy}
  />

  {#if error}
    <p id={`${id}-error`} class="ga-field-error">{error}</p>
  {:else if hint}
    <p id={`${id}-hint`} class="ga-field-hint">{hint}</p>
  {/if}
</div>
