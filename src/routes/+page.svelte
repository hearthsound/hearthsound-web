<!--
  The landing page (l13).

  `/` renders Home rather than redirecting to `/library/albums`; the shell's
  boot sequence still sends a browser without a session to the sign-in form
  first.
-->
<script lang="ts">
  import HomeView from '#lib/home/HomeView.svelte';
</script>

<HomeView />
