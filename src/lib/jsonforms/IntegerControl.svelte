<!--
  A whole-number input, with the bounds the schema declares (k04's number
  field; the JSON schema, not a unit, decides the step).
-->
<script lang="ts">
  import type { ControlElement, JsonSchema } from '@jsonforms/core';

  import Field from './Field.svelte';
  import type { ValidationError } from './errors';
  import { controlId, formatNumber, parseNumber } from './value';

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
  const minimum = $derived(typeof schema?.minimum === 'number' ? schema.minimum : undefined);
  const maximum = $derived(typeof schema?.maximum === 'number' ? schema.maximum : undefined);
  const describedby = $derived(
    errors.length > 0 ? `${id}-error` : hint === undefined ? undefined : `${id}-hint`
  );

  /**
   * Reports the number of the input.
   *
   * @param event The input event.
   */
  function input(event: Event): void {
    onchange(parseNumber((event.currentTarget as HTMLInputElement).value));
  }
</script>

<Field {id} {label} {hint} {errors}>
  <div class="hs-field hs-field--number">
    <input
      class="hs-field__input"
      {id}
      type="number"
      step="1"
      value={formatNumber(value)}
      min={minimum}
      max={maximum}
      aria-describedby={describedby}
      oninput={input}
    />
  </div>
</Field>
