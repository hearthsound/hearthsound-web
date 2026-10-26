/**
 * The account page: the menu row that opens it, the two credential kinds with
 * their one-time secret and their confirmation, and the account's own password
 * change.
 *
 * The password is changed on an account this spec creates, so the administrator
 * the other specs sign in with keeps its password.
 */
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { api, signIn, signInAs, state } from './support';

/** The account this spec changes the password of. */
const OWNER_USERNAME = 'e2e-account';

/** The account's first password. */
const FIRST_PASSWORD = 'e2e-account-first';

/** The password it changes to. */
const CHANGED_PASSWORD = 'e2e-account-second';

/**
 * Opens the account page from the account menu.
 *
 * @param page The signed-in page.
 * @returns Nothing.
 */
async function openAccount(page: Page): Promise<void> {
  await page.locator('.app-account').click();
  await page.getByRole('menuitem', { name: 'Account', exact: true }).click();
  await expect(page).toHaveURL(`${state().baseUrl}/account`);
  await expect(page.getByRole('heading', { name: 'Account', exact: true })).toBeVisible();
}

/**
 * Creates one credential and answers the secret the dialog showed.
 *
 * @param page The account page.
 * @param spec Which button to press, the name to type and the dialog titles.
 * @param spec.create The command that opens the entry dialog.
 * @param spec.title The title of the entry dialog.
 * @param spec.created The title of the secret dialog.
 * @param spec.name The name to give the credential.
 * @returns The secret.
 */
async function createCredential(
  page: Page,
  spec: { create: string; title: string; created: string; name: string }
): Promise<string> {
  await page.getByRole('button', { name: spec.create, exact: true }).click();
  const dialog = page.getByRole('dialog', { name: spec.title });
  await dialog.getByLabel('Name', { exact: true }).fill(spec.name);
  await dialog.getByRole('button', { name: 'Create', exact: true }).click();

  const secretDialog = page.getByRole('dialog', { name: spec.created });
  await expect(secretDialog).toBeVisible();
  await expect(
    secretDialog.getByText('Copy it now. This is the only time the server shows it.')
  ).toBeVisible();
  const secret = await secretDialog.getByLabel('Secret', { exact: true }).inputValue();
  await secretDialog.getByRole('button', { name: 'Done', exact: true }).click();
  return secret;
}

test.beforeEach(async ({ page }) => {
  await signIn(page);
});

test('the account page lists the password and both credential kinds', async ({ page }) => {
  await openAccount(page);

  await expect(page.getByRole('heading', { name: 'Password', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'API Keys', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'App Passwords', exact: true })).toBeVisible();
  await expect(
    page.getByText(
      'Changing the password signs out your other devices and stops every API key and app password.'
    )
  ).toBeVisible();
  // The fixture owns no scanned folder, so the Save Location group is absent.
  await expect(page.getByRole('heading', { name: 'Save Location', exact: true })).toHaveCount(0);
});

test('an API key is created, shown once and revoked', async ({ page }) => {
  await openAccount(page);

  const secret = await createCredential(page, {
    create: 'Create API Key',
    title: 'Create API Key',
    created: 'API Key Created',
    name: 'e2e key'
  });
  expect(secret).toMatch(/^hs_/);

  const row = page.locator('.hs-setting-row', { hasText: 'e2e key' });
  await expect(row).toBeVisible();
  await expect(row).toContainText('Starts with');
  await expect(row).not.toContainText(secret);
  await expect(row).toContainText('Never used');

  await row.getByRole('button', { name: 'Revoke', exact: true }).click();
  const confirmation = page.getByRole('alertdialog', { name: 'Revoke This API Key?' });
  await expect(
    confirmation.getByText('Anything using it stops working immediately.')
  ).toBeVisible();
  await confirmation.getByRole('button', { name: 'Revoke', exact: true }).click();
  await expect(row).toHaveCount(0);
});

test('an app password is created, shown once and revoked', async ({ page }) => {
  await openAccount(page);

  const secret = await createCredential(page, {
    create: 'Create App Password',
    title: 'Create App Password',
    created: 'App Password Created',
    name: 'e2e app'
  });
  expect(secret.length).toBeGreaterThan(8);

  const row = page.locator('.hs-setting-row', { hasText: 'e2e app' });
  await expect(row).toBeVisible();
  await expect(row).not.toContainText(secret);

  await row.getByRole('button', { name: 'Revoke', exact: true }).click();
  const confirmation = page.getByRole('alertdialog', { name: 'Revoke This App Password?' });
  await confirmation.getByRole('button', { name: 'Revoke', exact: true }).click();
  await expect(row).toHaveCount(0);
});

test('an account changes its own password', async ({ page, context }) => {
  await api(context, 'POST', '/api/v1/admin/users', {
    username: OWNER_USERNAME,
    displayName: 'Account Owner',
    password: FIRST_PASSWORD
  });

  await signInAs(page, OWNER_USERNAME, FIRST_PASSWORD);
  await openAccount(page);

  const current = page.getByLabel('Current password', { exact: true });
  const next = page.getByLabel('New password', { exact: true });
  const repeat = page.getByLabel('Repeat the new password', { exact: true });
  const submit = page.getByRole('button', { name: 'Change Password', exact: true });

  // The client refuses a new password under the server's length.
  await current.fill(FIRST_PASSWORD);
  await next.fill('short');
  await repeat.fill('short');
  await submit.click();
  await expect(page.getByText('A password is at least 8 characters long.')).toBeVisible();

  // A wrong current password marks the field with the server's sentence.
  await next.fill(CHANGED_PASSWORD);
  await repeat.fill(CHANGED_PASSWORD);
  await current.fill('not-the-password');
  await submit.click();
  await expect(page.getByText('The current password is not correct.')).toBeVisible();

  await current.fill(FIRST_PASSWORD);
  await submit.click();
  await expect(page.getByText('Password changed.')).toBeVisible();

  // The old password no longer signs in; the new one does.
  await page.locator('.app-account').click();
  await page.getByRole('menuitem', { name: 'Sign out', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  await page.locator('input[name="username"]').fill(OWNER_USERNAME);
  await page.locator('input[name="password"]').fill(FIRST_PASSWORD);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByText('Wrong username or password.')).toBeVisible();

  await page.locator('input[name="password"]').fill(CHANGED_PASSWORD);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Home', exact: true })).toBeVisible();
});
