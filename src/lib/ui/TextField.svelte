<!--
  A tonal text field (k03, k03f): text, password and search.

  Text and password fields keep the grey rest surface on focus (k03f); the
  caret and, in a form field, the accent label carry the focus. A password
  field adds the "Reveal Password" toggle, pressed while the password is
  shown. A search field is the pill variant with the magnifier at the leading
  edge and a "Clear" action while it holds text; Escape clears it and a second
  Escape leaves the field.

  Usage:
  `<TextField kind="search" bind:value={query} />`
  `<TextField kind="password" label="Password" bind:value={password} />`
-->
<script lang="ts">
  import type { HTMLInputAttributes } from 'svelte/elements';

  import Icon from './Icon.svelte';

  /** The kinds of field this component draws. */
  export type TextFieldKind = 'text' | 'password' | 'search';

  /** Props of a text field. */
  interface Props extends Omit<HTMLInputAttributes, 'type' | 'value' | 'size' | 'children'> {
    /** The field kind; text when not given. */
    kind?: TextFieldKind;
    /** The value, bound by the caller. */
    value?: string;
    /** The accessible name when no visible label is associated with the field. */
    label?: string;
    /** The invalid tint and `aria-invalid`, paired with the form field's error. */
    invalid?: boolean;
    /** The disabled state. */
    disabled?: boolean;
    /** The sidebar search variant, 34 px with its margins (l14). */
    sidebar?: boolean;
    /** Whether a search field offers the Clear action; true when not given. */
    clearable?: boolean;
    /** Receives the news that the Clear action emptied the field. */
    onclear?: () => void;
  }

  let {
    kind = 'text',
    value = $bindable(''),
    label,
    invalid = false,
    disabled = false,
    sidebar = false,
    clearable = true,
    onclear,
    class: extra = '',
    onkeydown,
    'aria-label': ariaLabel,
    ...rest
  }: Props = $props();

  let input: HTMLInputElement | undefined = $state();
  let revealed = $state(false);

  const search = $derived(kind === 'search');
  const accessibleName = $derived(label ?? ariaLabel ?? (search ? 'Search' : undefined));
  const type = $derived(kind === 'password' && !revealed ? 'password' : search ? 'search' : 'text');

  const className = $derived(
    [
      'hs-field',
      search ? 'hs-field--search' : '',
      sidebar ? 'hs-search-field' : '',
      invalid ? 'hs-field--invalid' : '',
      disabled ? 'hs-field--disabled' : '',
      extra
    ]
      .filter(Boolean)
      .join(' ')
  );

  /**
   * Empties a search field, keeps focus in it and tells the caller.
   */
  function clear(): void {
    value = '';
    onclear?.();
    input?.focus();
  }

  /**
   * Handles the search keyboard: Escape clears, a second Escape leaves.
   *
   * @param event The keydown event.
   */
  function keydown(event: KeyboardEvent & { currentTarget: EventTarget & HTMLInputElement }): void {
    onkeydown?.(event);
    if (event.defaultPrevented || !search || event.key !== 'Escape') {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    if (value === '') {
      event.currentTarget.blur();
    } else {
      clear();
    }
  }
</script>

<div class={className}>
  {#if search}
    <Icon name="adwaita-search" class="hs-field__lead" />
  {/if}
  <input
    {...rest}
    class="hs-field__input"
    bind:this={input}
    bind:value
    {type}
    {disabled}
    aria-label={accessibleName}
    aria-invalid={invalid ? 'true' : undefined}
    aria-describedby={rest['aria-describedby']}
    onkeydown={keydown}
  />
  {#if kind === 'password'}
    <button
      class="hs-field__action"
      type="button"
      aria-label="Reveal Password"
      aria-pressed={revealed}
      {disabled}
      onclick={() => (revealed = !revealed)}
    >
      <Icon name="adwaita-reveal" />
    </button>
  {:else if search && clearable && value !== ''}
    <button class="hs-field__action" type="button" aria-label="Clear" {disabled} onclick={clear}>
      <Icon name="adwaita-close" />
    </button>
  {/if}
</div>
