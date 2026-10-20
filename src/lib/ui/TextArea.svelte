<!--
  A fixed three-line textarea (k04b).

  The tonal field is 84 px high and scrolls inside; Enter adds a line and
  Ctrl+Enter submits the form it belongs to.

  Usage:
  `<TextArea label="Description" bind:value={description} />`
-->
<script lang="ts">
  import type { HTMLTextareaAttributes } from 'svelte/elements';

  /** Props of a textarea. */
  interface Props extends Omit<HTMLTextareaAttributes, 'value' | 'children'> {
    /** The value, bound by the caller. */
    value?: string;
    /** The accessible name when no visible label is associated with the field. */
    label?: string;
    /** The invalid tint and `aria-invalid`. */
    invalid?: boolean;
    /** The disabled state. */
    disabled?: boolean;
  }

  let {
    value = $bindable(''),
    label,
    invalid = false,
    disabled = false,
    class: extra = '',
    onkeydown,
    'aria-label': ariaLabel,
    ...rest
  }: Props = $props();

  const className = $derived(
    ['hs-field', 'hs-field--textarea', invalid ? 'hs-field--invalid' : '', extra]
      .filter(Boolean)
      .join(' ')
  );

  /**
   * Submits the containing form on Ctrl+Enter and forwards other keys.
   *
   * @param event The keydown event.
   */
  function keydown(
    event: KeyboardEvent & { currentTarget: EventTarget & HTMLTextAreaElement }
  ): void {
    onkeydown?.(event);
    if (event.defaultPrevented || !event.ctrlKey || event.key !== 'Enter') {
      return;
    }
    const form = event.currentTarget.form;
    if (form !== null) {
      event.preventDefault();
      form.requestSubmit();
    }
  }
</script>

<div class={className}>
  <textarea
    {...rest}
    class="hs-field__input"
    bind:value
    {disabled}
    aria-label={label ?? ariaLabel}
    aria-invalid={invalid ? 'true' : undefined}
    aria-describedby={rest['aria-describedby']}
    onkeydown={keydown}></textarea>
</div>
