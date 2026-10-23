<!--
  The services the signed-in account is connected to (the account area).

  Opened from the account menu. One group per service the server offers: its
  name and the layers it takes part in, whether the account is connected and
  under which name, the scrobbles still waiting for delivery and the last
  delivery failure. A service that links through its own site offers Connect,
  which opens the address the server answered with; a service that links with a
  configuration shows the plugin's form and Save. Disconnect asks first and
  then forgets the link. The page answers a browser link's return with a toast
  saying whether it worked.

  Usage: `<ServicesView search={page.url.search} />`
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import type { JsonSchema, UISchemaElement } from '@jsonforms/core';

  import JsonForm from '#lib/jsonforms/JsonForm.svelte';
  import { goBack } from '#lib/navigation';
  import { toasts } from '#lib/stores/toasts.svelte';
  import Banner from '#lib/ui/Banner.svelte';
  import Button from '#lib/ui/Button.svelte';
  import Dialog from '#lib/ui/Dialog.svelte';
  import PageHeader from '#lib/ui/PageHeader.svelte';
  import Skeleton from '#lib/ui/Skeleton.svelte';
  import StatusPage from '#lib/ui/StatusPage.svelte';

  import {
    beginServiceLink,
    listServices,
    openExternal,
    saveServiceConfig,
    unlinkService,
    type ProviderLink
  } from './services';

  /** Props of the page. */
  interface Props {
    /** The query string of the address, which carries a browser link's result. */
    search: string;
  }

  let { search }: Props = $props();

  /** The readable name of each layer a service may take part in. */
  const LAYER_LABELS: Readonly<Record<string, string>> = {
    scrobble: 'Scrobbling',
    discovery: 'Recommendations'
  };

  /** The account flow in progress, when one is. */
  interface Working {
    /** The service the flow belongs to. */
    slug: string;
    /** Which command is running. */
    action: 'connect' | 'save' | 'disconnect';
  }

  let services = $state<ProviderLink[]>([]);
  let loading = $state(true);
  let failure = $state<string | null>(null);
  /** The configuration each service's form holds, by slug. */
  let drafts = $state<Record<string, Record<string, unknown>>>({});
  /** The problem a refused save answered with, by slug. */
  let saveErrors = $state<Record<string, string>>({});
  let working = $state<Working | null>(null);
  /** The service the confirmation dialog asks about. */
  let disconnecting = $state<ProviderLink | null>(null);

  onMount(() => {
    void load(search);
  });

  /**
   * Reads the services and reports a browser link's return.
   *
   * The address the service sent the listener back to names the service it
   * linked, or failed to link; the toast is drawn once the names are known.
   *
   * @param query The query string to read the result from; empty on a reload.
   */
  async function load(query: string): Promise<void> {
    loading = services.length === 0;
    const result = await listServices();
    loading = false;
    if (!result.ok) {
      failure = result.message;
      return;
    }
    failure = null;
    services = result.value;
    announce(new URLSearchParams(query), services);
  }

  /**
   * Shows the result a browser link came back with.
   *
   * @param query The address's query parameters.
   * @param list The services the server just listed.
   */
  function announce(query: URLSearchParams, list: ProviderLink[]): void {
    const linked = query.get('linked');
    if (linked !== null) {
      toasts.push(`Connected to ${nameOf(list, linked)}`);
    }
    const failed = query.get('linkError');
    if (failed !== null) {
      toasts.push(`Could not connect to ${nameOf(list, failed)}`, 'error');
    }
  }

  /**
   * Names a service for a message.
   *
   * @param list The services the server listed.
   * @param slug The slug the address named.
   * @returns The display name, or the slug when the service is gone.
   */
  function nameOf(list: ProviderLink[], slug: string): string {
    return list.find((service) => service.slug === slug)?.displayName ?? slug;
  }

  /**
   * Names the layers a service takes part in.
   *
   * @param layers The layer ids the server reported.
   * @returns The readable names, comma separated.
   */
  function layerText(layers: string[]): string {
    return layers.map((layer) => LAYER_LABELS[layer] ?? layer).join(', ');
  }

  /**
   * Describes a service's connection.
   *
   * @param service The service.
   * @returns The sentence the row shows.
   */
  function connectionText(service: ProviderLink): string {
    if (!service.linked) {
      return 'Not connected';
    }
    return service.accountName === undefined || service.accountName === null
      ? 'Connected'
      : `Connected as ${service.accountName}`;
  }

  /**
   * Describes the scrobbles still waiting for one service.
   *
   * @param count How many are waiting.
   * @returns The sentence, or an empty string when none wait.
   */
  function pendingText(count: number): string {
    if (count === 0) {
      return '';
    }
    return count === 1 ? '1 scrobble waiting' : `${count} scrobbles waiting`;
  }

  /**
   * Runs one command against one service.
   *
   * @param slug The service's slug.
   * @param action Which command is running.
   * @returns Whether that command is the one in progress.
   */
  function busyWith(slug: string, action: Working['action']): boolean {
    return working?.slug === slug && working.action === action;
  }

  /**
   * Reads the plugin's user configuration form from a service.
   *
   * The document types the form as a free-form object, so the shape the form
   * renders is taken here once.
   *
   * @param service The service.
   * @returns The schema and UI schema, or `null` for a browser service.
   */
  function configOf(
    service: ProviderLink
  ): { schema: JsonSchema; uiSchema: UISchemaElement | null } | null {
    const config = service.userConfig as
      { schema: JsonSchema; uiSchema?: UISchemaElement | null } | null | undefined;
    if (config === null || config === undefined) {
      return null;
    }
    return { schema: config.schema, uiSchema: config.uiSchema ?? null };
  }

  /**
   * Removes a service's refused-save message.
   *
   * @param slug The service's slug.
   * @returns Nothing.
   */
  function clearSaveError(slug: string): void {
    if (saveErrors[slug] === undefined) {
      return;
    }
    const next = { ...saveErrors };
    delete next[slug];
    saveErrors = next;
  }

  /**
   * Starts a browser link and opens the service's authorization page.
   *
   * @param service The service to connect.
   */
  async function connect(service: ProviderLink): Promise<void> {
    working = { slug: service.slug, action: 'connect' };
    const result = await beginServiceLink(service.slug);
    working = null;
    if (!result.ok) {
      toasts.push(result.message, 'error');
      return;
    }
    openExternal(result.value);
  }

  /**
   * Stores the configuration a service's form holds.
   *
   * @param service The service to save.
   */
  async function save(service: ProviderLink): Promise<void> {
    working = { slug: service.slug, action: 'save' };
    const result = await saveServiceConfig(service.slug, drafts[service.slug] ?? {});
    working = null;
    if (!result.ok) {
      saveErrors = { ...saveErrors, [service.slug]: result.message };
      return;
    }
    clearSaveError(service.slug);
    services = services.map((existing) =>
      existing.slug === result.value.slug ? result.value : existing
    );
  }

  /**
   * Removes the link the confirmation dialog asked about.
   *
   * @returns Nothing.
   */
  async function disconnect(): Promise<void> {
    const service = disconnecting;
    if (service === null) {
      return;
    }
    working = { slug: service.slug, action: 'disconnect' };
    const result = await unlinkService(service.slug);
    working = null;
    disconnecting = null;
    if (!result.ok) {
      toasts.push(result.message, 'error');
      return;
    }
    await load('');
  }

  /** Returns to the page that opened this one. */
  function back(): void {
    goBack('/');
  }

  /** Asks the server again after a failed read. */
  function retry(): void {
    void load(search);
  }
</script>

<svelte:head>
  <title>Connected Services - Hearthsound</title>
</svelte:head>

{#snippet retryAction()}
  <Button onclick={retry}>Retry</Button>
{/snippet}

{#snippet form(service: ProviderLink)}
  {@const config = configOf(service)}
  {#if config !== null}
    <JsonForm
      schema={config.schema}
      uischema={config.uiSchema}
      data={drafts[service.slug] ?? {}}
      onchange={(data) => {
        drafts = { ...drafts, [service.slug]: data as Record<string, unknown> };
        clearSaveError(service.slug);
      }}
    />
  {/if}
  {#if saveErrors[service.slug] !== undefined}
    <Banner level="error" text={saveErrors[service.slug]} />
  {/if}
  <div class="save">
    <Button
      variant="suggested"
      busy={busyWith(service.slug, 'save')}
      onclick={() => void save(service)}
    >
      Save
    </Button>
  </div>
{/snippet}

<PageHeader title="Connected Services" class="services-header" onback={back} />

<div class="content">
  {#if failure !== null}
    <div class="state">
      <StatusPage
        level={2}
        alert
        icon="adwaita-error"
        title="Could Not Load This Page"
        text="The server did not answer. Try again in a moment."
        action={retryAction}
      />
    </div>
  {:else if loading && services.length === 0}
    <div class="hs-settings-group group" aria-busy="true">
      <span class="hs-visually-hidden" role="status">Loading...</span>
      {#each [0, 1] as row (row)}
        <div class="hs-setting-row hs-setting-row--two-line" aria-hidden="true">
          <span class="hs-setting-row__text">
            <Skeleton width="30%" height="12px" />
            <Skeleton width="55%" height="10px" />
          </span>
        </div>
      {/each}
    </div>
  {:else if services.length === 0}
    <p class="empty">No services to connect</p>
  {:else}
    {#each services as service (service.slug)}
      <section class="service" aria-label={service.displayName}>
        <div class="hs-settings-group group">
          <div class="hs-setting-row hs-setting-row--two-line">
            <span class="hs-setting-row__text">
              <span class="title">{service.displayName}</span>
              <span class="hs-setting-row__subtitle">{layerText(service.layers)}</span>
              <span class="hs-setting-row__subtitle">{connectionText(service)}</span>
              {#if service.pendingScrobbles > 0}
                <span class="hs-setting-row__subtitle">{pendingText(service.pendingScrobbles)}</span
                >
              {/if}
              {#if service.lastError !== undefined && service.lastError !== null}
                <span class="hs-setting-row__subtitle last-error">{service.lastError}</span>
              {/if}
            </span>
            <div class="actions">
              {#if service.linkMethod === 'browser' && !service.linked}
                <Button
                  variant="suggested"
                  busy={busyWith(service.slug, 'connect')}
                  onclick={() => void connect(service)}
                >
                  Connect
                </Button>
              {/if}
              {#if service.linked}
                <Button variant="destructive" onclick={() => (disconnecting = service)}>
                  Disconnect
                </Button>
              {/if}
            </div>
          </div>
          {#if service.linkMethod === 'config'}
            <div class="hs-setting-row form-row">
              <div class="form">
                {@render form(service)}
              </div>
            </div>
          {/if}
        </div>
      </section>
    {/each}
  {/if}
</div>

{#if disconnecting !== null}
  {@const closing = disconnecting}
  <Dialog
    title="Disconnect {closing.displayName}?"
    alert
    onclose={() => (disconnecting = null)}
    description={`Your account is unlinked from ${closing.displayName} and the scrobbles waiting to be delivered are discarded.`}
  >
    <span aria-hidden="true"></span>

    {#snippet footer()}
      <Button
        disabled={busyWith(closing.slug, 'disconnect')}
        onclick={() => (disconnecting = null)}
      >
        Cancel
      </Button>
      <Button
        variant="destructive"
        busy={busyWith(closing.slug, 'disconnect')}
        disabled={busyWith(closing.slug, 'disconnect')}
        onclick={() => void disconnect()}
      >
        Disconnect
      </Button>
    {/snippet}
  </Dialog>
{/if}

<style>
  /* Layout glue only: the shell holds the page off the window edge. */
  :global(.services-header) {
    padding-inline: 0;
  }

  /* Layout glue only: the groups sit under the header and the page keeps its
     bottom margin. */
  .content {
    display: flex;
    flex-direction: column;
    gap: var(--hs-space-4);
    padding-block: 0 var(--hs-space-7);
  }

  .service {
    display: flex;
    flex-direction: column;
    gap: var(--hs-space-2);
  }

  /* Layout glue only: a group clips its overflow to round its corners, which
     would cut off a control's popover. */
  .group {
    max-width: 760px;
    overflow: visible;
  }

  .title {
    display: block;
    min-width: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .actions {
    display: flex;
    flex: none;
    gap: var(--hs-space-2);
  }

  /* Layout glue only: k18 puts every field 18 px apart, and the failure banner
     keeps the form rhythm; the row holds the form as a block rather than a
     line. */
  .form-row {
    display: block;
    padding: var(--hs-space-4) var(--hs-space-4) var(--hs-space-5);
  }

  .form {
    display: flex;
    flex-direction: column;
    gap: var(--hs-space-5);
  }

  .save {
    display: flex;
    justify-content: flex-end;
  }

  /* The empty line of c03 item 11; the package has no page-text empty class. */
  .empty {
    margin: 0;
    color: var(--hs-fg-muted);
  }

  /* A delivery failure keeps the row's muted type but takes the error colour;
     the package names no class for an inline error line. */
  .last-error {
    color: var(--hs-error);
  }

  .state {
    display: flex;
    flex-direction: column;
    min-height: 60vh;
  }
</style>
