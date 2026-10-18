/**
 * Tests for reading and writing form values and for the text a control shows.
 */
import { describe, expect, it } from 'vitest';
import type { JsonSchema } from '@jsonforms/core';

import {
  controlId,
  enumChoice,
  enumOptions,
  formatNumber,
  formatStringList,
  parseNumber,
  parseStringList,
  readValue,
  textInputReport,
  textInputState,
  writeValue
} from './value';

describe('form values', () => {
  it('reads a nested value and nothing for a missing one', () => {
    const data = { host: { url: 'http://localhost:5030', retries: 2 } };

    expect(readValue(data, '#/properties/host/properties/url')).toBe('http://localhost:5030');
    expect(readValue(data, '#/properties/host/properties/missing')).toBeUndefined();
    expect(readValue(data, '#/properties/missing/properties/url')).toBeUndefined();
  });

  it('writes a value without changing the data it was given', () => {
    const data = { host: { url: 'before' }, other: true };

    const next = writeValue(data, '#/properties/host/properties/url', 'after');

    expect(next).toEqual({ host: { url: 'after' }, other: true });
    expect(data).toEqual({ host: { url: 'before' }, other: true });
  });

  it('creates the objects on the way to a value that is not there yet', () => {
    expect(writeValue({}, '#/properties/host/properties/url', 'value')).toEqual({
      host: { url: 'value' }
    });
  });

  it('gives a control the id its label points at', () => {
    expect(controlId('#/properties/host')).toBe(controlId('#/properties/host'));
    expect(controlId('#/properties/host')).not.toBe(controlId('#/properties/apiKey'));
  });
});

describe('text input', () => {
  const secret: JsonSchema = { type: 'string', writeOnly: true };
  const uri: JsonSchema = { type: 'string', format: 'uri' };
  const plain: JsonSchema = { type: 'string' };

  it('shows the sealed placeholder in a write-only field', () => {
    const state = textInputState(secret, 'sealed-placeholder');

    expect(state).toEqual({ text: 'sealed-placeholder', type: 'password', secret: true });
  });

  it('types a URI field as a URL and every other string field as text', () => {
    expect(textInputState(uri, 'http://localhost:5030').type).toBe('url');
    expect(textInputState(plain, 'value').type).toBe('text');
  });

  it('reports nothing for a field the administrator did not retype', () => {
    const state = textInputState(secret, 'sealed-placeholder');

    expect(textInputReport(state, 'sealed-placeholder')).toBeNull();
    expect(textInputReport(state, 'a-new-secret')).toBe('a-new-secret');
    expect(textInputReport(state, '')).toBe('');
  });
});

describe('value text', () => {
  it('round trips a list of strings through its textarea', () => {
    expect(formatStringList(['a', 'b'])).toBe('a\nb');
    expect(parseStringList('a\nb')).toEqual(['a', 'b']);
    expect(formatStringList(undefined)).toBe('');
  });

  it('drops empty lines and surrounding whitespace from a list', () => {
    expect(parseStringList(' a \n\n b \n')).toEqual(['a', 'b']);
  });

  it('reads a number and answers nothing for text that is not one', () => {
    expect(parseNumber('3')).toBe(3);
    expect(parseNumber(' -2.5 ')).toBe(-2.5);
    expect(parseNumber('')).toBeUndefined();
    expect(parseNumber('many')).toBeUndefined();
  });

  it('formats a number and leaves a value that is not one empty', () => {
    expect(formatNumber(3)).toBe('3');
    expect(formatNumber(undefined)).toBe('');
  });
});

describe('enumeration', () => {
  it('lists the declared choices and keeps the type of the chosen one', () => {
    const schema: JsonSchema = { type: 'integer', enum: [1, 2, 3] };

    expect(enumOptions(schema)).toEqual([1, 2, 3]);
    expect(enumChoice(enumOptions(schema), '2')).toBe(2);
    expect(enumChoice(enumOptions(schema), '')).toBeUndefined();
    expect(enumOptions({ type: 'string' })).toEqual([]);
  });
});
