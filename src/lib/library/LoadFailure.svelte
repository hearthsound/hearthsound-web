<!--
  The o03 status page a library list shows when a read fails.

  The page headline stays in the header, so the failure is the list's own
  status page at the second level: the server did not answer, and Retry reads
  the same page again.
-->
<script lang="ts">
  import Button from '#lib/ui/Button.svelte';
  import StatusPage from '#lib/ui/StatusPage.svelte';

  /** Props of the failure status page. */
  interface Props {
    /** Reads the page again. */
    retry: () => void;
  }

  let { retry }: Props = $props();
</script>

{#snippet retryAction()}
  <Button onclick={retry}>Retry</Button>
{/snippet}

<StatusPage
  level={2}
  alert
  icon="adwaita-error"
  title="Could Not Load This Page"
  text="The server did not answer. Try again in a moment."
  action={retryAction}
/>
