<!--
  A form field above its control (k32).

  Label above, "Optional" after the label of an optional field, a hint under
  the control, or the error in its place with the error glyph. A field pinned
  by the configuration file or the environment shows its value and the muted
  lock line instead of a control. The label turns accent while the control
  has focus.

  The hint and error ids derive from `for`, so the control can point at them:
  `${for}-hint` and `${for}-error`.

  Usage:
  `<FormField label="Username" for="username" hint="The name you sign in with.">...</FormField>`
-->
<script lang="ts">
  import type { Snippet } from 'svelte';

  import Icon from './Icon.svelte';

  /** Props of a form field. */
  interface Props {
    /** The label text. */
    label: string;
    /** The id of the control the label belongs to. */
    for?: string;
    /** Whether the field is optional; unmarked fields are required. */
    optional?: boolean;
    /** The hint under the control. */
    hint?: string;
    /** The error that replaces the hint. */
    error?: string;
    /** The value of a field pinned by configuration; shown instead of the control. */
    value?: string;
    /** The muted lock line of a pinned field, e.g. "Set in the configuration file". */
    pinned?: string;
    /** The control. */
    children?: Snippet;
  }

  let {
    label,
    for: controlId,
    optional = false,
    hint,
    error,
    value,
    pinned,
    children
  }: Props = $props();
</script>

<div class="hs-form-field">
  {#if controlId === undefined}
    <span class="hs-form-field__label">
      {label}
      {#if optional}<span class="hs-form-field__optional">Optional</span>{/if}
    </span>
  {:else}
    <label class="hs-form-field__label" for={controlId} id="{controlId}-label">
      {label}
      {#if optional}<span class="hs-form-field__optional">Optional</span>{/if}
    </label>
  {/if}

  {#if pinned !== undefined}
    {#if value !== undefined}
      <span class="hs-caption">{value}</span>
    {/if}
    <span class="hs-form-field__pinned">
      <Icon name="adwaita-lock" />
      {pinned}
    </span>
  {:else}
    {@render children?.()}
  {/if}

  {#if error !== undefined}
    <p
      class="hs-form-field__error"
      id={controlId === undefined ? undefined : `${controlId}-error`}
      role="alert"
    >
      <Icon name="adwaita-error" />
      {error}
    </p>
  {:else if hint !== undefined}
    <span
      class="hs-form-field__hint"
      id={controlId === undefined ? undefined : `${controlId}-hint`}
    >
      {hint}
    </span>
  {/if}
</div>
