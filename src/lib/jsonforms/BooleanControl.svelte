<!--
  A checkbox row (k06): the whole row is the target and the label follows the
  box, so the frame does not draw a second label above it.
-->
<script lang="ts">
  import type { ControlElement, JsonSchema } from '@jsonforms/core';

  import Checkbox from '#lib/ui/Checkbox.svelte';
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
    /** The problems validation found for the field. */
    errors?: readonly ValidationError[];
    /** Receives the value the control reports. */
    onchange: (value: unknown) => void;
  }

  let { uischema, value, label, errors = [], onchange }: Props = $props();

  const id = $derived(controlId(uischema.scope));
  const describedby = $derived(errors.length > 0 ? `${id}-error` : undefined);
</script>

<Field {id} {label} {errors} labelled>
  <Checkbox
    {id}
    {label}
    checked={value === true}
    aria-describedby={describedby}
    onchange={(checked) => onchange(checked)}
  />
</Field>
