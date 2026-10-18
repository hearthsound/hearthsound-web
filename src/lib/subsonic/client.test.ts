/**
 * Tests for the Subsonic client: envelope handling, parameter encoding and the
 * session's CSRF header.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CSRF_HEADER, SubsonicClient, SubsonicError, setSubsonicHooks } from './client';
import type { AcquisitionsResponse, Search3Response } from './types';

/**
 * A stub transport that answers every call with one envelope.
 *
 * @param inner The `subsonic-response` member to answer with.
 * @returns The transport and the requests it received.
 */
function stubTransport(inner: unknown) {
  const requests: Request[] = [];
  const transport = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    requests.push(new Request(new URL(String(input), 'http://localhost').href, init));
    return new Response(JSON.stringify({ 'subsonic-response': inner }), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    });
  });
  return { transport: transport as unknown as typeof fetch, requests };
}

/**
 * Builds a client over a stub transport.
 *
 * @param inner The envelope to answer with.
 * @returns The client and the requests it sent.
 */
function clientOver(inner: unknown) {
  const { transport, requests } = stubTransport(inner);
  return { client: new SubsonicClient({ fetch: transport }), requests };
}

describe('Subsonic client', () => {
  afterEach(() => {
    setSubsonicHooks(null);
  });

  it('calls a read endpoint with the protocol and vendor parameters', async () => {
    const { client, requests } = clientOver({
      status: 'ok',
      version: '1.16.1',
      searchResult3: { song: [{ id: 'tr_1', title: 'First' }] }
    });

    const answer = await client.get<Search3Response>('search3', { query: 'first', songCount: 30 });

    expect(answer.searchResult3?.song?.[0].title).toBe('First');
    const url = new URL(requests[0].url);
    expect(requests[0].method).toBe('GET');
    expect(url.pathname).toBe('/rest/search3');
    expect(url.searchParams.get('f')).toBe('json');
    expect(url.searchParams.get('v')).toBe('1.16.1');
    expect(url.searchParams.get('c')).toBe('hearthsound-web');
    expect(url.searchParams.get('hearthsound')).toBe('1');
    expect(url.searchParams.get('query')).toBe('first');
    expect(url.searchParams.get('songCount')).toBe('30');
  });

  it('repeats a list parameter, in the query of a read and the body of a write', async () => {
    const { client, requests } = clientOver({ status: 'ok' });

    await client.get('hsGetAvailability', { id: ['tr_1', 'tr_2'] });
    await client.post<AcquisitionsResponse>('hsAcquire', {
      id: ['tr_1', 'tr_2'],
      priority: 'play'
    });

    const query = new URL(requests[0].url).searchParams;
    expect(query.getAll('id')).toEqual(['tr_1', 'tr_2']);
    expect(requests[1].method).toBe('POST');
    expect(requests[1].headers.get('content-type')).toBe('application/x-www-form-urlencoded');
    const body = new URLSearchParams(await requests[1].text());
    expect(body.getAll('id')).toEqual(['tr_1', 'tr_2']);
    expect(body.get('priority')).toBe('play');
    expect(body.get('hearthsound')).toBe('1');
    expect(new URL(requests[1].url).search).toBe('');
  });

  it('skips parameters without a value', async () => {
    const { client, requests } = clientOver({ status: 'ok' });

    await client.get('search3', { query: '', offset: null, size: undefined });

    const query = new URL(requests[0].url).searchParams;
    expect(query.get('query')).toBe('');
    expect(query.has('offset')).toBe(false);
    expect(query.has('size')).toBe(false);
  });

  it('throws the failed envelope as an error with its code', async () => {
    const { client } = clientOver({
      status: 'failed',
      error: { code: 40, message: 'Wrong username or password.' }
    });

    await expect(client.get('ping')).rejects.toThrowError(SubsonicError);
    const failure = await client.get('ping').catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(SubsonicError);
    expect((failure as SubsonicError).code).toBe(40);
    expect((failure as SubsonicError).message).toBe('Wrong username or password.');
  });

  it('rejects a body that is not a Subsonic envelope', async () => {
    const transport = vi.fn(
      async () => new Response('{"detail":"nope"}', { status: 502 })
    ) as unknown as typeof fetch;
    const client = new SubsonicClient({ fetch: transport });

    await expect(client.get('ping')).rejects.toThrowError(/HTTP 502/);
  });

  it('sends the session CSRF token on every call, and none without a session', async () => {
    const { client, requests } = clientOver({ status: 'ok' });

    await client.get('ping');
    expect(requests[0].headers.has(CSRF_HEADER)).toBe(false);

    setSubsonicHooks({ csrfToken: () => 'csrf-token' });
    await client.get('ping');
    await client.post('scrobble', { id: 'tr_1', submission: false });
    expect(requests[1].headers.get(CSRF_HEADER)).toBe('csrf-token');
    expect(requests[2].headers.get(CSRF_HEADER)).toBe('csrf-token');
  });

  it('builds a same-origin URL for a binary endpoint, without the vendor flag', () => {
    const client = new SubsonicClient();
    const url = new URL(client.binaryUrl('stream', { id: 'tr_1', format: 'raw' }), 'http://local');

    expect(url.pathname).toBe('/rest/stream');
    expect(url.searchParams.get('id')).toBe('tr_1');
    expect(url.searchParams.get('format')).toBe('raw');
    expect(url.searchParams.get('f')).toBe('json');
    expect(url.searchParams.get('c')).toBe('hearthsound-web');
    expect(url.searchParams.has('hearthsound')).toBe(false);
  });
});
