<!--
  A list of strings, one item per line.
-->
<script lang="ts">
  import type { ControlElement, JsonSchema } from '@jsonforms/core';

  import Field from './Field.svelte';
  import type { ValidationError } from './errors';
  import { controlId, formatStringList, parseStringList } from './value';

  /** Props of the control. */
  interface Props {
    /** The control element to draw. */
    uischema: ControlElement;
    /** The schema the control's value is described by. */
    schema?: JsonSchema;
    /** The value at the control's scope. */
    value: unknown;
    /** The text of the label. */
    label: string;
    /** The schema's description of the field, when it has one. */
    hint?: string;
    /** The problems validation found for the field. */
    errors?: readonly ValidationError[];
    /** Receives the value the control reports. */
    onchange: (value: unknown) => void;
  }

  let { uischema, value, label, hint = undefined, errors = [], onchange }: Props = $props();

  const id = $derived(controlId(uischema.scope));

  /**
   * Reports the items of the textarea.
   *
   * @param event The input event.
   */
  function input(event: Event): void {
    onchange(parseStringList((event.currentTarget as HTMLTextAreaElement).value));
  }
</script>

<Field {id} {label} {hint} {errors}>
  <textarea class="input" {id} rows="4" value={formatStringList(value)} oninput={input}></textarea>
</Field>

<style>
  .input {
    padding: var(--space-2);
    color: var(--color-fg);
    font: inherit;
    font-family: var(--font-mono);
    background: var(--color-bg);
    border: var(--border-width) solid var(--color-border);
    border-radius: var(--radius);
  }
</style>
