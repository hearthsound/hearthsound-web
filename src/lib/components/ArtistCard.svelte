<!--
  An artist card.

  The card carries the availability the server reports for the artist, which is
  an aggregation over the tracks the artist is credited on, and links to the
  artist's page.
-->
<script lang="ts">
  import { resolve } from '$app/paths';

  import CoverArt from '#lib/components/CoverArt.svelte';
  import { availabilityLabel } from '#lib/labels';
  import { clientRoute } from '#lib/navigation';
  import { availability } from '#lib/stores/availability.svelte';
  import type { ArtistID3 } from '#lib/subsonic/types';

  /** Props of an artist card. */
  interface Props {
    /** The artist to show. */
    artist: ArtistID3;
  }

  let { artist }: Props = $props();

  const state = $derived(availability.of(artist));
</script>

<article class="artist-card">
  <a class="artist-link" href={resolve(clientRoute(`/artist/${artist.id}`))}>
    <CoverArt coverArt={artist.coverArt} size={120} alt="" />
    <p class="artist-name">{artist.name}</p>
  </a>
  {#if artist.albumCount !== undefined}
    <p class="artist-albums">{artist.albumCount} albums</p>
  {/if}
  {#if state !== null}
    <p class="artist-badge">{availabilityLabel(state)}</p>
  {/if}
</article>

<style>
  .artist-card {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    width: 8rem;
  }

  .artist-link {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    color: var(--color-fg);
    text-decoration: none;
  }

  .artist-link:hover .artist-name {
    color: var(--color-accent);
  }

  .artist-name,
  .artist-albums,
  .artist-badge {
    margin: 0;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .artist-albums,
  .artist-badge {
    color: var(--color-fg-muted);
    font-size: 0.875rem;
  }
</style>
