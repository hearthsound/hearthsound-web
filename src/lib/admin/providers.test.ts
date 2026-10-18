/**
 * Tests for the host settings and slugs of a provider instance.
 */
import { describe, expect, it } from 'vitest';

import {
  DEFAULT_HOST_CONFIG,
  defaultSlug,
  newProviderBody,
  providerPatchBody,
  readHostConfig,
  uniqueSlug
} from './providers';
import type { ProviderFields } from './providers';

describe('host configuration', () => {
  it('reads the settings an instance reports', () => {
    const config = readHostConfig({
      importRoots: [{ id: 'downloads', path: '/srv/downloads', mode: 'copy', readOnly: true }],
      maxConcurrent: 4,
      maxConcurrentSearches: 1,
      searchesPerHour: 30
    });

    expect(config).toEqual({
      importRoots: [{ id: 'downloads', path: '/srv/downloads', mode: 'copy', readOnly: true }],
      maxConcurrent: 4,
      maxConcurrentSearches: 1,
      searchesPerHour: 30
    });
  });

  it('falls back to the host default for a setting the instance did not make', () => {
    expect(readHostConfig({ importRoots: [] })).toEqual({
      ...DEFAULT_HOST_CONFIG,
      importRoots: []
    });
    expect(readHostConfig(null)).toEqual({ ...DEFAULT_HOST_CONFIG, importRoots: [] });
    expect(readHostConfig({ maxConcurrent: -1 }).maxConcurrent).toBe(
      DEFAULT_HOST_CONFIG.maxConcurrent
    );
  });

  it('keeps the import roots that are roots', () => {
    const config = readHostConfig({ importRoots: [{ id: 'root' }, 'nonsense'] });

    expect(config.importRoots).toEqual([{ id: 'root', path: '', mode: 'move', readOnly: false }]);
  });
});

describe('instance slugs', () => {
  it('derives the slug from the last segment of the plugin id', () => {
    expect(defaultSlug('app.hearthsound.slskd')).toBe('slskd');
    expect(defaultSlug('com.example.Hello-Catalog')).toBe('hellocatalog');
    expect(defaultSlug(`app.${'a'.repeat(30)}`)).toHaveLength(24);
  });

  it('keeps a free slug and numbers one that is taken', () => {
    expect(uniqueSlug('deezer', [])).toBe('deezer');
    expect(uniqueSlug('deezer', ['deezer'])).toBe('deezer2');
    expect(uniqueSlug('deezer', ['deezer', 'deezer2'])).toBe('deezer3');
  });

  it('keeps the numbered slug within the length the server accepts', () => {
    expect(uniqueSlug('a'.repeat(24), ['a'.repeat(24)]).length).toBeLessThanOrEqual(24);
  });
});

describe('instance bodies', () => {
  /** The fields of an instance of a search backend. */
  const fields: ProviderFields = {
    pluginId: 'app.hearthsound.slskd',
    slug: ' slskd ',
    displayName: ' Soulseek ',
    serverConfig: { url: 'http://localhost:5030' },
    hostConfig: {
      importRoots: [{ id: 'downloads', path: '/srv/downloads', mode: 'copy', readOnly: false }],
      maxConcurrent: 2,
      maxConcurrentSearches: 2,
      searchesPerHour: 120
    }
  };

  it('creates an instance with its plugin, its slug and both configurations', () => {
    expect(newProviderBody(fields)).toEqual({
      pluginId: 'app.hearthsound.slskd',
      slug: 'slskd',
      displayName: 'Soulseek',
      serverConfig: { url: 'http://localhost:5030' },
      hostConfig: fields.hostConfig
    });
  });

  it('creates an instance without a display name of its own', () => {
    expect(newProviderBody({ ...fields, displayName: '   ' }).displayName).toBeNull();
  });

  it('replaces both configurations and leaves the slug and the plugin alone', () => {
    const body = providerPatchBody({ ...fields, displayName: '' });

    expect(body).toEqual({
      serverConfig: { url: 'http://localhost:5030' },
      hostConfig: fields.hostConfig
    });
    expect('slug' in body).toBe(false);
    expect('pluginId' in body).toBe(false);
  });
});
