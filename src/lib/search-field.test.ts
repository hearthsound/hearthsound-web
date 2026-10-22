/**
 * Tests for the search field's tie to the address: adopting an external
 * query, keeping a keystroke while the field's own write lands, publishing,
 * and clearing when the results page is left.
 */
import { describe, expect, it } from 'vitest';

import { SearchField } from './search-field.svelte';

describe('search field', () => {
  it('shows the query the address carries and adopts a new one', () => {
    const field = new SearchField('blue');

    expect(field.value).toBe('blue');

    field.adopt('green');
    expect(field.value).toBe('green');
  });

  it('publishes a query as the results route', () => {
    const field = new SearchField('');

    expect(field.publish('two words', '')).toBe('/search?q=two%20words');
  });

  it('publishes nothing when the address already carries the query', () => {
    const field = new SearchField('blue');

    expect(field.publish('blue', 'blue')).toBeNull();
  });

  it('keeps a keystroke typed while its own write lands', () => {
    const field = new SearchField('blue');

    field.publish('green', 'blue');
    field.value = 'greener';
    field.adopt('green');

    expect(field.value).toBe('greener');
  });

  it('adopts the next address once its own write has landed', () => {
    const field = new SearchField('blue');

    field.publish('green', 'blue');
    field.adopt('green');
    field.adopt('red');

    expect(field.value).toBe('red');
  });

  it('keeps the space just typed when the address carries the trimmed query', () => {
    // The other field (or an earlier write) put "aphex" in the address while
    // the user had already typed the space before the next word.
    const field = new SearchField('aphex');
    field.value = 'aphex ';

    field.adopt('aphex');

    expect(field.value).toBe('aphex ');
  });

  it('empties the field when the browser leaves the results', () => {
    const field = new SearchField('blue');

    field.clear();

    expect(field.value).toBe('');
  });
});
