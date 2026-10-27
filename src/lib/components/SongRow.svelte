<!--
  A song row (k12-r1, k12-ctx, p21-r2, k17-r3).

  List context leads with the song's 40 px cover and keeps an album column;
  album context leads with the track number and drops the album. The cover or
  number is the row's play target. The current row carries the equaliser and a
  heavier title. Actions keep a fixed width: at rest only the liked or disliked
  glyph shows in the menu's spot, on hover or focus the like, dislike and menu
  buttons appear in their own spots, and on phones the menu is always visible
  with the glyph beside it.

  The song menu carries the opinion controls, the add-to-playlist submenu and
  the page links. A caller that may change the list passes `remove`; the row
  then offers "Remove from Playlist" in the same menu.

  The second line names the song's artist as a link to that artist's page, so
  the reader reaches the artist from any list the song appears in. The row reads
  the fields the native summary and the Subsonic child share.
-->
<script lang="ts">
  import CoverArt from '#lib/components/CoverArt.svelte';
  import { formatDuration } from '#lib/format';
  import AddToPlaylist from '#lib/library/AddToPlaylist.svelte';
  import FeedbackControls from '#lib/library/FeedbackControls.svelte';
  import PlaylistDialog from '#lib/library/PlaylistDialog.svelte';
  import { feedback } from '#lib/library/feedback.svelte';
  import { reportedFeedback } from '#lib/library/feedback';
  import { membership } from '#lib/library/membership.svelte';
  import { songTitle } from '#lib/library/song';
  import type { Song } from '#lib/library/song';
  import { navigate, routeHref } from '#lib/navigation';
  import { albumHref, artistHref } from '#lib/paths';
  import { player } from '#lib/player/player.svelte';
  import { toasts } from '#lib/stores/toasts.svelte';
  import { libraryApi } from '#lib/subsonic/library';
  import type { Playlist } from '#lib/subsonic/types';
  import Icon from '#lib/ui/Icon.svelte';
  import Menu from '#lib/ui/Menu.svelte';
  import MenuItem from '#lib/ui/MenuItem.svelte';
  import MenuSeparator from '#lib/ui/MenuSeparator.svelte';

  /** Props of a song row. */
  interface Props {
    /** The track to show. */
    song: Song;
    /**
     * Called when the track is played.
     *
     * @param song The track to play.
     */
    play: (song: Song) => void;
    /**
     * Called when the track is removed from the list that shows it, which only
     * a list the caller may change offers.
     *
     * @param song The track to remove.
     */
    remove?: (song: Song) => void;
    /** Which column set the row draws; a library list when not given. */
    context?: 'list' | 'album' | 'no-album';
    /**
     * The second line of the title cell; the artist when not given. The
     * artist's Top Songs list shows the album there instead (p16-r1).
     */
    second?: 'artist' | 'album';
    /** The track's number in album context. */
    number?: number;
    /**
     * Whether the row marks the tracks the caller's library holds. Only a
     * listing that can hold both marks them: the library's own lists hold
     * nothing else, so they pass nothing.
     */
    libraryMark?: boolean;
  }

  let {
    song,
    play,
    remove,
    context = 'list',
    second = 'artist',
    number,
    libraryMark = false
  }: Props = $props();

  const entity = $derived(reportedFeedback(song));
  const opinion = $derived(feedback.stateFor(entity));
  /** Whether the track is in the caller's library, or liked, which saves it. */
  const inLibrary = $derived(libraryMark && (membership.isInLibrary(song) || opinion.liked));
  const current = $derived(player.queue.current?.id === song.id);
  const glyph = $derived(
    opinion.liked ? 'adwaita-like' : opinion.disliked ? 'custom-dislike' : null
  );
  const title = $derived(songTitle(song));
  const duration = $derived(formatDuration(song.duration));
  const rowName = $derived(
    [title, song.artist ?? '', duration].filter((part) => part !== '').join(', ')
  );
  /** The song's album page, when the answer names its album. */
  const albumPage = $derived(
    song.albumId === undefined || song.albumId === '' ? undefined : albumHref(song.albumId)
  );
  /** The song's artist page, when the answer names its artist. */
  const artistPage = $derived(
    song.artistId === undefined || song.artistId === '' ? undefined : artistHref(song.artistId)
  );

  let creating = $state(false);

  /**
   * Creates a playlist from the song menu and adds the track to it.
   *
   * @param playlist The playlist just created.
   */
  async function addToNewPlaylist(playlist: Playlist): Promise<void> {
    creating = false;
    try {
      await libraryApi.updatePlaylist(playlist.id, { add: [song.id] });
      toasts.push(`Added to ${playlist.name}.`);
    } catch (error) {
      toasts.push(
        error instanceof Error && error.message !== ''
          ? `Could not add it to ${playlist.name}: ${error.message}`
          : `Could not add it to ${playlist.name}.`,
        'error'
      );
    }
  }
</script>

<li
  class="hs-track-row {context === 'list' ? '' : `hs-track-row--${context}`}"
  class:hs-track-row--current={current}
  aria-current={current ? 'true' : undefined}
>
  <!-- One button covers the whole row, so a press anywhere in it plays the track;
       the actions above it take their own presses (row-click). -->
  <button class="hs-track-row__open" type="button" aria-label={rowName} onclick={() => play(song)}
  ></button>
  <span class="hs-track-row__lead">
    {#if context === 'album'}
      {#if current}
        <span class="hs-eq" class:hs-eq--paused={!player.playing}>
          <i></i><i></i><i></i>
        </span>
      {:else}
        <span class="hs-track-row__number">{number ?? ''}</span>
        <span class="hs-track-row__overlay"><Icon name="adwaita-play" /></span>
      {/if}
    {:else}
      <CoverArt class="hs-track-row__art" coverArt={song.coverArt} icon="adwaita-song" size={96} />
      <span class="hs-track-row__overlay">
        {#if current}
          <span class="hs-eq" class:hs-eq--paused={!player.playing}>
            <i></i><i></i><i></i>
          </span>
        {:else}
          <Icon name="adwaita-play" />
        {/if}
      </span>
    {/if}
  </span>

  <span class="hs-track-row__text">
    <span class="hs-track-row__title-line">
      <span class="hs-track-row__title">{title}</span>
      {#if inLibrary}
        <span
          class="hs-library-mark"
          role="img"
          aria-label="In your library"
          title="In your library"
        >
          <Icon name="adwaita-check" />
        </span>
      {/if}
    </span>
    <span class="hs-track-row__artist">
      {#if second === 'album'}
        {song.album ?? ''}
      {:else if artistPage !== undefined}
        <a class="hs-track-row__link" href={routeHref(artistPage)}>{song.artist ?? ''}</a>
      {:else}
        {song.artist ?? ''}
      {/if}
    </span>
  </span>

  <span class="hs-track-row__album">{song.album ?? ''}</span>
  <span class="hs-track-row__status"></span>

  <span class="hs-track-row__actions">
    {#if glyph !== null}
      <span class="hs-feedback-glyph"><Icon name={glyph} /></span>
    {/if}
    <FeedbackControls {entity} />
    <Menu label="More Actions" align="end" panelClass="hs-song-menu">
      <div class="hs-song-menu__feedback-line">
        <FeedbackControls {entity} menuItem />
        <FeedbackControls {entity} variant="stars" menuItem />
      </div>
      <MenuSeparator />
      <AddToPlaylist songId={song.id} onnew={() => (creating = true)} />
      <MenuItem
        label="Go to Album"
        icon="adwaita-album"
        disabled={albumPage === undefined}
        onselect={() => {
          if (albumPage !== undefined) {
            void navigate(albumPage);
          }
        }}
      />
      <MenuItem
        label="Go to Artist"
        icon="adwaita-artist"
        disabled={artistPage === undefined}
        onselect={() => {
          if (artistPage !== undefined) {
            void navigate(artistPage);
          }
        }}
      />
      {#if remove !== undefined}
        <MenuSeparator />
        <MenuItem
          label="Remove from Playlist"
          icon="adwaita-delete"
          onselect={() => remove(song)}
        />
      {/if}
    </Menu>
  </span>

  <span class="hs-track-row__duration">{duration}</span>

  {#if creating}
    <PlaylistDialog
      created={(playlist) => void addToNewPlaylist(playlist)}
      close={() => (creating = false)}
    />
  {/if}
</li>

<style>
  /* The activation button covers the row's whole surface, so a press anywhere
     in the row plays the track (row-click). It stays under the cells; the cells
     that carry no press of their own let the press through to it, which is why
     the text and the artwork used to swallow it. */
  .hs-track-row__open {
    position: absolute;
    inset: 0;
    z-index: 0;
    margin: 0;
    padding: 0;
    border: 0;
    background: none;
    cursor: pointer;
  }

  .hs-track-row__lead,
  .hs-track-row__text,
  .hs-track-row__album,
  .hs-track-row__status,
  .hs-track-row__duration {
    pointer-events: none;
  }

  /* Positioned but without a stacking context: they paint above the covering
     button by DOM order, and the song menu inside the actions keeps its own
     z-index against the row's other children (a z-index here traps it below
     the next row's actions). */
  .hs-track-row__actions {
    position: relative;
  }

  /* Phones hide the album, status and duration cells, but the package's list
     still declares their trailing column: the actions would be placed one
     column gap short of the row's end. They take the last column instead, so
     the menu hugs the end as the phone design asks. Package gap:
     commit5b-package-gaps.md. */
  @media (max-width: 720px) {
    .hs-track-row__actions {
      grid-column: -2 / -1;
      justify-content: flex-end;
    }
  }
</style>
