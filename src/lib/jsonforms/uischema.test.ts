/**
 * Tests for the UI schema a form renders when the manifest declares none.
 */
import { describe, expect, it } from 'vitest';
import type { JsonSchema, UISchemaElement } from '@jsonforms/core';

import { resolveUiSchema } from './uischema';

/** A schema with three properties. */
const schema: JsonSchema = {
  type: 'object',
  properties: {
    url: { type: 'string', format: 'uri' },
    apiKey: { type: 'string', writeOnly: true },
    concurrency: { type: 'integer' }
  }
};

/**
 * Returns the scope of every child element of a layout.
 *
 * @param layout The layout element to read.
 * @returns The scopes, in order; other elements answer nothing.
 */
function scopesOf(layout: UISchemaElement): string[] {
  if (!('elements' in layout)) {
    return [];
  }
  return layout.elements.map((element) => ('scope' in element ? element.scope : ''));
}

describe('form layout', () => {
  it('lays every property of the schema out vertically when no UI schema is given', () => {
    const layout = resolveUiSchema(schema, null);

    expect(layout.type).toBe('VerticalLayout');
    expect(scopesOf(layout)).toEqual([
      '#/properties/url',
      '#/properties/apiKey',
      '#/properties/concurrency'
    ]);
  });

  it('renders the UI schema a manifest declares', () => {
    const declared: UISchemaElement = {
      type: 'Group',
      label: 'Connection',
      elements: [{ type: 'Control', scope: '#/properties/url' }]
    };

    expect(resolveUiSchema(schema, declared)).toBe(declared);
  });
});
