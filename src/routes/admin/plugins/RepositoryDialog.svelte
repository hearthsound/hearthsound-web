<!--
  The repository dialog (p24).

  A registered index's URL is fixed once registered; the dialog edits the name
  shown to administrators, the minisign public key its index is signed with and
  whether it is queried. The page owns the open state; the dialog saves the
  change and closes once the server answers.
-->
<script lang="ts">
  import { untrack } from 'svelte';

  import { updateRepository } from '#lib/admin/api/plugins';
  import type { RepositoryView } from '#lib/admin/plugins';
  import Banner from '#lib/ui/Banner.svelte';
  import Button from '#lib/ui/Button.svelte';
  import Checkbox from '#lib/ui/Checkbox.svelte';
  import Dialog from '#lib/ui/Dialog.svelte';
  import FormField from '#lib/ui/FormField.svelte';
  import TextArea from '#lib/ui/TextArea.svelte';
  import TextField from '#lib/ui/TextField.svelte';

  /** Props of the dialog. */
  interface Props {
    /** The repository to change. */
    repository: RepositoryView;
    /** Closes the dialog; the caller unmounts it. */
    onclose: () => void;
    /** Receives the news that the server saved the change. */
    onsaved: () => void;
  }

  let { repository, onclose, onsaved }: Props = $props();

  const uid = $props.id();
  const urlId = $derived(`repository-dialog-url-${uid}`);
  const nameId = $derived(`repository-dialog-name-${uid}`);
  const keyId = $derived(`repository-dialog-key-${uid}`);
  const formId = $derived(`repository-form-${uid}`);

  let name = $state(untrack(() => repository.name ?? ''));
  let publicKey = $state(untrack(() => repository.publicKey ?? ''));
  let enabled = $state(untrack(() => repository.enabled));
  let failure = $state<string | null>(null);
  let busy = $state(false);

  /**
   * Saves the fields the dialog holds.
   *
   * @param event The form submission.
   */
  async function save(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    busy = true;
    const result = await updateRepository(repository.id, {
      name: name.trim() === '' ? null : name.trim(),
      publicKey: publicKey.trim() === '' ? null : publicKey.trim(),
      enabled
    });
    busy = false;
    if (!result.ok) {
      failure = result.message;
      return;
    }
    onsaved();
  }
</script>

{#snippet footer()}
  <Button onclick={onclose}>Cancel</Button>
  <Button variant="suggested" type="submit" form={formId} {busy}>Save changes</Button>
{/snippet}

<Dialog title={repository.name ?? repository.url} {onclose} {footer}>
  <form id={formId} class="hs-form" novalidate onsubmit={save}>
    <FormField label="URL" for={urlId}>
      <TextField id={urlId} kind="url" value={repository.url} disabled />
    </FormField>

    <FormField label="Name" for={nameId} optional>
      <TextField id={nameId} bind:value={name} />
    </FormField>

    <FormField label="Public key" for={keyId} optional>
      <TextArea id={keyId} bind:value={publicKey} />
    </FormField>

    <Checkbox label="Query this repository" bind:checked={enabled} />

    {#if failure !== null}
      <Banner level="error" text={failure} />
    {/if}
  </form>
</Dialog>
