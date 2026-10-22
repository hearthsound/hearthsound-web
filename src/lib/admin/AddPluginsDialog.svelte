<!--
  The Add Plugins dialog (p24-r1, p24-r3, k23, k19).

  One 340 px dialog with a segmented control: the Repository tab registers an
  index, the File tab installs an archive from this computer. The page owns the
  request; this component collects the fields, shows the problem the page
  reports and closes once the page answers without one.

  The chosen-file row carries the archive's name and size. Its permission list
  is built but switched off until the core reports permissions for uninstalled
  plugins (plugin-approval-interim); the comment in the File tab marks where it
  lands.
-->
<script lang="ts">
  import Banner from '#lib/ui/Banner.svelte';
  import Button from '#lib/ui/Button.svelte';
  import Checkbox from '#lib/ui/Checkbox.svelte';
  import Dialog from '#lib/ui/Dialog.svelte';
  import DropZone from '#lib/ui/DropZone.svelte';
  import FormField from '#lib/ui/FormField.svelte';
  import Icon from '#lib/ui/Icon.svelte';
  import Segmented from '#lib/ui/Segmented.svelte';
  import TextArea from '#lib/ui/TextArea.svelte';
  import TextField from '#lib/ui/TextField.svelte';

  import { formatBytes } from '#lib/format';

  /** What the dialog asks a page to register or install. */
  export type AddPluginsRequest =
    | {
        /** The Repository tab was submitted. */
        kind: 'repository';
        /** The URL of the index document. */
        url: string;
        /** The name shown to administrators, or `null` when empty. */
        name: string | null;
        /** The minisign public key, or `null` when empty. */
        publicKey: string | null;
        /** Whether the new repository is queried; the setup step offers this. */
        query: boolean;
      }
    | {
        /** The File tab was submitted. */
        kind: 'file';
        /** The archive to install. */
        file: File;
      };

  /** Props of the dialog. */
  interface Props {
    /** Closes the dialog; the caller unmounts it. */
    onclose: () => void;
    /**
     * Registers the repository or installs the archive. Resolves with the line
     * to show for a failure, or `null` when the page took the request and the
     * dialog should close.
     */
    onsubmit: (request: AddPluginsRequest) => Promise<string | null>;
    /**
     * Shows the setup step's "Query this repository" checkbox, which the admin
     * dialog does not draw (p24-r1).
     */
    queryOption?: boolean;
  }

  let { onclose, onsubmit, queryOption = false }: Props = $props();

  const tabs = [
    { value: 'repository', label: 'Repository' },
    { value: 'file', label: 'File' }
  ];

  const uid = $props.id();
  const urlId = $derived(`repository-url-${uid}`);
  const nameId = $derived(`repository-name-${uid}`);
  const keyId = $derived(`repository-key-${uid}`);
  const formId = $derived(`add-plugins-${uid}`);

  let tab = $state<'repository' | 'file'>('repository');
  let url = $state('');
  let name = $state('');
  let publicKey = $state('');
  let query = $state(true);
  let archive = $state<File | null>(null);
  let failure = $state<string | null>(null);
  let busy = $state(false);
  /** Whether the URL field has been left or refused once. */
  let urlTouched = $state(false);

  /** What is wrong with the typed URL, or `null` when it is allowed. */
  const urlProblemText = $derived(url.trim() === '' ? 'Choose the repository URL.' : null);
  /** The error under the field, shown only once the reader has left it. */
  const urlError = $derived(urlTouched ? urlProblemText : null);

  /**
   * Keeps the first file a drop or the picker answered with.
   *
   * @param files The files.
   */
  function choose(files: FileList): void {
    const [first] = files;
    if (first !== undefined) {
      archive = first;
    }
  }

  /**
   * Asks the page to register the repository or install the archive.
   *
   * @param event The form submission.
   */
  async function submit(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    failure = null;
    let request: AddPluginsRequest;
    if (tab === 'repository') {
      if (urlProblemText !== null) {
        urlTouched = true;
        return;
      }
      request = {
        kind: 'repository',
        url: url.trim(),
        name: name.trim() === '' ? null : name.trim(),
        publicKey: publicKey.trim() === '' ? null : publicKey.trim(),
        query
      };
    } else {
      if (archive === null) {
        failure = 'Choose an archive to install.';
        return;
      }
      request = { kind: 'file', file: archive };
    }
    busy = true;
    const problem = await onsubmit(request);
    busy = false;
    if (problem === null) {
      onclose();
      return;
    }
    failure = problem;
  }
</script>

{#snippet footer()}
  <Button onclick={onclose}>Cancel</Button>
  <Button variant="suggested" type="submit" form={formId} {busy}>
    {tab === 'repository' ? 'Add Repository' : 'Install File'}
  </Button>
{/snippet}

<Dialog title="Add Plugins" {onclose} {footer}>
  <form id={formId} class="hs-form" novalidate onsubmit={submit}>
    <Segmented
      label="Add Plugins"
      segments={tabs}
      value={tab}
      onchange={(chosen) => (tab = chosen === 'file' ? 'file' : 'repository')}
    />

    {#if tab === 'repository'}
      <p>A repository lists more plugins; they appear under Available.</p>

      <FormField label="URL" for={urlId} error={urlError ?? undefined}>
        <TextField
          id={urlId}
          kind="url"
          bind:value={url}
          invalid={urlError !== null}
          onblur={() => (urlTouched = true)}
          required
        />
      </FormField>

      <FormField label="Name" for={nameId} optional>
        <TextField id={nameId} bind:value={name} />
      </FormField>

      <FormField label="Public key" for={keyId} optional>
        <TextArea id={keyId} bind:value={publicKey} />
      </FormField>

      {#if queryOption}
        <Checkbox label="Query this repository" bind:checked={query} />
      {/if}
    {:else}
      <p>Install a plugin from an archive file on this computer.</p>

      <DropZone
        small
        icon="adwaita-plugin"
        label="Plugin archive"
        hint="Drop the archive here, or choose it."
        buttonLabel="Choose file"
        accept=".hsplugin"
        multiple={false}
        suggested={false}
        onfiles={choose}
      />

      {#if archive !== null}
        <div class="hs-setting-row hs-setting-row--two-line picked">
          <Icon name="adwaita-plugin" class="hs-setting-row__icon" />
          <span class="hs-setting-row__text">
            <span class="name">{archive.name}</span>
            <span class="hs-setting-row__subtitle">{formatBytes(archive.size)}</span>
          </span>
          <Button
            shape="icon"
            variant="flat"
            icon="adwaita-close"
            label="Remove"
            onclick={() => (archive = null)}
          />
        </div>
        <!-- plugin-approval-interim: the chosen archive's permission list goes
             here once the core reports permissions for uninstalled plugins. -->
      {/if}
    {/if}

    {#if failure !== null}
      <Banner level="error" text={failure} />
    {/if}
  </form>
</Dialog>

<style>
  /* p24-r1 draws the chosen archive on one line; its name is longer than the
     340 px dialog, so the row's first line ellipsises instead of wrapping. */
  .picked .name {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
</style>
