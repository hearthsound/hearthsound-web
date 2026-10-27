<!--
  An album card (k13 C).

  A bare tile at rest, a control-tone tile on hover and press, the cover's
  play disc on hover or focus, the name over the artist. The card link covers
  the tile and opens the album's page by id. The play disc is a separate target
  after it and queues the album's tracks when it is pressed.

  The card takes either answer that names an album: the native `AlbumSummary`
  and the Subsonic `AlbumID3` both carry the id, the title and the cover, so
  the card reads the fields they share instead of one API's type.
-->
<script lang="ts">
  import CoverArt from '#lib/components/CoverArt.svelte';
  import { loadAlbumQueue } from '#lib/library/album-queue';
  import { membership } from '#lib/library/membership.svelte';
  import { routeHref } from '#lib/navigation';
  import { albumHref } from '#lib/paths';
  import { player } from '#lib/player/player.svelte';
  import { toasts } from '#lib/stores/toasts.svelte';
  import Icon from '#lib/ui/Icon.svelte';

  /** The album fields a card reads, from either API. */
  export interface AlbumCardSource {
    /** The album's client id. */
    id: string;
    /** The title, as a native answer spells it. */
    title?: string;
    /** The title, as a Subsonic answer spells it. */
    name?: string;
    /** The display artist. */
    artist?: string | null;
    /** The display artist, as a native answer spells it. */
    displayArtist?: string | null;
    /** The cover id, when the answer names one. */
    coverArt?: string;
    /** Whether the server holds a cover, as the native API reports it. */
    hasImage?: boolean;
    /** Whether the caller's personal library holds the album. */
    inLibrary?: boolean;
    /** The album artist's client id. */
    artistId?: string | null;
    /** The release year. */
    year?: number | null;
  }

  /** Props of an album card. */
  interface Props {
    /** The album to show. */
    album: AlbumCardSource;
    /**
     * The name on the card; the album's own name when not given. A grid that can
     * hold two releases of one name passes the disambiguated name.
     */
    title?: string;
    /**
     * The second line; the album's artist when not given. The artist page shows
     * the release year instead (p16-r1).
     */
    subtitle?: string;
    /**
     * Whether the card marks the albums the caller's library holds. Only a
     * listing that can hold both marks them: the library's own shelves hold
     * nothing else, so they pass nothing.
     */
    libraryMark?: boolean;
  }

  let { album, title, subtitle, libraryMark = false }: Props = $props();

  /** The name the card draws. */
  const name = $derived(title ?? album.title ?? album.name ?? '');

  /** The artist the card names under the album. */
  const artist = $derived(album.displayArtist ?? album.artist ?? undefined);

  /** Whether this album is in the caller's library. */
  const inLibrary = $derived(libraryMark && membership.isInLibrary(album));

  /** The cover id to ask for; the album's own id serves its stored cover. */
  const cover = $derived(album.coverArt ?? (album.hasImage === false ? undefined : album.id));

  /** Queues the whole album and starts at its first track. */
  async function playAlbum(): Promise<void> {
    try {
      const collection = await loadAlbumQueue(album.id);
      if (collection !== null && collection.items.length > 0) {
        player.play(collection.items, collection.startIndex);
      }
    } catch (error) {
      toasts.push(
        error instanceof Error && error.message !== ''
          ? `Could not play this album: ${error.message}`
          : 'Could not play this album.',
        'error'
      );
    }
  }
</script>

<div class="hs-card hs-card--album">
  <a class="hs-card__link" href={routeHref(albumHref(album.id))}>
    <span class="hs-visually-hidden"
      >{name}{subtitle === undefined
        ? artist === undefined
          ? ''
          : `, ${artist}`
        : subtitle === ''
          ? ''
          : `, ${subtitle}`}{inLibrary ? ', in your library' : ''}</span
    >
  </a>
  <span class="hs-card__cover">
    <CoverArt coverArt={cover} icon="adwaita-album" />
    {#if inLibrary}
      <span class="hs-card__library-mark" role="img" aria-label="In your library">
        <Icon name="adwaita-check" />
      </span>
    {/if}
    <button
      class="hs-play-button hs-card__play"
      type="button"
      aria-label="Play {name}"
      onclick={() => void playAlbum()}
    >
      <Icon name="adwaita-play" />
    </button>
  </span>
  <span class="hs-card__text">
    <span class="hs-card__title">{name}</span>
    {#if subtitle !== undefined ? subtitle !== '' : artist !== undefined}
      <span class="hs-card__artist">{subtitle ?? artist}</span>
    {/if}
  </span>
</div>
