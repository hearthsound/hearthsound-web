<!--
  A choice among the values a schema allows.
-->
<script lang="ts">
  import type { ControlElement, JsonSchema } from '@jsonforms/core';

  import Field from './Field.svelte';
  import type { ValidationError } from './errors';
  import { controlId, enumChoice, enumOptions } from './value';

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

  let {
    uischema,
    schema = undefined,
    value,
    label,
    hint = undefined,
    errors = [],
    onchange
  }: Props = $props();

  const id = $derived(controlId(uischema.scope));
  const options = $derived(enumOptions(schema));
  const current = $derived(value === undefined || value === null ? '' : String(value));
  const choices = $derived(
    value === undefined || options.some((option) => String(option) === current)
      ? options
      : [value, ...options]
  );

  /**
   * Reports the chosen value.
   *
   * @param event The change event.
   */
  function pick(event: Event): void {
    onchange(enumChoice(choices, (event.currentTarget as HTMLSelectElement).value));
  }
</script>

<Field {id} {label} {hint} {errors}>
  <select class="select" {id} value={current} onchange={pick}>
    <option value="">Not set</option>
    {#each choices as choice (String(choice))}
      <option value={String(choice)}>{String(choice)}</option>
    {/each}
  </select>
</Field>

<style>
  .select {
    padding: var(--space-2);
    color: var(--color-fg);
    font: inherit;
    background: var(--color-bg);
    border: var(--border-width) solid var(--color-border);
    border-radius: var(--radius);
  }
</style>
