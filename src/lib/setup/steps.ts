/**
 * What the first-run wizard walks through, and the rules it applies.
 *
 * The wizard leads a fresh server from an empty database to a working one: it
 * creates the administrator from the one-time link, adds the first music
 * folders, installs the plugins of each layer, configures an instance per
 * plugin, orders the layers and checks the result. Everything that can be
 * decided without a server lives here, so the views only render what these
 * functions return.
 *
 * The plugins of the three layers the wizard offers are the union of the
 * installed ones and the ones the reachable indexes offer, deduplicated by id:
 * a plugin that is both installed and offered is listed once, and one that
 * provides more than one of the layers is listed under the first of them while
 * naming every layer it provides.
 *
 * A run may finish with a required layer nothing serves; the sentences that
 * say so are worded here, so the step that configures and the summary that
 * reports cannot drift apart.
 */
import { instanceFields, pluginFields } from '#lib/admin/providers';
import type { LayerView } from '#lib/admin/layers';
import type { AvailablePluginView, PluginView } from '#lib/admin/plugins';
import type { ProviderFields, ProviderView } from '#lib/admin/providers';
import { passwordLengthProblem } from '#lib/password';

/** The step of the wizard a run is on. */
export type SetupStepId = 'administrator' | 'folders' | 'plugins' | 'configure' | 'order' | 'check';

/** One step of the wizard. */
export interface SetupStep {
  /** The step's id. */
  id: SetupStepId;
  /** The heading the step list shows it under. */
  title: string;
}

/** Every step of the wizard, in the order a fresh server walks them. */
export const SETUP_STEPS: readonly SetupStep[] = [
  { id: 'administrator', title: 'Administrator' },
  { id: 'folders', title: 'Music folders' },
  { id: 'plugins', title: 'Plugins' },
  { id: 'configure', title: 'Configure' },
  { id: 'order', title: 'Order' },
  { id: 'check', title: 'Check' }
];

/**
 * Returns the steps a run walks.
 *
 * A server that still needs its first administrator starts with the step that
 * creates one; a server that has one - an administrator opening the wizard
 * again - starts at the music folders, because the account exists already.
 *
 * @param required Whether the server still needs its first administrator.
 * @returns The steps, in order.
 */
export function setupSteps(required: boolean): SetupStep[] {
  return required ? [...SETUP_STEPS] : SETUP_STEPS.filter((step) => step.id !== 'administrator');
}

/**
 * Decides what a browser that opens the wizard's address is shown.
 *
 * A server that still needs its administrator lets the browser walk the
 * wizard; one that has it does not, because Admin > Folders and Admin > Plugins
 * cover the same work, so an administrator goes home and is told why, while any
 * other browser leaves for the ordinary landing.
 *
 * @param required Whether the server still needs its first administrator.
 * @param isAdmin Whether the browser holds an administrator's session.
 * @returns `wizard` while setup is required, `home` for an administrator once
 *   it is complete, and `login` for every other browser then; a signed-in member
 *   among them goes home rather than to the sign-in form.
 */
export function setupVerdict(required: boolean, isAdmin: boolean): 'wizard' | 'home' | 'login' {
  if (required) {
    return 'wizard';
  }
  return isAdmin ? 'home' : 'login';
}

/**
 * Reads the one-time token out of the setup link's query string.
 *
 * @param search The query string, with or without its leading `?`.
 * @returns The token, or `null` when the link carries none.
 */
export function setupToken(search: string): string | null {
  const token = new URLSearchParams(search).get('token');
  return token === null || token === '' ? null : token;
}

/**
 * Reports what the administrator step holds against the password it entered.
 *
 * @param password The password to set.
 * @param confirmation The password typed a second time.
 * @returns The message to show, or `null` when the two may be sent.
 */
export function passwordProblem(password: string, confirmation: string): string | null {
  if (password === '') {
    return 'Choose a password.';
  }
  const tooShort = passwordLengthProblem(password);
  if (tooShort !== null) {
    return tooShort;
  }
  if (password !== confirmation) {
    return 'The passwords do not match.';
  }
  return null;
}

/** The layers the wizard offers plugins for. */
export const SETUP_LAYERS: readonly string[] = ['catalog', 'metadata', 'acquisition'];

/**
 * The plugins the server refuses to remove, disable or unhook.
 *
 * The server installs these itself and keeps them in service; the wizard shows
 * them checked with no way to uncheck them, and the ordering step refuses to
 * remove their instances. The refusal is the server's, so a client that sends
 * the write anyway still reads the `plugin-required` problem it answers.
 */
export const REQUIRED_PLUGIN_IDS: readonly string[] = ['app.hearthsound.musicbrainz'];

/**
 * Reports whether a plugin is one the server requires.
 *
 * @param id The plugin id.
 * @returns `true` for a mandatory plugin.
 */
export function isRequiredPlugin(id: string): boolean {
  return REQUIRED_PLUGIN_IDS.includes(id);
}

/** One plugin the wizard may install and configure. */
export interface SetupPluginEntry {
  /** The plugin id from its manifest. */
  id: string;
  /** The display name. */
  name: string;
  /** The one-line description the index gives, when one does. */
  description: string | null;
  /** The setup layer the entry is listed under: the first one it provides. */
  layer: string;
  /** Every setup layer the plugin provides. */
  layers: string[];
  /** Whether the server ships this plugin, which preselects it. */
  isDefault: boolean;
  /** The installed plugin, when the server hosts it. */
  installed: PluginView | null;
  /** What an index offers, when one does. */
  available: AvailablePluginView | null;
}

/**
 * Returns the plugins the wizard offers, per layer.
 *
 * The installed plugins come first, in the order the server lists them, and the
 * plugins only an index offers after them; anything that provides none of the
 * wizard's layers is left out.
 *
 * @param installed The installed plugins.
 * @param available The plugins the reachable indexes offer.
 * @param layers The layers to offer plugins for.
 * @returns One entry per plugin, in the order they are listed.
 */
export function pluginEntries(
  installed: readonly PluginView[],
  available: readonly AvailablePluginView[],
  layers: readonly string[] = SETUP_LAYERS
): SetupPluginEntry[] {
  const offered = new Map(available.map((plugin) => [plugin.id, plugin]));
  const entries: SetupPluginEntry[] = [];
  const listed = new Set<string>();

  const add = (
    id: string,
    name: string,
    description: string | null,
    provides: readonly string[],
    isDefault: boolean,
    installedView: PluginView | null
  ): void => {
    const provided = layers.filter((layer) => provides.includes(layer));
    if (provided.length === 0 || listed.has(id)) {
      return;
    }
    listed.add(id);
    entries.push({
      id,
      name,
      description,
      layer: provided[0] as string,
      layers: provided,
      isDefault,
      installed: installedView,
      available: offered.get(id) ?? null
    });
  };

  for (const plugin of installed) {
    add(
      plugin.id,
      plugin.name,
      offered.get(plugin.id)?.description ?? null,
      plugin.provides,
      plugin.isDefault,
      plugin
    );
  }
  for (const plugin of available) {
    add(plugin.id, plugin.name, plugin.description, plugin.provides, plugin.isDefault, null);
  }
  return entries;
}

/**
 * Returns the plugins the wizard starts with checked.
 *
 * The plugins the server ships are the ones the wizard preselects; a required
 * plugin is always among them, because it cannot be switched off.
 *
 * @param entries The offered plugins.
 * @returns The ids of the plugins the server ships and requires.
 */
export function defaultSelection(entries: readonly SetupPluginEntry[]): string[] {
  return entries
    .filter((entry) => entry.isDefault || isRequiredPlugin(entry.id))
    .map((entry) => entry.id);
}

/** One step the wizard runs on one plugin. */
export type SetupPluginAction = 'install' | 'enable';

/**
 * Returns what has to happen to one plugin for it to serve.
 *
 * A plugin nothing installed is installed, which grants the permissions its
 * manifest requests and enables it; one that is switched off is switched on
 * again. A plugin that is already in service, and one whose upgrade waits for
 * review, is left as it is.
 *
 * @param installed The installed plugin, or `null` when nothing installed it.
 * @returns The actions, in the order they are run.
 */
export function pluginActions(installed: PluginView | null): SetupPluginAction[] {
  if (installed === null) {
    return ['install'];
  }
  if (installed.state === 'disabled') {
    return ['enable'];
  }
  return [];
}

/** What the wizard does to one plugin. */
export interface SetupPluginPlanEntry {
  /** The plugin id. */
  id: string;
  /** The display name. */
  name: string;
  /** The repository the plugin is installed from, when the index named one. */
  repositoryId: string | null;
  /** The actions to run, in order; empty when the plugin already serves. */
  actions: SetupPluginAction[];
}

/**
 * Returns what the wizard does to every selected plugin.
 *
 * @param selected The ids the administrator checked.
 * @param entries The offered plugins.
 * @returns One plan entry per selected plugin that is installed or offered, in
 *   the order of the offered list.
 */
export function pluginPlan(
  selected: readonly string[],
  entries: readonly SetupPluginEntry[]
): SetupPluginPlanEntry[] {
  const plan: SetupPluginPlanEntry[] = [];
  for (const entry of entries) {
    if (!selected.includes(entry.id)) {
      continue;
    }
    plan.push({
      id: entry.id,
      name: entry.name,
      repositoryId: entry.available?.repositoryId ?? null,
      actions: pluginActions(entry.installed)
    });
  }
  return plan;
}

/** The answer to one plugin call. */
export type SetupPluginCall = { ok: true } | { ok: false; error: string };

/** The calls the wizard makes to put the selected plugins in service. */
export interface SetupPluginApi {
  /**
   * Installs one plugin from an index.
   *
   * @param entry The plugin to install.
   * @returns The answer.
   */
  install(entry: SetupPluginPlanEntry): Promise<SetupPluginCall>;
  /**
   * Switches one plugin on.
   *
   * @param entry The plugin to enable.
   * @returns The answer.
   */
  enable(entry: SetupPluginPlanEntry): Promise<SetupPluginCall>;
}

/** What became of one plugin the wizard ran a plan on. */
export interface SetupPluginOutcome {
  /** The plugin id. */
  id: string;
  /** The display name. */
  name: string;
  /** The actions that finished, in order. */
  done: SetupPluginAction[];
  /** What the action that failed reported, or `null` when every one finished. */
  error: string | null;
}

/** What each action is shown as once it finished. */
const ACTION_LABELS: Record<SetupPluginAction, string> = {
  install: 'installed',
  enable: 'enabled'
};

/**
 * Returns the line one plugin's outcome shows.
 *
 * @param outcome What became of the plugin.
 * @returns The failure, the news that nothing had to be done, or the actions
 *   that finished.
 */
export function outcomeText(outcome: SetupPluginOutcome): string {
  if (outcome.error !== null) {
    return outcome.error;
  }
  if (outcome.done.length === 0) {
    return 'Already in service.';
  }
  return `In service now: ${outcome.done.map((action) => ACTION_LABELS[action]).join(', ')}.`;
}

/**
 * Runs one plugin's plan and reports what became of it.
 *
 * Every plugin is run on its own: what one fails at is noted and the next one
 * is run anyway, and a plugin whose action failed stops there, so a plugin that
 * could not be installed is not switched on.
 *
 * @param plan What to do to each plugin.
 * @param api The calls to make.
 * @returns One outcome per plan entry, in order.
 */
export async function runPluginPlan(
  plan: readonly SetupPluginPlanEntry[],
  api: SetupPluginApi
): Promise<SetupPluginOutcome[]> {
  const outcomes: SetupPluginOutcome[] = [];
  for (const entry of plan) {
    const done: SetupPluginAction[] = [];
    let error: string | null = null;
    for (const action of entry.actions) {
      const answer = action === 'install' ? await api.install(entry) : await api.enable(entry);
      if (!answer.ok) {
        error = answer.error;
        break;
      }
      done.push(action);
    }
    outcomes.push({ id: entry.id, name: entry.name, done, error });
  }
  return outcomes;
}

/** One plugin the wizard configures, with the fields its form opens with. */
export interface SetupConfigureTarget {
  /** The installed plugin to configure. */
  plugin: PluginView;
  /** The instance the plugin already has, when it has one. */
  provider: ProviderView | null;
  /** The fields the form holds. */
  fields: ProviderFields;
}

/**
 * Returns the plugins the wizard configures, with their forms.
 *
 * A plugin that already has an instance is shown with it, so the wizard changes
 * what is there instead of configuring a second instance; a plugin without one
 * is offered the slug its id suggests, numbered when another plugin of the same
 * run would take it.
 *
 * @param selected The ids the administrator checked.
 * @param installed The installed plugins.
 * @param providers Every configured instance.
 * @returns One target per selected plugin that is installed, in the order of
 *   the selection.
 */
export function configureTargets(
  selected: readonly string[],
  installed: readonly PluginView[],
  providers: readonly ProviderView[]
): SetupConfigureTarget[] {
  const targets: SetupConfigureTarget[] = [];
  const taken = providers.map((provider) => provider.slug);
  for (const id of selected) {
    const plugin = installed.find((entry) => entry.id === id);
    if (plugin === undefined) {
      continue;
    }
    const provider = providers.find((entry) => entry.pluginId === id) ?? null;
    if (provider !== null) {
      targets.push({ plugin, provider, fields: instanceFields(provider) });
      continue;
    }
    const fields = pluginFields(plugin, taken);
    taken.push(fields.slug);
    targets.push({ plugin, provider: null, fields });
  }
  return targets;
}

/** The layers a finished setup needs at least one serving instance for. */
export const REQUIRED_LAYERS = ['catalog', 'metadata', 'acquisition'] as const;

/** What each required layer says while nothing serves it (A-web-admin-11). */
export const EMPTY_LAYER_WARNINGS: Record<(typeof REQUIRED_LAYERS)[number], string> = {
  catalog: 'No catalog source yet - online search will find nothing.',
  metadata: 'No metadata source yet - tags and artwork will not be enriched.',
  acquisition:
    'No download source yet - songs that are not on the server cannot be played or saved.'
};

/**
 * Returns the warning of every required layer no enabled instance serves.
 *
 * A layer is served when one of its instances is enabled and its plugin names
 * the layer; a disabled instance does not serve, and a plugin that names two
 * layers serves both.
 *
 * @param providers Every configured instance.
 * @param plugins Every installed plugin, which names the layers it provides.
 * @returns One sentence per empty layer, in `REQUIRED_LAYERS` order.
 */
export function emptyLayerWarnings(
  providers: readonly ProviderView[],
  plugins: readonly PluginView[]
): string[] {
  const provides = new Map(plugins.map((plugin) => [plugin.id, plugin.provides]));
  const warnings: string[] = [];
  for (const layer of REQUIRED_LAYERS) {
    const served = providers.some(
      (provider) => provider.enabled && provides.get(provider.pluginId)?.includes(layer) === true
    );
    if (!served) {
      warnings.push(EMPTY_LAYER_WARNINGS[layer]);
    }
  }
  return warnings;
}

/**
 * Returns the layers as the wizard offers them to the ordering step.
 *
 * Every instance the server already assigned keeps its place, and the
 * instances of the plugins this run configured join the layers their plugin
 * provides, in the order they were created. Every layer is kept, also one
 * nothing serves yet, so the step can offer to add an instance (order-layers).
 *
 * @param layers The layers and their assignments.
 * @param providers Every configured instance.
 * @param plugins Every installed plugin, which names the layers it provides.
 * @param selected The plugin ids the administrator checked.
 * @returns The layers to order, in the order the server lists them.
 */
export function seededLayers(
  layers: readonly LayerView[],
  providers: readonly ProviderView[],
  plugins: readonly PluginView[],
  selected: readonly string[]
): LayerView[] {
  const provides = new Map(plugins.map((plugin) => [plugin.id, plugin.provides]));
  const configured = providers
    .filter((provider) => selected.includes(provider.pluginId))
    .sort((left, right) => left.createdAt - right.createdAt);
  const seeded: LayerView[] = [];
  for (const layer of layers) {
    const instances = [...layer.instances];
    for (const provider of configured) {
      const assigned = instances.includes(provider.slug);
      const serves = provides.get(provider.pluginId)?.includes(layer.layer) === true;
      if (assigned || !serves) {
        continue;
      }
      instances.push(provider.slug);
    }
    seeded.push({ layer: layer.layer, instances });
  }
  return seeded;
}
