<!--
  The fallback for an element no renderer claims: the label of the field and a
  textarea holding the value as JSON, so a value this form does not know how to
  draw can still be read and edited.
-->
<script lang="ts">
  import type { ControlElement, JsonSchema } from '@jsonforms/core';
  import { untrack } from 'svelte';

  import Field from './Field.svelte';
  import type { ValidationError } from './errors';
  import { controlId } from './value';

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

  let text = $state(untrack(() => JSON.stringify(value ?? null, null, 2)));
  let problem = $state<string | null>(null);

  /**
   * Reports the JSON the administrator typed, when it parses.
   *
   * @param event The input event.
   */
  function input(event: Event): void {
    text = (event.currentTarget as HTMLTextAreaElement).value;
    try {
      onchange(JSON.parse(text));
      problem = null;
    } catch {
      problem = 'Enter a JSON value.';
    }
  }
</script>

<Field {id} {label} {hint} {errors}>
  <textarea class="json" {id} rows="4" oninput={input}>{text}</textarea>
  {#if problem !== null}
    <p class="problem" role="alert">{problem}</p>
  {/if}
</Field>

<style>
  .json {
    padding: var(--space-2);
    color: var(--color-fg);
    font: inherit;
    font-family: var(--font-mono);
    background: var(--color-bg);
    border: var(--border-width) solid var(--color-border);
    border-radius: var(--radius);
  }

  .problem {
    margin: 0;
    color: var(--color-danger);
    font-size: 0.875rem;
  }
</style>
