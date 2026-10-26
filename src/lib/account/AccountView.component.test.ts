/**
 * The account page: the order of its groups, the empty states, the create flow
 * that shows the secret once, the revoke confirmation, and the retry page a
 * failed read shows.
 */
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { goBack } from '#lib/navigation';

import AccountView from './AccountView.svelte';
import { listSaveFolders, readSaveFolder } from './library';
import {
  createApiKey,
  listAppPasswords,
  listApiKeys,
  revokeApiKey,
  revokeAppPassword
} from './credentials';
import type { ApiKeyView, AppPasswordView } from './credentials';
import type * as Credentials from './credentials';
import type * as Library from './library';

vi.mock('#lib/navigation', () => ({ goBack: vi.fn() }));

vi.mock('./library', async (importOriginal) => {
  const actual = await importOriginal<typeof Library>();
  return { ...actual, listSaveFolders: vi.fn(), readSaveFolder: vi.fn(), writeSaveFolder: vi.fn() };
});

vi.mock('./credentials', async (importOriginal) => {
  const actual = await importOriginal<typeof Credentials>();
  return {
    ...actual,
    createApiKey: vi.fn(),
    createAppPassword: vi.fn(),
    listApiKeys: vi.fn(),
    listAppPasswords: vi.fn(),
    revokeApiKey: vi.fn(),
    revokeAppPassword: vi.fn()
  };
});

/** One API key as the server lists it. */
const KEY: ApiKeyView = {
  id: 'ak_1',
  name: 'Laptop',
  prefix: 'hs_abc',
  createdAt: Date.UTC(2026, 0, 2),
  lastUsedAt: Date.UTC(2026, 2, 4)
};

/** One app password as the server lists it. */
const PASSWORD: AppPasswordView = {
  id: 'ap_1',
  name: 'Phone',
  createdAt: Date.UTC(2026, 0, 3),
  lastUsedAt: null
};

/**
 * Answers both credential reads.
 *
 * @param keys The API keys to answer with.
 * @param passwords The app passwords to answer with.
 * @returns Nothing.
 */
function answer(keys: ApiKeyView[], passwords: AppPasswordView[]): void {
  vi.mocked(listApiKeys).mockResolvedValue({ ok: true, value: keys });
  vi.mocked(listAppPasswords).mockResolvedValue({ ok: true, value: passwords });
}

beforeEach(() => {
  // The save location reads its own folders; a test that cares overrides these.
  vi.mocked(listSaveFolders).mockResolvedValue({ ok: true, value: [] });
  vi.mocked(readSaveFolder).mockResolvedValue({ ok: true, value: null });
});

afterEach(() => {
  cleanup();
  vi.mocked(goBack).mockReset();
  vi.mocked(createApiKey).mockReset();
  vi.mocked(revokeApiKey).mockReset();
  vi.mocked(revokeAppPassword).mockReset();
});

describe('the account page', () => {
  it('shows the password, the keys and the app passwords in that order', async () => {
    answer([], []);
    render(AccountView);

    const headings = screen
      .getAllByRole('heading', { level: 2 })
      .map((heading) => heading.textContent);
    expect(headings).toEqual(['Password', 'API Keys', 'App Passwords']);
  });

  it('says what each empty list means', async () => {
    answer([], []);
    render(AccountView);

    await waitFor(() => expect(screen.getByText('No API keys yet')).toBeTruthy());
    expect(screen.getByText('No app passwords yet')).toBeTruthy();
    expect(screen.getByText(/Changing the password signs out your other devices/)).toBeTruthy();
  });

  it('lists a key with its prefix, creation and last use', async () => {
    answer([KEY], [PASSWORD]);
    render(AccountView);

    await waitFor(() => expect(screen.getByText('Laptop')).toBeTruthy());
    expect(screen.getByText('Starts with hs_abc')).toBeTruthy();
    expect(
      screen.getByText(`Last used ${new Date(KEY.lastUsedAt ?? 0).toLocaleDateString()}`)
    ).toBeTruthy();
    expect(screen.getByText('Phone')).toBeTruthy();
    expect(screen.getByText('Never used')).toBeTruthy();
  });

  it('shows the secret once and then the row without it', async () => {
    answer([], []);
    vi.mocked(createApiKey).mockResolvedValue({
      ok: true,
      value: { ...KEY, secret: 'hs_abcdef' }
    });
    render(AccountView);

    await fireEvent.click(await screen.findByRole('button', { name: 'Create API Key' }));
    await fireEvent.input(screen.getByLabelText('Name'), { target: { value: 'Laptop' } });
    answer([KEY], []);
    await fireEvent.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() => expect(screen.getByText('API Key Created')).toBeTruthy());
    expect(screen.getByDisplayValue('hs_abcdef')).toBeTruthy();

    await fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    await waitFor(() => expect(screen.getByText('Laptop')).toBeTruthy());
    expect(screen.queryByDisplayValue('hs_abcdef')).toBeNull();
  });

  it('asks before revoking a key and removes the row on success', async () => {
    answer([KEY], []);
    vi.mocked(revokeApiKey).mockResolvedValue({ ok: true, value: undefined });
    render(AccountView);

    await fireEvent.click(await screen.findByRole('button', { name: 'Revoke' }));
    expect(screen.getByText('Revoke This API Key?')).toBeTruthy();
    expect(screen.getByText('Anything using it stops working immediately.')).toBeTruthy();

    const dialog = screen.getByRole('alertdialog');
    await fireEvent.click(within(dialog).getByRole('button', { name: 'Revoke' }));

    await waitFor(() => expect(screen.queryByText('Laptop')).toBeNull());
    expect(revokeApiKey).toHaveBeenCalledWith('ak_1');
  });

  it('keeps the confirmation open with the problem a refused revoke answered with', async () => {
    answer([KEY], []);
    vi.mocked(revokeApiKey).mockResolvedValue({
      ok: false,
      message: 'The server did not answer. Try again in a moment.'
    });
    render(AccountView);

    await fireEvent.click(await screen.findByRole('button', { name: 'Revoke' }));
    const dialog = screen.getByRole('alertdialog');
    await fireEvent.click(within(dialog).getByRole('button', { name: 'Revoke' }));

    await waitFor(() =>
      expect(screen.getByText('The server did not answer. Try again in a moment.')).toBeTruthy()
    );
    expect(screen.getByText('Laptop')).toBeTruthy();
  });

  it('shows the retry page when the read failed', async () => {
    vi.mocked(listApiKeys).mockResolvedValue({
      ok: false,
      message: 'Could not read the API keys.'
    });
    vi.mocked(listAppPasswords).mockResolvedValue({ ok: true, value: [] });
    render(AccountView);

    await waitFor(() => expect(screen.getByText('Could Not Load This Page')).toBeTruthy());
    answer([], []);
    await fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    await waitFor(() => expect(screen.getByText('No API keys yet')).toBeTruthy());
  });
});
