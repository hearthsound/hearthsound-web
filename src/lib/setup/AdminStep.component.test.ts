/**
 * Tests for the administrator step: a link that has no token says where to find
 * one, the form creates the administrator, a refusal that names another problem
 * keeps the form with its message, and a link the server refused as spent
 * replaces the form with the page that says a setup link works once.
 */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { StartedSession } from '#lib/setup/api';

import AdminStep from './AdminStep.svelte';

/** The setup calls the step makes. */
const setup = vi.hoisted(() => ({ completeSetup: vi.fn(), getSetupStatus: vi.fn() }));

vi.mock('#lib/setup/api', () => ({
  completeSetup: setup.completeSetup,
  getSetupStatus: setup.getSetupStatus
}));

/** The session the server starts when the administrator is created. */
const SESSION: StartedSession = {
  csrfToken: 'csrf',
  expiresAt: 4_000,
  user: {
    createdAt: 1_000,
    displayName: 'Echo',
    id: 'us_admin',
    isAdmin: true,
    permissions: { acquire: true, download: true, upload: true },
    updatedAt: 1_000,
    username: 'admin'
  }
};

/**
 * Fills the two password fields and submits the form.
 *
 * @param container The rendered container, which holds the form.
 * @param password The password to type into both fields.
 */
async function submitForm(container: HTMLElement, password = 'correct horse'): Promise<void> {
  await fireEvent.input(screen.getByLabelText('Password'), { target: { value: password } });
  await fireEvent.input(screen.getByLabelText('Repeat the password'), {
    target: { value: password }
  });
  const form = container.querySelector('form');
  if (form === null) {
    throw new Error('The step drew no form to submit.');
  }
  await fireEvent.submit(form);
}

beforeEach(() => {
  setup.completeSetup.mockResolvedValue({ ok: true, value: SESSION });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('the administrator step', () => {
  it('says where the setup link comes from when the address carries no token', () => {
    render(AdminStep, { props: { token: null, onsubmitted: vi.fn() } });

    expect(screen.getByText('This server has no administrator yet.')).toBeTruthy();
    expect(screen.queryByLabelText('Username')).toBeNull();
  });

  it('creates the administrator and hands the session over', async () => {
    const onsubmitted = vi.fn();
    const { container } = render(AdminStep, { props: { token: 'tok', onsubmitted } });

    await submitForm(container);

    await waitFor(() => expect(onsubmitted).toHaveBeenCalledWith(SESSION));
  });

  it('keeps the form when the refusal names another problem', async () => {
    setup.completeSetup.mockResolvedValue({
      ok: false,
      message: 'Could not create the administrator.',
      status: 500
    });
    const { container } = render(AdminStep, { props: { token: 'tok', onsubmitted: vi.fn() } });

    await submitForm(container);

    expect(await screen.findByText('Could not create the administrator.')).toBeTruthy();
    expect(screen.getByLabelText('Username')).toBeTruthy();
  });

  it('replaces the form when the server refused the link as spent', async () => {
    setup.completeSetup.mockResolvedValue({
      ok: false,
      message: 'Setup is already complete.',
      status: 409
    });
    const { container } = render(AdminStep, { props: { token: 'tok', onsubmitted: vi.fn() } });

    await submitForm(container);

    expect(await screen.findByText('This setup link is no longer valid.')).toBeTruthy();
    expect(screen.queryByLabelText('Username')).toBeNull();
    expect(screen.queryByLabelText('Password')).toBeNull();
  });
});
