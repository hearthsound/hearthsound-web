<!--
  An artist.

  The page shows the artist's name, its availability badge, the control that
  saves it to the personal library, and the albums attributed to it.
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import { page } from '$app/state';

  import AlbumCard from '#lib/components/AlbumCard.svelte';
  import CoverArt from '#lib/components/CoverArt.svelte';
  import { availabilityLabel } from '#lib/labels';
  import FeedbackControls from '#lib/library/FeedbackControls.svelte';
  import { reportedFeedback } from '#lib/library/feedback';
  import { membership } from '#lib/library/membership.svelte';
  import SaveButton from '#lib/library/SaveButton.svelte';
  import { availability } from '#lib/stores/availability.svelte';
  import { libraryApi } from '#lib/subsonic/library';
  import type { ArtistWithAlbums } from '#lib/subsonic/types';
  import Menu from '#lib/ui/Menu.svelte';

  const id = $derived(page.params.id ?? '');

  let artist = $state<ArtistWithAlbums | null>(null);
  let failure = $state<string | null>(null);
  let loading = $state(true);

  let generation = 0;

  const artistState = $derived(artist === null ? null : availability.of(artist));
  const artistFeedback = $derived(artist === null ? null : reportedFeedback(artist));

  $effect(() => {
    const current = id;
    const mine = ++generation;
    untrack(() => void load(current, mine));
  });

  /**
   * Reads the artist and remembers what it and its albums report.
   *
   * @param current The artist's client id.
   * @param mine The generation of this read.
   */
  async function load(current: string, mine: number): Promise<void> {
    loading = true;
    failure = null;
    try {
      const answer = await libraryApi.artist(current);
      if (mine !== generation) {
        return;
      }
      artist = answer;
      if (answer !== null) {
        availability.remember([answer, ...(answer.album ?? [])]);
        membership.remember([answer]);
      }
    } catch (error) {
      if (mine === generation) {
        failure = error instanceof Error ? error.message : 'The artist could not be read.';
        artist = null;
      }
    } finally {
      if (mine === generation) {
        loading = false;
      }
    }
  }
</script>

<svelte:head>
  <title>{artist?.name ?? 'Artist'} - Hearthsound</title>
</svelte:head>

<section>
  {#if failure !== null}
    <p class="artist-failure" role="alert">{failure}</p>
  {:else if loading && artist === null}
    <p class="artist-hint">Loading...</p>
  {:else if artist === null}
    <p class="artist-hint">There is no such artist.</p>
  {:else}
    <header class="artist-header">
      <span class="hs-hero__art hs-hero__art--round">
        <CoverArt coverArt={artist.coverArt} icon="adwaita-artist" />
      </span>
      <div class="artist-details">
        <h1>{artist.name}</h1>
        {#if artist.albumCount !== undefined}
          <p class="artist-meta">{artist.albumCount} albums</p>
        {/if}
        {#if artistState !== null}
          <p class="artist-badge">{availabilityLabel(artistState)}</p>
        {/if}
        <div class="artist-actions">
          <Menu label="More Actions">
            <SaveButton entity={artist} />
          </Menu>
          {#if artistFeedback !== null}
            <FeedbackControls entity={artistFeedback} variant="like" />
          {/if}
        </div>
      </div>
    </header>

    <div class="hs-card-grid artist-albums">
      {#each artist.album ?? [] as album (album.id)}
        <AlbumCard {album} />
      {/each}
    </div>
  {/if}
</section>

<style>
  .artist-header {
    display: flex;
    gap: var(--space-4);
    align-items: flex-start;
    margin-bottom: var(--space-4);
  }

  .artist-details {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    align-items: flex-start;
  }

  .artist-details h1 {
    margin: 0;
  }

  .artist-actions {
    display: flex;
    gap: var(--space-2);
    align-items: center;
  }

  .artist-meta,
  .artist-badge,
  .artist-hint,
  .artist-failure {
    margin: 0;
    color: var(--color-fg-muted);
  }

  .artist-failure {
    color: var(--color-danger);
  }

  /* The l08 card grid sizes the package cards; the grid starts on the content
     line, so the album art lines up under the artist portrait. */
  .artist-albums {
    padding-bottom: var(--hs-space-6);
  }
</style>
