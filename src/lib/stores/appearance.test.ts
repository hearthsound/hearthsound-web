/**
 * Tests for the appearance choice: what is read back from storage and how the
 * choice reaches the document element.
 */
import { describe, expect, it } from 'vitest';

import { APPEARANCE_KEY, AppearanceStore, parseAppearance } from './appearance.svelte';

/** An element stand-in that records its attributes (the unit run has no DOM). */
function fakeRoot(): Pick<
  Element,
  'setAttribute' | 'removeAttribute' | 'getAttribute' | 'hasAttribute'
> {
  const attributes = new Map<string, string>();
  return {
    setAttribute: (name, value) => void attributes.set(name, value),
    removeAttribute: (name) => void attributes.delete(name),
    getAttribute: (name) => attributes.get(name) ?? null,
    hasAttribute: (name) => attributes.has(name)
  };
}

/** An in-memory stand-in for `localStorage`. */
function memoryStorage(initial: Record<string, string> = {}): Pick<Storage, 'getItem' | 'setItem'> {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => void values.set(key, value)
  };
}

describe('appearance', () => {
  it('falls back to the system scheme for missing, malformed or unknown values', () => {
    expect(parseAppearance(null).scheme).toBe('system');
    expect(parseAppearance('not json').scheme).toBe('system');
    expect(parseAppearance('{"scheme":"sepia"}').scheme).toBe('system');
    expect(parseAppearance('{"scheme":"dark"}').scheme).toBe('dark');
  });

  it('applies the stored scheme when it starts', () => {
    const root = fakeRoot();
    const store = new AppearanceStore(
      memoryStorage({ [APPEARANCE_KEY]: '{"scheme":"light"}' }),
      root
    );

    expect(store.scheme).toBe('light');
    expect(root.getAttribute('data-scheme')).toBe('light');
  });

  it('stores a new choice, and system removes the attribute', () => {
    const storage = memoryStorage();
    const root = fakeRoot();
    const store = new AppearanceStore(storage, root);

    store.set('dark');
    expect(root.getAttribute('data-scheme')).toBe('dark');
    expect(new AppearanceStore(storage, fakeRoot()).scheme).toBe('dark');

    store.set('system');
    expect(root.hasAttribute('data-scheme')).toBe(false);
    expect(parseAppearance(storage.getItem(APPEARANCE_KEY)).scheme).toBe('system');
  });
});
