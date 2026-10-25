/**
 * The setting row: the placeholder a blank text field shows, the value a blank
 * save sends, what a refused save leaves behind and what Escape drops.
 */
import { cleanup, fireEvent, render, waitFor } from '@testing-library/svelte';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { nativeClient } from '#lib/api/native';

import { NO_ANSWER } from './api/result';
import SettingField from './SettingField.svelte';
import type { ServerSetting } from './settings';

/** The default of the file naming template the server registers. */
const TEMPLATE = '{album_artist}/{album}[ ({year})]/{disc_prefix}{track:02} - {title}.{ext}';

beforeAll(() => {
  // jsdom has no media queries; the row's menu reads one to pick its geometry.
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false
    })
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/**
 * Builds one registered setting around the value it holds.
 *
 * @param change The fields to override.
 * @returns The setting.
 */
function setting(change: Partial<ServerSetting> = {}): ServerSetting {
  return {
    key: 'library.naming_template',
    kind: 'string',
    unit: null,
    allowed: [],
    description: 'How a saved file is named.',
    default: TEMPLATE as never,
    source: 'default',
    value: '' as never,
    pinned: false,
    environmentPinned: false,
    userOverridable: false,
    ...change
  };
}

describe('setting row', () => {
  it('shows the built-in default in a field that holds no value', () => {
    const { getByRole } = render(SettingField, {
      props: { setting: setting(), onchanged: () => {} }
    });

    const input = getByRole('textbox', { name: 'File naming template' }) as HTMLInputElement;
    expect(input.value).toBe('');
    expect(input.placeholder).toBe(TEMPLATE);
  });

  it('saves a blank field as the removal of the stored value', async () => {
    const onchanged = vi.fn();
    vi.spyOn(nativeClient, 'PATCH').mockResolvedValue({
      data: { settings: [setting()] }
    } as never);

    const { container, getByRole } = render(SettingField, {
      props: { setting: setting({ value: 'music' as never }), onchanged }
    });
    const input = getByRole('textbox', { name: 'File naming template' });
    await fireEvent.input(input, { target: { value: '   ' } });
    await fireEvent.submit(container.querySelector('form') as HTMLFormElement);

    await waitFor(() =>
      expect(nativeClient.PATCH).toHaveBeenCalledWith('/api/v1/admin/settings', {
        body: { settings: { 'library.naming_template': null } }
      })
    );
  });

  it('leaves the row saveable when the save never reached the server', async () => {
    vi.spyOn(nativeClient, 'PATCH').mockRejectedValue(new Error('offline'));

    const { container, findByText, getByRole } = render(SettingField, {
      props: { setting: setting({ value: 'music' as never }), onchanged: () => {} }
    });
    const input = getByRole('textbox', { name: 'File naming template' });
    await fireEvent.input(input, { target: { value: 'albums' } });
    await fireEvent.submit(container.querySelector('form') as HTMLFormElement);

    expect(await findByText(NO_ANSWER)).toBeTruthy();
    const save = getByRole('button', { name: 'Save' });
    await waitFor(() => expect(save.getAttribute('aria-busy')).toBeNull());
    expect((save as HTMLButtonElement).disabled).toBe(false);
  });

  it('drops the error of a refused save when Escape restores the stored value', async () => {
    vi.spyOn(nativeClient, 'PATCH').mockRejectedValue(new Error('offline'));

    const { container, findByText, getByRole, queryByText } = render(SettingField, {
      props: { setting: setting({ value: 'music' as never }), onchanged: () => {} }
    });
    const input = getByRole('textbox', { name: 'File naming template' });
    await fireEvent.input(input, { target: { value: 'albums' } });
    await fireEvent.submit(container.querySelector('form') as HTMLFormElement);
    await findByText(NO_ANSWER);

    await fireEvent.keyDown(input, { key: 'Escape' });

    expect(queryByText(NO_ANSWER)).toBeNull();
    expect((input as HTMLInputElement).value).toBe('music');
  });
});
