/**
 * Tests for applying a control's change to a form's data, including the secret
 * a control never touched.
 */
import { describe, expect, it } from 'vitest';
import type { JsonSchema } from '@jsonforms/core';

import { createValidator } from './errors';
import { applyChange } from './form';

/** A schema with a secret and a bounded number. */
const schema: JsonSchema = {
  type: 'object',
  properties: {
    apiKey: { type: 'string', writeOnly: true },
    retries: { type: 'integer', maximum: 10 }
  }
};

describe('form change', () => {
  it('stores the value a control reported and reports the problems of the result', () => {
    const validator = createValidator(schema);

    const result = applyChange(
      validator,
      { apiKey: 'sealed', retries: 2 },
      '#/properties/retries',
      4
    );

    expect(result.data).toEqual({ apiKey: 'sealed', retries: 4 });
    expect(result.errors).toEqual([]);
  });

  it('keeps a write-only value that was reported back unchanged', () => {
    const validator = createValidator(schema);

    const before = { apiKey: 'sealed-placeholder', retries: 2 };

    const result = applyChange(validator, before, '#/properties/apiKey', 'sealed-placeholder');

    expect(result.data).toEqual(before);
  });

  it('reports a problem at the control whose value caused it', () => {
    const validator = createValidator(schema);

    const result = applyChange(validator, { retries: 2 }, '#/properties/retries', 40);

    expect(result.errors.map((error) => error.path)).toEqual(['/retries']);
  });

  it('stores a change without validation when the schema could not be compiled', () => {
    const result = applyChange(undefined, {}, '#/properties/retries', 4);

    expect(result.data).toEqual({ retries: 4 });
    expect(result.errors).toEqual([]);
  });
});
