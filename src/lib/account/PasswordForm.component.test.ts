/**
 * The password form: the order the client checks the fields in, the busy state,
 * the success banner and the marked current field a `wrong-password` refusal
 * leaves.
 */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { changePassword } from '#lib/account/password';

import PasswordForm from './PasswordForm.svelte';

vi.mock('#lib/account/password', () => ({ changePassword: vi.fn() }));

afterEach(() => {
  cleanup();
  vi.mocked(changePassword).mockReset();
});

/**
 * Types the three fields and submits the form.
 *
 * @param values The current, new and repeated password.
 * @returns Nothing.
 */
async function submit(values: { current: string; next: string; repeat: string }): Promise<void> {
  await fireEvent.input(screen.getByLabelText('Current password'), {
    target: { value: values.current }
  });
  await fireEvent.input(screen.getByLabelText('New password'), {
    target: { value: values.next }
  });
  await fireEvent.input(screen.getByLabelText('Repeat the new password'), {
    target: { value: values.repeat }
  });
  await fireEvent.click(screen.getByRole('button', { name: 'Change Password' }));
}

describe('the password form', () => {
  it('asks for the current password first', async () => {
    render(PasswordForm);
    await fireEvent.click(screen.getByRole('button', { name: 'Change Password' }));

    expect(screen.getByText('Choose your current password.')).toBeTruthy();
    expect(changePassword).not.toHaveBeenCalled();
  });

  it('asks for a new password before checking its length', async () => {
    render(PasswordForm);
    await submit({ current: 'old-one-1', next: '', repeat: '' });

    expect(screen.getByText('Choose a new password.')).toBeTruthy();
    expect(changePassword).not.toHaveBeenCalled();
  });

  it('refuses a new password under the server length', async () => {
    render(PasswordForm);
    await submit({ current: 'old-one-1', next: 'short', repeat: 'short' });

    expect(screen.getByText('A password is at least 8 characters long.')).toBeTruthy();
    expect(changePassword).not.toHaveBeenCalled();
  });

  it('refuses a repetition that differs', async () => {
    render(PasswordForm);
    await submit({ current: 'old-one-1', next: 'long-enough', repeat: 'long-enoug' });

    expect(screen.getByText('The passwords do not match.')).toBeTruthy();
    expect(changePassword).not.toHaveBeenCalled();
  });

  it('sends the two passwords and reports the change', async () => {
    vi.mocked(changePassword).mockResolvedValue({ ok: true });
    render(PasswordForm);
    await submit({ current: 'old-one-1', next: 'long-enough', repeat: 'long-enough' });

    await waitFor(() => expect(screen.getByText('Password changed.')).toBeTruthy());
    expect(changePassword).toHaveBeenCalledWith('old-one-1', 'long-enough');
    expect((screen.getByLabelText('Current password') as HTMLInputElement).value).toBe('');
  });

  it('marks the current field and keeps the form on a wrong password', async () => {
    vi.mocked(changePassword).mockResolvedValue({
      ok: false,
      message: 'The current password is not correct.',
      code: 'wrong-password'
    });
    render(PasswordForm);
    await submit({ current: 'wrong-one', next: 'long-enough', repeat: 'long-enough' });

    await waitFor(() =>
      expect(screen.getByText('The current password is not correct.')).toBeTruthy()
    );
    const field = screen.getByLabelText('Current password');
    expect(field.getAttribute('aria-invalid')).toBe('true');
    expect((field as HTMLInputElement).value).toBe('');
  });

  it('shows a rate limit as a banner', async () => {
    vi.mocked(changePassword).mockResolvedValue({
      ok: false,
      message: 'Too many attempts. Try again in a minute.',
      code: 'rate-limited'
    });
    render(PasswordForm);
    await submit({ current: 'old-one-1', next: 'long-enough', repeat: 'long-enough' });

    await waitFor(() =>
      expect(screen.getByText('Too many attempts. Try again in a minute.')).toBeTruthy()
    );
    expect(screen.getByLabelText('Current password').getAttribute('aria-invalid')).toBeNull();
  });
});
