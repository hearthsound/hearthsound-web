<!--
  An album card.

  The card carries the availability the server reports for the album, which is
  an aggregation over its tracks, and links to the album's page.
-->
<script lang="ts">
  import CoverArt from '#lib/components/CoverArt.svelte';
  import { availabilityLabel } from '#lib/labels';
  import { clientRoute } from '#lib/navigation';
  import { availability } from '#lib/stores/availability.svelte';
  import type { AlbumID3 } from '#lib/subsonic/types';
  import { resolve } from '$app/paths';

  /** Props of an album card. */
  interface Props {
    /** The album to show. */
    album: AlbumID3;
  }

  let { album }: Props = $props();

  const state = $derived(availability.of(album));
</script>

<article class="album-card">
  <a class="album-link" href={resolve(clientRoute(`/album/${album.id}`))}>
    <CoverArt coverArt={album.coverArt} size={160} alt="" />
    <p class="album-name">{album.name}</p>
  </a>
  <p class="album-artist">{album.artist ?? ''}</p>
  {#if state !== null}
    <p class="album-badge">{availabilityLabel(state)}</p>
  {/if}
</article>

<style>
  .album-card {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    width: 10rem;
  }

  .album-link {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    color: var(--color-fg);
    text-decoration: none;
  }

  .album-link:hover .album-name {
    color: var(--color-accent);
  }

  .album-name,
  .album-artist,
  .album-badge {
    margin: 0;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .album-artist,
  .album-badge {
    color: var(--color-fg-muted);
    font-size: 0.875rem;
  }
</style>
