<!--
  The connected services of the account (the account area).

  The route at `/account/services`, opened from the account menu. The page's
  own view draws the services; this file hands it the query string so a browser
  link's return can be reported.
-->
<script lang="ts">
  import { page } from '$app/state';

  import ServicesView from '#lib/account/ServicesView.svelte';

  const search = $derived(page.url.search);
</script>

<ServicesView {search} />
