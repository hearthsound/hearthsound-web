/**
 * The renderer set of the configuration forms.
 *
 * The client draws plugin configuration itself on `@jsonforms/core`: each
 * element of a UI schema is offered to every tester below, the highest rank
 * that applies wins, and an element nothing matches is drawn by the unknown
 * control. The set covers the layouts a manifest declares and the scalar
 * controls and string lists its schema uses.
 */
import {
  and,
  hasType,
  isBooleanControl,
  isEnumControl,
  isIntegerControl,
  isNumberControl,
  isStringControl,
  rankWith,
  schemaMatches,
  uiTypeIs,
  NOT_APPLICABLE
} from '@jsonforms/core';
import type { JsonSchema, RankedTester, TesterContext, UISchemaElement } from '@jsonforms/core';

/** The kinds of element a form can draw. */
export type RendererKind =
  | 'VerticalLayout'
  | 'HorizontalLayout'
  | 'Group'
  | 'Label'
  | 'TextControl'
  | 'IntegerControl'
  | 'NumberControl'
  | 'BooleanControl'
  | 'EnumControl'
  | 'StringListControl'
  | 'UnknownControl';

/** One renderer of the set: the kind it draws and the tester that selects it. */
export interface Renderer {
  /** The kind the renderer draws. */
  kind: RendererKind;
  /** The ranked tester that claims the elements this renderer draws. */
  tester: RankedTester;
}

/** The rank of an enumeration control, which outranks the control of its value type. */
const RANK_ENUM = 30;

/** The rank of a control over a list of strings. */
const RANK_STRING_LIST = 25;

/** The rank of an integer control, which outranks the number control. */
const RANK_INTEGER = 20;

/** The rank of a control over one scalar type. */
const RANK_SCALAR = 10;

/** The rank of a layout. */
const RANK_LAYOUT = 10;

/** The rank of a label. */
const RANK_LABEL = 10;

/**
 * Reports whether a schema describes an array of strings.
 *
 * @param items The schema's `items` keyword.
 * @returns `true` when the array holds strings only.
 */
function isStringItems(items: unknown): boolean {
  if (typeof items !== 'object' || items === null || Array.isArray(items)) {
    return false;
  }
  return (items as JsonSchema).type === 'string';
}

/** Claims a control over an array of strings. */
const stringArray: RankedTester = rankWith(
  RANK_STRING_LIST,
  and(
    uiTypeIs('Control'),
    schemaMatches((schema) => hasType(schema, 'array') && isStringItems(schema.items))
  )
);

/**
 * Every renderer, most specific first within a rank.
 *
 * The order is the tie-break: two testers that claim the same rank leave the
 * earlier one in charge, so a more specific tester must be declared before a
 * more general one.
 */
export const renderers: readonly Renderer[] = [
  { kind: 'VerticalLayout', tester: rankWith(RANK_LAYOUT, uiTypeIs('VerticalLayout')) },
  { kind: 'HorizontalLayout', tester: rankWith(RANK_LAYOUT, uiTypeIs('HorizontalLayout')) },
  { kind: 'Group', tester: rankWith(RANK_LAYOUT, uiTypeIs('Group')) },
  { kind: 'Label', tester: rankWith(RANK_LABEL, uiTypeIs('Label')) },
  { kind: 'EnumControl', tester: rankWith(RANK_ENUM, isEnumControl) },
  { kind: 'StringListControl', tester: stringArray },
  { kind: 'IntegerControl', tester: rankWith(RANK_INTEGER, isIntegerControl) },
  { kind: 'BooleanControl', tester: rankWith(RANK_SCALAR, isBooleanControl) },
  { kind: 'NumberControl', tester: rankWith(RANK_SCALAR, isNumberControl) },
  { kind: 'TextControl', tester: rankWith(RANK_SCALAR, isStringControl) }
];

/**
 * Selects the renderer of one element of a UI schema.
 *
 * @param uischema The element to draw.
 * @param schema The form's root schema, which a control resolves its scope in.
 * @returns The kind to draw; `UnknownControl` when no tester applies.
 */
export function selectRenderer(uischema: UISchemaElement, schema: JsonSchema): RendererKind {
  const context: TesterContext = { rootSchema: schema, config: {} };
  let selected: RendererKind = 'UnknownControl';
  let selectedRank = NOT_APPLICABLE;
  for (const renderer of renderers) {
    const rank = renderer.tester(uischema, schema, context);
    if (rank > selectedRank) {
      selectedRank = rank;
      selected = renderer.kind;
    }
  }
  return selected;
}
