<!--
  One element of a form.

  The element is offered to the renderer set, and the kind that claims it is
  drawn here: a layout draws its children through this component again, a
  control is handed the value at its scope and reports its edits, and an
  element nothing claims falls back to the unknown control.
-->
<script lang="ts">
  import { createLabelDescriptionFrom, resolveSchema } from '@jsonforms/core';
  import type {
    ControlElement,
    GroupLayout,
    HorizontalLayout,
    JsonSchema,
    LabelElement,
    UISchemaElement,
    VerticalLayout
  } from '@jsonforms/core';

  import BooleanControl from './BooleanControl.svelte';
  import EnumControl from './EnumControl.svelte';
  import GroupBox from './Group.svelte';
  import Horizontal from './HorizontalLayout.svelte';
  import IntegerControl from './IntegerControl.svelte';
  import JsonNode from './JsonNode.svelte';
  import LabelText from './Label.svelte';
  import NumberControl from './NumberControl.svelte';
  import StringListControl from './StringListControl.svelte';
  import TextControl from './TextControl.svelte';
  import UnknownControl from './UnknownControl.svelte';
  import Vertical from './VerticalLayout.svelte';
  import { errorsForPath } from './errors';
  import type { ValidationError } from './errors';
  import { selectRenderer } from './renderers';
  import { readValue } from './value';

  /** Props of the element. */
  interface Props {
    /** The element to draw. */
    element: UISchemaElement;
    /** The form's root schema, which a control resolves its scope in. */
    schema: JsonSchema;
    /** The form's data. */
    data: unknown;
    /** The problems the form's data has. */
    errors: readonly ValidationError[];
    /** Receives the value a control reports at its scope. */
    onchange: (scope: string, value: unknown) => void;
  }

  let { element, schema, data, errors, onchange }: Props = $props();

  const kind = $derived(selectRenderer(element, schema));
  // Only a control carries a scope; a layout's children are read from its own element list.
  const control = $derived(element as ControlElement);
  const scope = $derived(typeof control.scope === 'string' ? control.scope : undefined);
  const resolved = $derived(scope === undefined ? undefined : resolveSchema(schema, scope, schema));
  const label = $derived(
    (scope === undefined ? '' : createLabelDescriptionFrom(control, resolved).text) ?? ''
  );
  const hint = $derived(
    typeof resolved?.description === 'string' ? resolved.description : undefined
  );

  /**
   * Reports a value the control drew for this element found.
   *
   * @param value The value to report.
   */
  function report(value: unknown): void {
    if (scope !== undefined) {
      onchange(scope, value);
    }
  }
</script>

{#snippet node(child: UISchemaElement)}
  <JsonNode element={child} {schema} {data} {errors} {onchange} />
{/snippet}

{#if kind === 'VerticalLayout'}
  <Vertical uischema={element as VerticalLayout} {node} />
{:else if kind === 'HorizontalLayout'}
  <Horizontal uischema={element as HorizontalLayout} {node} />
{:else if kind === 'Group'}
  <GroupBox uischema={element as GroupLayout} {node} />
{:else if kind === 'Label'}
  <LabelText uischema={element as LabelElement} />
{:else if kind === 'TextControl'}
  <TextControl
    uischema={control}
    schema={resolved}
    value={scope === undefined ? undefined : readValue(data, scope)}
    {label}
    {hint}
    errors={scope === undefined ? [] : errorsForPath(errors, scope)}
    onchange={report}
  />
{:else if kind === 'IntegerControl'}
  <IntegerControl
    uischema={control}
    schema={resolved}
    value={scope === undefined ? undefined : readValue(data, scope)}
    {label}
    {hint}
    errors={scope === undefined ? [] : errorsForPath(errors, scope)}
    onchange={report}
  />
{:else if kind === 'NumberControl'}
  <NumberControl
    uischema={control}
    schema={resolved}
    value={scope === undefined ? undefined : readValue(data, scope)}
    {label}
    {hint}
    errors={scope === undefined ? [] : errorsForPath(errors, scope)}
    onchange={report}
  />
{:else if kind === 'BooleanControl'}
  <BooleanControl
    uischema={control}
    schema={resolved}
    value={scope === undefined ? undefined : readValue(data, scope)}
    {label}
    {hint}
    errors={scope === undefined ? [] : errorsForPath(errors, scope)}
    onchange={report}
  />
{:else if kind === 'EnumControl'}
  <EnumControl
    uischema={control}
    schema={resolved}
    value={scope === undefined ? undefined : readValue(data, scope)}
    {label}
    {hint}
    errors={scope === undefined ? [] : errorsForPath(errors, scope)}
    onchange={report}
  />
{:else if kind === 'StringListControl'}
  <StringListControl
    uischema={control}
    schema={resolved}
    value={scope === undefined ? undefined : readValue(data, scope)}
    {label}
    {hint}
    errors={scope === undefined ? [] : errorsForPath(errors, scope)}
    onchange={report}
  />
{:else}
  <UnknownControl
    uischema={control}
    schema={resolved}
    value={scope === undefined ? undefined : readValue(data, scope)}
    {label}
    {hint}
    errors={scope === undefined ? [] : errorsForPath(errors, scope)}
    onchange={report}
  />
{/if}
