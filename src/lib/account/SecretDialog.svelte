<!--
  The dialog that shows a credential's secret once (E-B-2).

  The server answers a created credential with its secret and never sends it
  again, so this is the only place it is visible. It is a read-only password
  field, which means the field's own Reveal action shows it and a screenshot or a
  shoulder behind the reader does not read it by accident. Done closes it and the
  page reloads the list, so the new row appears without its secret.

  Usage:
  `<SecretDialog title="API Key Created" secret={created.secret} onclose={reload} />`
-->
<script lang="ts">
  import Button from '#lib/ui/Button.svelte';
  import Dialog from '#lib/ui/Dialog.svelte';
  import FormField from '#lib/ui/FormField.svelte';
  import TextField from '#lib/ui/TextField.svelte';

  /** Props of the dialog. */
  interface Props {
    /** The title, which names the kind of credential that was created. */
    title: string;
    /** The secret the server answered with. */
    secret: string;
    /** Closes the dialog; the caller unmounts it and reloads the list. */
    onclose: () => void;
  }

  let { title, secret, onclose }: Props = $props();

  const uid = $props.id();
  const secretId = $derived(`credential-secret-${uid}`);
</script>

{#snippet footer()}
  <Button variant="suggested" onclick={onclose}>Done</Button>
{/snippet}

<Dialog {title} {onclose} {footer}>
  <p class="note">Copy it now. This is the only time the server shows it.</p>
  <FormField label="Secret" for={secretId}>
    <TextField id={secretId} kind="password" value={secret} readonly />
  </FormField>
</Dialog>

<style>
  .note {
    margin: 0;
  }
</style>
