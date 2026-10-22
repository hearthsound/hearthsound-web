<!--
  A choice among the values a schema allows (k05).
-->
<script lang="ts">
  import type { ControlElement, JsonSchema } from '@jsonforms/core';

  import Field from './Field.svelte';
  import Select from '#lib/ui/Select.svelte';
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
    /** The problems validation found for the field. */
    errors?: readonly ValidationError[];
    /** Receives the value the control reports. */
    onchange: (value: unknown) => void;
  }

  let { uischema, schema = undefined, value, label, errors = [], onchange }: Props = $props();

  const id = $derived(controlId(uischema.scope));
  const choices = $derived(enumOptions(schema));
  const current = $derived(value === undefined || value === null ? '' : String(value));
  const listed = $derived(
    value === undefined || choices.some((choice) => String(choice) === current)
      ? choices
      : [value, ...choices]
  );
  const options = $derived([
    { value: '', label: 'Not set' },
    ...listed.map((choice) => ({ value: String(choice), label: String(choice) }))
  ]);
  const describedby = $derived(errors.length > 0 ? `${id}-error` : undefined);

  /**
   * Reports the chosen value.
   *
   * @param chosen The value the drop-down reported.
   */
  function pick(chosen: string): void {
    onchange(enumChoice(listed, chosen));
  }
</script>

<Field {id} {label} {errors}>
  <Select
    {id}
    {label}
    {options}
    value={current}
    invalid={errors.length > 0}
    aria-describedby={describedby}
    onchange={pick}
  />
</Field>
