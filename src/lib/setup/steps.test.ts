/**
 * Tests for the rules the first-run wizard applies: the steps a run walks, the
 * one-time link's token, the password confirmation, the plugins offered per
 * layer with their preselection, the plan that puts them in service, the forms
 * the configuration step opens and the layer order the ordering step offers.
 */
import { describe, expect, it } from 'vitest';

import type { LayerView } from '#lib/admin/layers';
import type { AvailablePluginView, PluginView } from '#lib/admin/plugins';
import type { ProviderView } from '#lib/admin/providers';

import {
  configureTargets,
  defaultSelection,
  outcomeText,
  passwordProblem,
  pluginEntries,
  pluginPlan,
  runPluginPlan,
  seededLayers,
  setupSteps,
  setupToken
} from './steps';
import type { SetupPluginApi, SetupPluginCall, SetupPluginPlanEntry } from './steps';

/** An installed plugin, unless a test says otherwise. */
function installed(overrides: Partial<PluginView> = {}): PluginView {
  return {
    api: '1',
    approved: true,
    enabled: true,
    id: 'app.example.catalog',
    installedAt: 1_000,
    isDefault: false,
    name: 'Example catalog',
    provides: ['catalog'],
    requestedPermissions: [],
    source: 'official',
    state: 'enabled',
    version: '1.0.0',
    ...overrides
  };
}

/** A plugin an index offers, unless a test says otherwise. */
function offered(overrides: Partial<AvailablePluginView> = {}): AvailablePluginView {
  return {
    description: 'Searches a catalog.',
    homepage: 'http://localhost/example',
    id: 'app.example.catalog',
    isDefault: false,
    license: 'AGPL-3.0-or-later',
    name: 'Example catalog',
    official: true,
    provides: ['catalog'],
    verified: true,
    version: '1.0.0',
    ...overrides
  };
}

/** A configured instance, unless a test says otherwise. */
function provider(overrides: Partial<ProviderView> = {}): ProviderView {
  return {
    createdAt: 1_000,
    displayName: 'Example catalog',
    enabled: true,
    hostConfig: {},
    pluginId: 'app.example.catalog',
    serverConfig: {},
    slug: 'catalog',
    updatedAt: 1_000,
    ...overrides
  };
}

/** A layer with its assignments. */
function layer(name: string, instances: string[]): LayerView {
  return { layer: name, instances };
}

describe('the steps a run walks', () => {
  it('walks every step on a server without an administrator', () => {
    expect(setupSteps(true).map((step) => step.id)).toEqual([
      'administrator',
      'folders',
      'plugins',
      'configure',
      'order',
      'check'
    ]);
  });

  it('starts a server that has an administrator at the music folders', () => {
    expect(setupSteps(false).map((step) => step.id)).toEqual([
      'folders',
      'plugins',
      'configure',
      'order',
      'check'
    ]);
  });

  it('names every step', () => {
    expect(setupSteps(false).map((step) => step.title)).toEqual([
      'Music folders',
      'Plugins',
      'Configure',
      'Order',
      'Check'
    ]);
  });
});

describe('the setup link', () => {
  it('reads the token out of the query string', () => {
    expect(setupToken('?token=abc234')).toBe('abc234');
    expect(setupToken('token=abc234')).toBe('abc234');
    expect(setupToken('?from=log&token=abc234')).toBe('abc234');
  });

  it('reports no token when the link carries none', () => {
    expect(setupToken('')).toBeNull();
    expect(setupToken('?')).toBeNull();
    expect(setupToken('?from=log')).toBeNull();
    expect(setupToken('?token=')).toBeNull();
  });
});

describe('the administrator step', () => {
  it('sends a password that was confirmed', () => {
    expect(passwordProblem('correct horse', 'correct horse')).toBeNull();
  });

  it('refuses an empty password', () => {
    expect(passwordProblem('', '')).toBe('Choose a password.');
  });

  it('refuses a confirmation that differs', () => {
    expect(passwordProblem('correct horse', 'correct hors')).toBe('The passwords do not match.');
  });
});

describe('the plugin choices', () => {
  it('unions the installed and the offered plugins of a layer', () => {
    const entries = pluginEntries(
      [installed({ id: 'app.example.installed', name: 'Installed' })],
      [offered({ id: 'app.example.offered', name: 'Offered' })]
    );
    expect(entries.map((entry) => entry.id)).toEqual([
      'app.example.installed',
      'app.example.offered'
    ]);
    expect(entries.map((entry) => entry.layer)).toEqual(['catalog', 'catalog']);
  });

  it('lists a plugin that is installed and offered once', () => {
    const entries = pluginEntries(
      [installed({ id: 'app.example.both' })],
      [offered({ id: 'app.example.both' })]
    );
    expect(entries).toHaveLength(1);
    expect(entries[0].installed?.id).toBe('app.example.both');
    expect(entries[0].available?.id).toBe('app.example.both');
    expect(entries[0].description).toBe('Searches a catalog.');
  });

  it('lists a plugin that provides two layers once and names both', () => {
    const entries = pluginEntries([], [offered({ provides: ['metadata', 'catalog'] })]);
    expect(entries).toHaveLength(1);
    expect(entries[0].layer).toBe('catalog');
    expect(entries[0].layers).toEqual(['catalog', 'metadata']);
  });

  it('leaves out a plugin that provides none of the layers', () => {
    const entries = pluginEntries(
      [installed({ id: 'app.example.art', provides: ['artwork'] })],
      []
    );
    expect(entries).toEqual([]);
  });

  it('preselects the plugins the server ships with', () => {
    const entries = pluginEntries(
      [installed({ id: 'app.hearthsound.deezer', isDefault: true })],
      [
        offered({ id: 'app.hearthsound.slskd', provides: ['acquisition'], isDefault: true }),
        offered()
      ]
    );
    expect(defaultSelection(entries)).toEqual(['app.hearthsound.deezer', 'app.hearthsound.slskd']);
  });
});

describe('the plugin plan', () => {
  it('installs and approves a plugin nothing installed', () => {
    const entries = pluginEntries([], [offered({ id: 'app.example.fresh' })]);
    expect(pluginPlan(['app.example.fresh'], entries)[0].actions).toEqual(['install', 'approve']);
  });

  it('approves one waiting for approval and enables one switched off', () => {
    const entries = pluginEntries(
      [
        installed({ id: 'app.example.pending', state: 'pending-approval', approved: false }),
        installed({ id: 'app.example.off', state: 'disabled', enabled: false })
      ],
      []
    );
    const plan = pluginPlan(['app.example.pending', 'app.example.off'], entries);
    expect(plan.map((entry) => entry.actions)).toEqual([['approve'], ['enable']]);
  });

  it('leaves a plugin that already serves alone', () => {
    const entries = pluginEntries([installed({ id: 'app.example.ready' })], []);
    expect(pluginPlan(['app.example.ready'], entries)[0].actions).toEqual([]);
  });

  it('carries the repository an offered plugin comes from', () => {
    const entries = pluginEntries([], [offered({ id: 'app.example.third', repositoryId: 'pr_1' })]);
    expect(pluginPlan(['app.example.third'], entries)[0].repositoryId).toBe('pr_1');
  });

  it('reports every plugin and keeps one failure to itself', async () => {
    const plan: SetupPluginPlanEntry[] = [
      { id: 'a', name: 'A', repositoryId: null, actions: ['install', 'approve'] },
      { id: 'b', name: 'B', repositoryId: null, actions: ['install', 'approve'] },
      { id: 'c', name: 'C', repositoryId: null, actions: ['enable'] }
    ];
    const calls: string[] = [];
    const api: SetupPluginApi = {
      async install(entry): Promise<SetupPluginCall> {
        calls.push(`install ${entry.id}`);
        return { ok: true };
      },
      async approve(entry): Promise<SetupPluginCall> {
        calls.push(`approve ${entry.id}`);
        return entry.id === 'b'
          ? { ok: false, error: 'The index does not offer it.' }
          : { ok: true };
      },
      async enable(entry): Promise<SetupPluginCall> {
        calls.push(`enable ${entry.id}`);
        return { ok: true };
      }
    };

    const outcomes = await runPluginPlan(plan, api);

    expect(calls).toEqual(['install a', 'approve a', 'install b', 'approve b', 'enable c']);
    expect(outcomes.map((outcome) => outcome.id)).toEqual(['a', 'b', 'c']);
    expect(outcomes[0].error).toBeNull();
    expect(outcomes[1].error).toBe('The index does not offer it.');
    expect(outcomes[2].error).toBeNull();
  });

  it('stops a plugin at the action that failed', async () => {
    const plan: SetupPluginPlanEntry[] = [
      { id: 'a', name: 'A', repositoryId: null, actions: ['install', 'approve'] }
    ];
    const calls: string[] = [];
    const api: SetupPluginApi = {
      async install(entry): Promise<SetupPluginCall> {
        calls.push(`install ${entry.id}`);
        return { ok: false, error: 'The index is unreachable.' };
      },
      async approve(entry): Promise<SetupPluginCall> {
        calls.push(`approve ${entry.id}`);
        return { ok: true };
      },
      async enable(entry): Promise<SetupPluginCall> {
        calls.push(`enable ${entry.id}`);
        return { ok: true };
      }
    };

    const outcomes = await runPluginPlan(plan, api);

    expect(calls).toEqual(['install a']);
    expect(outcomes[0].done).toEqual([]);
    expect(outcomes[0].error).toBe('The index is unreachable.');
  });

  it('words what became of a plugin', () => {
    expect(outcomeText({ id: 'a', name: 'A', done: ['install', 'approve'], error: null })).toBe(
      'In service now: installed, approved.'
    );
    expect(outcomeText({ id: 'a', name: 'A', done: [], error: null })).toBe('Already in service.');
    expect(outcomeText({ id: 'a', name: 'A', done: ['install'], error: 'No such plugin.' })).toBe(
      'No such plugin.'
    );
  });
});

describe('the configuration targets', () => {
  it('offers a form per selected plugin, named and slugged after it', () => {
    const targets = configureTargets(
      ['app.example.catalog'],
      [installed({ id: 'app.example.catalog', name: 'Example catalog' })],
      []
    );
    expect(targets).toHaveLength(1);
    expect(targets[0].provider).toBeNull();
    expect(targets[0].fields.pluginId).toBe('app.example.catalog');
    expect(targets[0].fields.displayName).toBe('Example catalog');
    expect(targets[0].fields.slug).toBe('catalog');
    expect(targets[0].fields.hostConfig.importRoots).toEqual([]);
  });

  it('shows an existing instance of a plugin instead of a second one', () => {
    const existing = provider({
      slug: 'catalog-two',
      displayName: 'The one in service'
    });
    const targets = configureTargets(['app.example.catalog'], [installed()], [existing]);
    expect(targets[0].provider).toBe(existing);
    expect(targets[0].fields.slug).toBe('catalog-two');
    expect(targets[0].fields.displayName).toBe('The one in service');
    expect(targets[0].fields.hostConfig.maxConcurrent).toBe(2);
  });

  it('numbers a slug a second plugin of the same run would take', () => {
    const targets = configureTargets(
      ['app.example.one.slskd', 'app.example.two.slskd'],
      [
        installed({ id: 'app.example.one.slskd', name: 'One', provides: ['acquisition'] }),
        installed({ id: 'app.example.two.slskd', name: 'Two', provides: ['acquisition'] })
      ],
      []
    );
    expect(targets.map((target) => target.fields.slug)).toEqual(['slskd', 'slskd2']);
  });

  it('numbers a slug a configured instance holds', () => {
    const targets = configureTargets(
      ['app.example.one.slskd'],
      [installed({ id: 'app.example.one.slskd', provides: ['acquisition'] })],
      [provider({ slug: 'slskd', pluginId: 'app.example.other' })]
    );
    expect(targets[0].fields.slug).toBe('slskd2');
  });

  it('cuts a slug to the length the server accepts', () => {
    const long = `app.example.${'a'.repeat(30)}`;
    const targets = configureTargets([long], [installed({ id: long })], []);
    expect(targets[0].fields.slug).toBe('a'.repeat(24));
  });

  it('leaves out a plugin that is not installed', () => {
    expect(configureTargets(['app.example.gone'], [installed()], [])).toEqual([]);
  });
});

describe('the layer order', () => {
  const plugins = [
    installed({ id: 'app.example.catalog', provides: ['catalog'] }),
    installed({ id: 'app.example.slskd', provides: ['acquisition'] })
  ];

  it('adds the configured instances after the assigned ones', () => {
    const seeded = seededLayers(
      [layer('catalog', ['catalog-one'])],
      [
        provider({ slug: 'catalog-one', pluginId: 'app.example.catalog', createdAt: 1 }),
        provider({ slug: 'catalog-two', pluginId: 'app.example.catalog', createdAt: 2 })
      ],
      plugins,
      ['app.example.catalog']
    );
    expect(seeded).toEqual([layer('catalog', ['catalog-one', 'catalog-two'])]);
  });

  it('keeps the order the instances were created in', () => {
    const seeded = seededLayers(
      [layer('acquisition', [])],
      [
        provider({ slug: 'second', pluginId: 'app.example.slskd', createdAt: 2 }),
        provider({ slug: 'first', pluginId: 'app.example.slskd', createdAt: 1 })
      ],
      plugins,
      ['app.example.slskd']
    );
    expect(seeded[0].instances).toEqual(['first', 'second']);
  });

  it('leaves out a layer nothing serves', () => {
    const seeded = seededLayers([layer('catalog', []), layer('metadata', [])], [], plugins, [
      'app.example.catalog'
    ]);
    expect(seeded).toEqual([]);
  });

  it('leaves an instance out of a layer its plugin does not provide', () => {
    const seeded = seededLayers(
      [layer('catalog', [])],
      [provider({ slug: 'slskd', pluginId: 'app.example.slskd' })],
      plugins,
      ['app.example.slskd']
    );
    expect(seeded).toEqual([]);
  });

  it('leaves an instance that was not configured out of the layer', () => {
    const seeded = seededLayers(
      [layer('catalog', [])],
      [provider({ slug: 'catalog-one', pluginId: 'app.example.catalog' })],
      plugins,
      []
    );
    expect(seeded).toEqual([]);
  });
});
