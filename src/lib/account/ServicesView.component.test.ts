/**
 * The connected-services page: what each service row reports, the connect and
 * save flows, disconnecting behind a confirmation, and the toast a browser
 * link's return raises.
 */
import { cleanup, fireEvent, render, waitFor, within } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { nativeClient } from '#lib/api/native';
import { replaceRoute } from '#lib/navigation';
import { toasts } from '#lib/stores/toasts.svelte';

import ServicesView from './ServicesView.svelte';
import type { ProviderLink } from './services';

// The address bar is SvelteKit's, which needs the client started; the page only
// ever rewrites the address it arrived on.
vi.mock('#lib/navigation', () => ({
  goBack: vi.fn(),
  replaceRoute: vi.fn()
}));

/** One service as the server lists it. */
function service(change: Partial<ProviderLink> = {}): ProviderLink {
  return {
    slug: 'listenbrainz',
    displayName: 'ListenBrainz',
    pluginId: 'org.listenbrainz',
    layers: ['scrobble', 'discovery'],
    linkMethod: 'config',
    userConfig: null,
    config: null,
    linked: false,
    pendingScrobbles: 0,
    failedScrobbles: 0,
    ...change
  };
}

/**
 * The user configuration form of a service that links with a token and a name.
 *
 * @returns The schema and UI schema the form renders.
 */
function tokenForm() {
  return {
    schema: {
      type: 'object',
      properties: {
        token: { type: 'string', title: 'User token' },
        username: { type: 'string', title: 'Username' }
      }
    },
    uiSchema: null
  } as never;
}

/**
 * Answers the service list.
 *
 * @param providers The services the page should read.
 * @returns The spy on the listing call.
 */
function answerList(providers: ProviderLink[]) {
  return vi.spyOn(nativeClient, 'GET').mockResolvedValue({ data: { providers } } as never);
}

beforeEach(() => {
  vi.mocked(replaceRoute).mockClear();
  // The browser flow is observed without letting jsdom navigate.
  Object.defineProperty(window, 'location', {
    configurable: true,
    writable: true,
    value: { assign: vi.fn() }
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  toasts.items = [];
});

describe('connected services', () => {
  it('reports the account, the layers, the waiting scrobbles and the last error', async () => {
    answerList([
      service({
        linked: true,
        accountName: 'fixture-user',
        pendingScrobbles: 2,
        lastError: 'The service did not answer.'
      })
    ]);

    const { findByText, getByText } = render(ServicesView, { props: { search: '' } });

    expect(await findByText('Connected as fixture-user')).toBeTruthy();
    expect(getByText('Scrobbling, Recommendations')).toBeTruthy();
    expect(getByText('2 scrobbles waiting')).toBeTruthy();
    expect(getByText('The service did not answer.')).toBeTruthy();
  });

  it('reports an unlinked service as not connected', async () => {
    answerList([service({ linkMethod: 'browser' })]);

    const { findByText } = render(ServicesView, { props: { search: '' } });

    expect(await findByText('Not connected')).toBeTruthy();
    expect(await findByText('Scrobbling, Recommendations')).toBeTruthy();
  });

  it('opens the authorization page after asking the server for the link', async () => {
    answerList([service({ linkMethod: 'browser' })]);
    const post = vi
      .spyOn(nativeClient, 'POST')
      .mockResolvedValue({ data: { url: 'https://www.last.fm/api/auth/?cb=here' } } as never);

    const { findByText } = render(ServicesView, { props: { search: '' } });
    await fireEvent.click(await findByText('Connect'));

    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    expect(post).toHaveBeenCalledWith('/api/v1/me/providers/{slug}/link', {
      params: { path: { slug: 'listenbrainz' } }
    });
    expect(window.location.assign).toHaveBeenCalledWith('https://www.last.fm/api/auth/?cb=here');
  });

  it('saves the configuration a config service shows', async () => {
    answerList([service({ userConfig: tokenForm() })]);
    const put = vi
      .spyOn(nativeClient, 'PUT')
      .mockResolvedValue({ data: service({ linked: true, accountName: 'fixture-user' }) } as never);

    const { findByText, findByLabelText } = render(ServicesView, { props: { search: '' } });
    await fireEvent.input(await findByLabelText('User token'), {
      target: { value: 'secret-token' }
    });
    await fireEvent.click(await findByText('Save'));

    await waitFor(() => expect(put).toHaveBeenCalledTimes(1));
    expect(put).toHaveBeenCalledWith('/api/v1/me/providers/{slug}/config', {
      params: { path: { slug: 'listenbrainz' } },
      body: { config: { token: 'secret-token' } }
    });
    expect(await findByText('Connected as fixture-user')).toBeTruthy();
  });

  it('opens a linked form on the masked configuration with Save disabled', async () => {
    answerList([
      service({
        linked: true,
        config: { token: '[sealed]' },
        userConfig: tokenForm()
      })
    ]);

    const { findByDisplayValue, findByText } = render(ServicesView, { props: { search: '' } });

    expect(await findByDisplayValue('[sealed]')).toBeTruthy();
    const save = (await findByText('Save')).closest('button');
    expect(save?.disabled).toBe(true);
  });

  it('enables Save on an edit and sends the untouched placeholder back', async () => {
    answerList([
      service({
        linked: true,
        config: { token: '[sealed]', username: 'old-name' },
        userConfig: tokenForm()
      })
    ]);
    const put = vi.spyOn(nativeClient, 'PUT').mockResolvedValue({
      data: service({ linked: true, config: { token: '[sealed]' }, userConfig: tokenForm() })
    } as never);

    const { findByLabelText, findByText } = render(ServicesView, { props: { search: '' } });
    const save = (await findByText('Save')).closest('button');
    expect(save?.disabled).toBe(true);

    await fireEvent.input(await findByLabelText('Username'), { target: { value: 'new-name' } });
    await waitFor(() => expect(save?.disabled).toBe(false));
    await fireEvent.click(save as HTMLButtonElement);

    await waitFor(() => expect(put).toHaveBeenCalledTimes(1));
    expect(put).toHaveBeenCalledWith('/api/v1/me/providers/{slug}/config', {
      params: { path: { slug: 'listenbrainz' } },
      body: { config: { token: '[sealed]', username: 'new-name' } }
    });
    // The saved form falls back to what the server answered, so Save disables.
    await waitFor(() => expect(save?.disabled).toBe(true));
  });

  it('keeps Connect usable when the link request never reaches the server', async () => {
    answerList([service({ linkMethod: 'browser' })]);
    vi.spyOn(nativeClient, 'POST').mockRejectedValue(new Error('offline'));

    const { findByText } = render(ServicesView, { props: { search: '' } });
    const connect = (await findByText('Connect')).closest('button');
    await fireEvent.click(connect as HTMLButtonElement);

    await waitFor(() => expect(connect?.getAttribute('aria-busy')).toBeNull());
    expect(connect?.disabled).toBe(false);
  });

  it('keeps Save usable when the save request never reaches the server', async () => {
    answerList([service({ userConfig: tokenForm() })]);
    vi.spyOn(nativeClient, 'PUT').mockRejectedValue(new Error('offline'));

    const { findByLabelText, findByText } = render(ServicesView, { props: { search: '' } });
    await fireEvent.input(await findByLabelText('User token'), { target: { value: 'a-token' } });
    const save = (await findByText('Save')).closest('button');
    await fireEvent.click(save as HTMLButtonElement);

    expect(await findByText('Could not save this configuration.')).toBeTruthy();
    await waitFor(() => expect(save?.getAttribute('aria-busy')).toBeNull());
    expect(save?.disabled).toBe(false);
  });

  it('shows the problem detail under a refused form', async () => {
    answerList([service({ userConfig: tokenForm() })]);
    vi.spyOn(nativeClient, 'PUT').mockResolvedValue({
      error: { detail: 'The token is required.' },
      response: new Response(null, { status: 422 })
    } as never);

    const { findByLabelText, findByText, getByText } = render(ServicesView, {
      props: { search: '' }
    });
    await fireEvent.input(await findByLabelText('User token'), { target: { value: 'a-token' } });
    await fireEvent.click(await findByText('Save'));

    expect(await findByText('The token is required.')).toBeTruthy();
    expect(getByText('Save')).toBeTruthy();
  });

  it('disconnects after the confirmation', async () => {
    answerList([service({ linkMethod: 'browser', linked: true, accountName: 'listener' })]);
    const remove = vi
      .spyOn(nativeClient, 'DELETE')
      .mockResolvedValue({ response: { status: 204 } } as never);

    const { findByText, findByRole } = render(ServicesView, { props: { search: '' } });
    await fireEvent.click(await findByText('Disconnect'));

    const dialog = await findByRole('alertdialog');
    expect(within(dialog).getByText('Disconnect ListenBrainz?')).toBeTruthy();
    await fireEvent.click(within(dialog).getByText('Disconnect'));

    await waitFor(() => expect(remove).toHaveBeenCalledTimes(1));
    expect(remove).toHaveBeenCalledWith('/api/v1/me/providers/{slug}/link', {
      params: { path: { slug: 'listenbrainz' } }
    });
  });

  it('reports a successful browser link with a toast', async () => {
    answerList([service({ linkMethod: 'browser', linked: true, accountName: 'listener' })]);

    render(ServicesView, { props: { search: '?linked=listenbrainz' } });

    await waitFor(() =>
      expect(toasts.items.map((toast) => toast.message)).toContain('Connected to ListenBrainz')
    );
  });

  it('announces a browser link once and drops the result from the address', async () => {
    answerList([service({ linkMethod: 'browser', linked: true, accountName: 'listener' })]);

    render(ServicesView, { props: { search: '?linked=listenbrainz' } });

    await waitFor(() =>
      expect(
        toasts.items.filter((toast) => toast.message === 'Connected to ListenBrainz')
      ).toHaveLength(1)
    );
    expect(replaceRoute).toHaveBeenCalledWith('/account/services');
  });

  it('says nothing on the load the cleared address brings', async () => {
    answerList([service({ linkMethod: 'browser', linked: true, accountName: 'listener' })]);

    const { findByText } = render(ServicesView, { props: { search: '' } });
    await findByText('Connected as listener');

    expect(toasts.items).toHaveLength(0);
    expect(replaceRoute).not.toHaveBeenCalled();
  });

  it('reports a failed browser link with an error toast', async () => {
    answerList([service({ linkMethod: 'browser' })]);

    render(ServicesView, { props: { search: '?linkError=listenbrainz' } });

    await waitFor(() =>
      expect(toasts.items.map((toast) => toast.message)).toContain(
        'Could not connect to ListenBrainz'
      )
    );
    expect(toasts.items.find((toast) => toast.message.startsWith('Could not connect'))?.level).toBe(
      'error'
    );
  });

  it('shows an empty line when the server offers no service', async () => {
    answerList([]);

    const { findByText } = render(ServicesView, { props: { search: '' } });

    expect(await findByText('No services to connect')).toBeTruthy();
  });
});
