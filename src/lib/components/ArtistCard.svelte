<!--
  An artist card (k14 B).

  An album card with a round portrait, a centred name and no second line. The
  card link opens the artist's readable path and carries the artist's id, so the
  page it opens reads the artist without resolving the path again. The play disc
  sits 4 px inside the picture and queues the artist's songs: their albums are
  read first because the artist answer carries albums, not tracks.

  A listing that can hold both library members and catalog names passes
  `libraryMark`, which draws the check on the portrait and adds "in your
  library" to the link's hidden label. The same listing passes
  `showAlbumCount`, which adds the artist's album count as the card's second
  line: a catalog artist's count is part of what the online service answered,
  and an absent or zero count means "unknown", so nothing is drawn for it.
-->
<script lang="ts">
  import CoverArt from '#lib/components/CoverArt.svelte';
  import { membership } from '#lib/library/membership.svelte';
  import { loadCollection } from '#lib/library/queue-source';
  import { routeHref } from '#lib/navigation';
  import { artistHref } from '#lib/paths';
  import { player } from '#lib/player/player.svelte';
  import { toasts } from '#lib/stores/toasts.svelte';
  import type { ArtistID3 } from '#lib/subsonic/types';
  import Icon from '#lib/ui/Icon.svelte';

  /** Props of an artist card. */
  interface Props {
    /** The artist to show. */
    artist: ArtistID3;
    /**
     * Whether the card marks the artists the caller's library holds. Only a
     * listing that can hold both marks them: the library's own shelves hold
     * nothing else, so they pass nothing.
     */
    libraryMark?: boolean;
    /**
     * Whether the card draws the artist's album count. Only a listing of
     * catalog artists passes it: a library artist's shelf already says how
     * many albums it holds, and the count there is the library's own.
     */
    showAlbumCount?: boolean;
  }

  let { artist, libraryMark = false, showAlbumCount = false }: Props = $props();

  /** Whether this artist is in the caller's library. */
  const inLibrary = $derived(libraryMark && membership.isInLibrary(artist));

  /**
   * The album count to draw, or `null` when the server did not report one.
   *
   * An absent count means the server does not know it, which is not the same as
   * an artist with no albums, so a zero draws nothing either.
   */
  const albumCount = $derived(showAlbumCount ? (artist.albumCount ?? 0) : 0);

  /** Queues the artist's Top Songs first, then the rest, and starts at the head. */
  async function playArtist(): Promise<void> {
    try {
      const collection = await loadCollection(`artist:${artist.id}`);
      if (collection !== null && collection.items.length > 0) {
        player.play(collection.items, collection.startIndex);
      }
    } catch (error) {
      toasts.push(
        error instanceof Error && error.message !== ''
          ? `Could not play this artist: ${error.message}`
          : 'Could not play this artist.',
        'error'
      );
    }
  }
</script>

<div class="hs-card hs-card--artist">
  <a class="hs-card__link" href={routeHref(artistHref(artist))} data-entity-id={artist.id}>
    <span class="hs-visually-hidden">{artist.name}{inLibrary ? ', in your library' : ''}</span>
  </a>
  <span class="hs-card__cover">
    <CoverArt coverArt={artist.coverArt} icon="adwaita-artist" />
    {#if inLibrary}
      <span class="hs-card__library-mark" role="img" aria-label="In your library">
        <Icon name="adwaita-check" />
      </span>
    {/if}
    <button
      class="hs-play-button hs-card__play"
      type="button"
      aria-label="Play {artist.name}"
      onclick={() => void playArtist()}
    >
      <Icon name="adwaita-play" />
    </button>
  </span>
  <span class="hs-card__text">
    <span class="hs-card__title">{artist.name}</span>
    {#if albumCount > 0}
      <span class="album-count">{albumCount} {albumCount === 1 ? 'album' : 'albums'}</span>
    {/if}
  </span>
</div>

<style>
  /* The muted second line the album card draws, in this card's own tokens: the
     design package names no class for an artist's album count. */
  .album-count {
    color: var(--hs-fg-muted);
    font-size: 12px;
  }
</style>
