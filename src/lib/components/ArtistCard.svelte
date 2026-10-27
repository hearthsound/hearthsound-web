<!--
  An artist card (k14 B).

  An album card with a round portrait, a centred name and no second line. The
  card link opens the artist's page by id. The play disc sits 4 px inside the
  picture and queues the artist's songs through the server's collection.
  Reading the same fields of either API lets the native `ArtistSummary` and the
  Subsonic `ArtistID3` both feed the card.

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
  import Icon from '#lib/ui/Icon.svelte';

  /** The artist fields a card reads, from either API. */
  export interface ArtistCardSource {
    /** The artist's client id. */
    id: string;
    /** The display name. */
    name: string;
    /** The cover id, when the answer names one. */
    coverArt?: string;
    /** Whether the server holds a portrait, as the native API reports it. */
    hasImage?: boolean;
    /** How many albums the artist is credited on. */
    albumCount?: number;
    /** Whether the caller's personal library holds the artist. */
    inLibrary?: boolean;
  }

  /** Props of an artist card. */
  interface Props {
    /** The artist to show. */
    artist: ArtistCardSource;
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
   * The album count to draw, or `0` when the server did not report one.
   *
   * An absent count means the server does not know it, which is not the same as
   * an artist with no albums, so a zero draws nothing either.
   */
  const albumCount = $derived(showAlbumCount ? (artist.albumCount ?? 0) : 0);

  /** The cover id to ask for; the artist's own id serves its stored portrait. */
  const cover = $derived(artist.coverArt ?? (artist.hasImage === false ? undefined : artist.id));

  /** Queues the artist's songs and starts at the head. */
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
  <a class="hs-card__link" href={routeHref(artistHref(artist.id))}>
    <span class="hs-visually-hidden">{artist.name}{inLibrary ? ', in your library' : ''}</span>
  </a>
  <span class="hs-card__cover">
    <CoverArt coverArt={cover} icon="adwaita-artist" />
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
