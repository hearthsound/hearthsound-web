/**
 * The values of a form.
 *
 * Every control is bound to one scope of the form's data: it reads the value
 * there, reports the edits it received, and the form writes the reported value
 * back into a copy of the data. This module holds that path arithmetic and the
 * conversions between a value and the text an input shows for it; nothing here
 * touches the DOM, so the rules a control follows are testable on their own.
 */
import { toDataPathSegments } from '@jsonforms/core';
import type { JsonSchema, JsonSchema7 } from '@jsonforms/core';

/** The value of a node that is a JSON object. */
type ObjectValue = Record<string, unknown>;

/**
 * Reports whether a value is a JSON object.
 *
 * @param value The value to inspect.
 * @returns `true` when the value is an object and not an array or `null`.
 */
function isObjectValue(value: unknown): value is ObjectValue {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Reads the value a control is bound to.
 *
 * @param data The form's data.
 * @param scope The control's scope, for example `#/properties/host`.
 * @returns The value at the scope, or `undefined` when nothing is stored.
 */
export function readValue(data: unknown, scope: string): unknown {
  let current: unknown = data;
  for (const segment of toDataPathSegments(scope)) {
    if (!isObjectValue(current)) {
      return undefined;
    }
    current = current[segment];
  }
  return current;
}

/**
 * Replaces the value a control is bound to, without touching the data it was
 * given.
 *
 * @param data The form's data.
 * @param scope The control's scope, for example `#/properties/host`.
 * @param value The value to store.
 * @returns A copy of the data with the value replaced.
 */
export function writeValue(data: unknown, scope: string, value: unknown): unknown {
  return writeAt(data, toDataPathSegments(scope), value);
}

/**
 * Replaces one value of a data tree, copying the objects on the way down.
 *
 * @param data The data to copy.
 * @param segments The remaining path segments.
 * @param value The value to store at the end of the path.
 * @returns The copied data.
 */
function writeAt(data: unknown, segments: readonly string[], value: unknown): unknown {
  if (segments.length === 0) {
    return value;
  }
  const [head, ...rest] = segments;
  const container = isObjectValue(data) ? data : {};
  return { ...container, [head]: writeAt(container[head], rest, value) };
}

/**
 * Returns the id a control's input and its label share.
 *
 * The id is derived from the control's scope, so a label always points at the
 * input of its own field even when several forms are on one page.
 *
 * @param scope The control's scope, for example `#/properties/host`.
 * @returns The id of the input.
 */
export function controlId(scope: string): string {
  return `jsonforms-${scope.replace(/[^a-zA-Z0-9]+/g, '-')}`;
}

/** How a text input is drawn and what it holds. */
export interface TextInputState {
  /** The text the input holds. */
  text: string;
  /** The input's HTML type: `text`, `url` or `password`. */
  type: string;
  /** Whether the schema marks the field as write-only, which the server seals. */
  secret: boolean;
}

/**
 * Describes the text input of one control.
 *
 * A write-only field arrives as the sealed placeholder the server stored in
 * place of the secret, and the input holds it so an administrator who does not
 * touch the field sends the placeholder back and keeps the stored secret.
 *
 * @param schema The control's resolved schema.
 * @param value The value at the control's scope.
 * @returns The state the input is built with.
 */
export function textInputState(schema: JsonSchema | undefined, value: unknown): TextInputState {
  // The schema is a draft-4/draft-7 union; the controls read draft-7 keywords.
  const draft = schema as JsonSchema7 | undefined;
  const secret = draft?.writeOnly === true;
  const type = secret ? 'password' : draft?.format === 'uri' ? 'url' : 'text';
  const text = typeof value === 'string' || typeof value === 'number' ? String(value) : '';
  return { text: text, type: type, secret: secret };
}

/**
 * Reports what a text input answers for the text it holds.
 *
 * An input the administrator did not retype reports `null`, which keeps a
 * write-only field at the sealed placeholder it was built with; a field that
 * was cleared reports the empty string, so clearing a secret is possible.
 *
 * @param state The state the input was built with.
 * @param text The text the input holds.
 * @returns The value to report, or `null` when the text did not change.
 */
export function textInputReport(state: TextInputState, text: string): string | null {
  return text === state.text ? null : text;
}

/**
 * Formats a list of strings as the text of its textarea, one item per line.
 *
 * @param value The value at the control's scope.
 * @returns The text, without a trailing newline.
 */
export function formatStringList(value: unknown): string {
  if (!Array.isArray(value)) {
    return '';
  }
  return value.filter((item) => typeof item === 'string').join('\n');
}

/**
 * Reads a list of strings from the text of its textarea.
 *
 * @param text The text of the textarea.
 * @returns The items, one per non-empty line, with surrounding whitespace
 *   removed.
 */
export function parseStringList(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

/**
 * Reads a number from the text of its input.
 *
 * @param text The text of the input.
 * @returns The number, or `undefined` when the input is empty or not a number.
 */
export function parseNumber(text: string): number | undefined {
  const trimmed = text.trim();
  if (trimmed === '') {
    return undefined;
  }
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : undefined;
}

/**
 * Formats a number as the text of its input.
 *
 * @param value The value at the control's scope.
 * @returns The text, empty when the value is not a number.
 */
export function formatNumber(value: unknown): string {
  return typeof value === 'number' && Number.isFinite(value) ? String(value) : '';
}

/**
 * Lists the choices an enumeration control offers, in declaration order.
 *
 * @param schema The control's resolved schema.
 * @returns The allowed values, empty when the schema declares none.
 */
export function enumOptions(schema: JsonSchema | undefined): unknown[] {
  const declared = schema?.enum;
  return Array.isArray(declared) ? declared : [];
}

/**
 * Returns the choice one option of an enumeration stands for.
 *
 * An option carries its value as text, so the choice is looked up by the text
 * of the values the schema allows, which keeps the type of a number or a
 * boolean choice intact.
 *
 * @param options The allowed values.
 * @param text The text of the selected option.
 * @returns The value to store, or `undefined` for the empty choice.
 */
export function enumChoice(options: readonly unknown[], text: string): unknown {
  return options.find((option) => String(option) === text);
}
