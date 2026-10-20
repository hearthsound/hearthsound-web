<!--
  A single-line text input (k03).

  The input holds what the value is, so a write-only field shows the sealed
  placeholder the server sent; it reports a change only when the administrator
  retyped the field, which keeps a secret that was left alone. A write-only
  field uses the password kind and its "Reveal Password" action.
-->
<script lang="ts">
  import type { ControlElement, JsonSchema } from '@jsonforms/core';

  import TextField from '#lib/ui/TextField.svelte';
  import Field from './Field.svelte';
  import type { ValidationError } from './errors';
  import { controlId, textInputReport, textInputState } from './value';

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

  const state = $derived(textInputState(schema, value));
  const id = $derived(controlId(uischema.scope));
  const kind = $derived(state.secret ? 'password' : state.type === 'url' ? 'url' : 'text');
  const describedby = $derived(
    errors.length > 0 ? `${id}-error` : hint === undefined ? undefined : `${id}-hint`
  );

  /**
   * Reports the text of the input when the administrator changed it.
   *
   * @param event The input event.
   */
  function input(event: Event): void {
    const reported = textInputReport(state, (event.currentTarget as HTMLInputElement).value);
    if (reported !== null) {
      onchange(reported);
    }
  }
</script>

<Field {id} {label} {hint} {errors}>
  <TextField {id} {kind} value={state.text} oninput={input} aria-describedby={describedby} />
</Field>
