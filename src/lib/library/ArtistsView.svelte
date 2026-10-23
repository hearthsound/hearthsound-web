<!--
  The Artists library view (o04, E9).

  The artist index of the personal library, in the l08 card grid. The server
  answers the whole index in one call, so the grid is not paged. An empty
  library shows the p08e empty state with the upload action only for an
  account that may upload (o06).
-->
<script lang="ts">
  import { onMount } from 'svelte';

  import ArtistCard from '#lib/components/ArtistCard.svelte';
  import { firstPagePlaceholders } from '#lib/library/placeholders';
  import { KIND_TITLES } from '#lib/library/kinds';
  import LoadFailure from '#lib/library/LoadFailure.svelte';
  import { canUpload } from '#lib/nav';
  import { navContext } from '#lib/nav-context';
  import { navigate } from '#lib/navigation';
  import { getShellNavigation } from '#lib/shell-navigation';
  import { availability } from '#lib/stores/availability.svelte';
  import { libraryCounts } from '#lib/stores/library-counts.svelte';
  import { session } from '#lib/stores/session.svelte';
  import { LIBRARY_PAGE_SIZE, libraryApi, PERSONAL_FOLDER } from '#lib/subsonic/library';
  import type { ArtistID3 } from '#lib/subsonic/types';
  import Button from '#lib/ui/Button.svelte';
  import CardPlaceholders from '#lib/ui/CardPlaceholders.svelte';
  import PageHeader from '#lib/ui/PageHeader.svelte';
  import StatusPage from '#lib/ui/StatusPage.svelte';

  const shell = getShellNavigation();

  const title = KIND_TITLES.artists;

  let artists = $state<ArtistID3[]>([]);
  let loading = $state(true);
  let failure = $state<string | null>(null);

  /** The library's counts, which size the placeholders. */
  const counts = $derived(libraryCounts.counts);

  /** The grid, which the placeholders measure. */
  let artistGrid = $state<HTMLDivElement>();

  const mayUpload = $derived(canUpload(navContext(session)));

  onMount(() => {
    void libraryCounts.refresh();
    void load();
  });

  /** Reads the artist index of the personal library. */
  async function load(): Promise<void> {
    loading = true;
    failure = null;
    try {
      const answer = await libraryApi.artists(PERSONAL_FOLDER);
      artists = answer;
      availability.remember(answer);
    } catch (error) {
      failure = error instanceof Error ? error.message : 'The list could not be read.';
    } finally {
      loading = false;
    }
  }
</script>

<svelte:head>
  <title>{title} - Hearthsound</title>
</svelte:head>

{#snippet uploadAction()}
  <Button icon="custom-upload" onclick={() => void navigate('/library/uploads')}>
    Upload Songs
  </Button>
{/snippet}

<PageHeader {title} class="library-header" onnavigation={shell?.openNavigation} />

{#if failure !== null}
  <LoadFailure retry={() => void load()} />
{:else if loading}
  <div class="loading" aria-busy="true">
    <span class="hs-visually-hidden" role="status">Loading...</span>
    <div class="hs-card-grid cards" bind:this={artistGrid}>
      <CardPlaceholders
        count={firstPagePlaceholders(counts?.artists ?? null, LIBRARY_PAGE_SIZE)}
        artist
      />
    </div>
  </div>
{:else if artists.length === 0}
  <StatusPage
    level={2}
    icon="adwaita-artist"
    title="No Artists Yet"
    text="Artists with songs in your library show up here."
    action={mayUpload ? uploadAction : undefined}
  />
{:else}
  <div class="hs-card-grid cards">
    {#each artists as artist (artist.id)}
      <ArtistCard {artist} />
    {/each}
  </div>
{/if}

<style>
  .cards {
    padding: var(--hs-space-3) 0 var(--hs-space-7);
  }

  /* The loading state lays its placeholders in the loaded state's own grid and
     padding, so the title's gap and the scroll position do not move when the
     read finishes. */
  .loading {
    display: contents;
  }

  @media (max-width: 720px) {
    .cards {
      padding-bottom: var(--hs-space-6);
    }
  }
</style>
