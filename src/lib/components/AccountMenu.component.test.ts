/**
 * The account menu: its rows in order, and the Account row's route.
 */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { navigate } from '#lib/navigation';
import { session } from '#lib/stores/session.svelte';

import AccountMenu from './AccountMenu.svelte';

vi.mock('#lib/navigation', () => ({ navigate: vi.fn() }));

beforeAll(() => {
  // The menu asks whether it is on a phone; jsdom has no media queries.
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
  vi.mocked(navigate).mockReset();
  session.user = null;
});

beforeEach(() => {
  session.user = {
    id: 'us_1',
    username: 'ada',
    displayName: 'Ada',
    isAdmin: true,
    createdAt: 1,
    updatedAt: 2,
    permissions: { acquire: false, download: false, upload: false }
  };
});

describe('the account menu', () => {
  it('offers Customize Home, Account and Connected Services in that order', async () => {
    render(AccountMenu, { oncustomize: vi.fn() });

    await fireEvent.click(screen.getByRole('button', { name: 'Account, Ada' }));
    await waitFor(() => expect(screen.getByRole('menuitem', { name: 'Account' })).toBeTruthy());

    const labels = screen.getAllByRole('menuitem').map((item) => item.textContent?.trim());
    const customize = labels.indexOf('Customize Home');
    const account = labels.indexOf('Account');
    const services = labels.indexOf('Connected Services');
    expect(account).toBe(customize + 1);
    expect(services).toBe(account + 1);
  });

  it('opens the account page from its row', async () => {
    render(AccountMenu, { oncustomize: vi.fn() });

    await fireEvent.click(screen.getByRole('button', { name: 'Account, Ada' }));
    await waitFor(() => expect(screen.getByRole('menuitem', { name: 'Account' })).toBeTruthy());
    await fireEvent.click(screen.getByRole('menuitem', { name: 'Account' }));

    expect(navigate).toHaveBeenCalledWith('/account');
  });
});
