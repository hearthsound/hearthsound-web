<!--
  The now-playing view (l05, p20-r4, p19-r1, p20b).

  A full-window overlay on the view background, opened from the player bar's
  cover and title, the phone mini player, the sidebar's Queue row or the
  player's queue toggle. It is not a route. The flat chevron at the top left
  and Escape close it, and focus returns to the control that opened it.

  Desktop puts the cover, title, feedback, seek and transport in one centred
  column beside the queue panel; phones stack the same parts in one scroll.
  The server has no lyrics source yet (A5), so the Lyrics | Queue switch is
  absent and the right column shows the queue, exactly as the no-lyrics case
  asks (p19 C, p19-r1); a lyrics value brings the switch and the lyrics panel
  with it.

  A track being fetched shows its k10 pill beside the title and the spinner in
  the play disc; a failed fetch becomes a retry disc, and the Failed pill's
  tooltip carries the reason as a sentence (p19b, o07).
-->
<script lang="ts">
  import { onMount } from 'svelte';

  import CoverArt from '#lib/components/CoverArt.svelte';
  import LyricsPanel from '#lib/components/LyricsPanel.svelte';
  import QueuePanel from '#lib/components/QueuePanel.svelte';
  import { formatDuration } from '#lib/format';
  import { failureSentence } from '#lib/labels';
  import AddToPlaylist from '#lib/library/AddToPlaylist.svelte';
  import FeedbackControls from '#lib/library/FeedbackControls.svelte';
  import PlaylistDialog from '#lib/library/PlaylistDialog.svelte';
  import type { FeedbackEntity } from '#lib/library/feedback';
  import { navigate } from '#lib/navigation';
  import { albumHrefFromPath, artistHrefFromPath, openById, rememberTarget } from '#lib/paths';
  import { fetchView, playDisc } from '#lib/player/fetch';
  import type { Lyrics } from '#lib/player/lyrics.svelte';
  import { nowPlaying } from '#lib/player/now-playing.svelte';
  import { player } from '#lib/player/player.svelte';
  import { hasAcquisitionSource } from '#lib/player/source';
  import { session } from '#lib/stores/session.svelte';
  import { toasts } from '#lib/stores/toasts.svelte';
  import { libraryApi } from '#lib/subsonic/library';
  import type { Playlist } from '#lib/subsonic/types';
  import Button from '#lib/ui/Button.svelte';
  import Menu from '#lib/ui/Menu.svelte';
  import MenuItem from '#lib/ui/MenuItem.svelte';
  import MenuSeparator from '#lib/ui/MenuSeparator.svelte';
  import Pill from '#lib/ui/Pill.svelte';
  import PlayButton from '#lib/ui/PlayButton.svelte';
  import Segmented from '#lib/ui/Segmented.svelte';
  import type { Segment } from '#lib/ui/Segmented.svelte';
  import Slider from '#lib/ui/Slider.svelte';
  import Transport from '#lib/ui/Transport.svelte';
  import { tooltip } from '#lib/ui/tooltip.svelte';

  /** Everything Tab may land on inside the overlay. */
  const FOCUSABLE =
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

  /** The two tabs of the right panel (p20-r4). */
  const LYRICS_QUEUE: Segment[] = [
    { value: 'lyrics', label: 'Lyrics' },
    { value: 'queue', label: 'Queue' }
  ];

  let root: HTMLDivElement | undefined = $state();
  let creating = $state(false);
  /**
   * The current song's lyrics, or `null` when there are none.
   *
   * No server source provides lyrics yet (A5); the panel renders a value here
   * when one arrives, and the queue is what shows until then.
   */
  const lyrics = $state<Lyrics | null>(null);
  /** Which tab of the right panel shows. */
  let view = $state('lyrics');
  const current = $derived(player.queue.current);
  /** The album's page path, when the queue item's answer carried one. */
  const albumRoute = $derived(albumHrefFromPath(current?.albumPath ?? ''));
  /** The artist's page path, when the queue item's answer carried one. */
  const artistRoute = $derived(artistHrefFromPath(current?.artistPath ?? ''));
  const titleId = $props.id();
  const fetchState = $derived(
    fetchView(
      player.fetchProgress,
      player.failureReason,
      player.streamFailure,
      hasAcquisitionSource(session.systemInfo)
    )
  );
  const disc = $derived(playDisc(fetchState, player.playing));
  const reason = $derived(
    failureSentence(player.failureReason, { playFailed: player.streamFailure })
  );
  const entity = $derived<FeedbackEntity>({
    id: current?.id ?? '',
    liked: current?.liked === true,
    disliked: current?.disliked === true,
    rating: current?.rating ?? 0
  });
  const duration = $derived(player.durationSecs > 0 ? player.durationSecs : 0);
  const position = $derived(
    duration > 0 ? Math.min(player.positionSecs, duration) : player.positionSecs
  );
  const positionMs = $derived(Math.round(position * 1000));

  // The view has nothing to show once the queue empties, so it goes away with
  // the last track (p19-r1 audit).
  $effect(() => {
    if (current === null) {
      nowPlaying.close();
    }
  });

  onMount(() => {
    root?.querySelector<HTMLButtonElement>('.hs-now-playing__close')?.focus();
    return () => {
      const opener = nowPlaying.opener;
      if (opener !== null && opener.isConnected) {
        opener.focus();
      }
    };
  });

  /** Plays, pauses, or asks again for a track whose fetch or stream failed (p19b). */
  function play(): void {
    if (fetchState.failed) {
      player.retry();
      return;
    }
    player.toggle();
  }

  /**
   * Closes the view and opens a song's album or artist page.
   *
   * @param route The route to open.
   */
  function leave(route: string): void {
    nowPlaying.close();
    void navigate(route);
  }

  /**
   * Creates a playlist from the song menu and adds the track to it.
   *
   * @param playlist The playlist just created.
   */
  async function addToNewPlaylist(playlist: Playlist): Promise<void> {
    creating = false;
    if (current === null) {
      return;
    }
    try {
      await libraryApi.updatePlaylist(playlist.id, { add: [current.id] });
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

  /**
   * Closes the view on Escape and keeps Tab inside it.
   *
   * An open dialog owns both keys itself, so the overlay leaves them to it.
   *
   * @param event The key press.
   */
  function onKeydown(event: KeyboardEvent): void {
    if (event.defaultPrevented || document.querySelector('.hs-dialog') !== null) {
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      nowPlaying.close();
      return;
    }
    if (event.key !== 'Tab' || root === undefined) {
      return;
    }
    const items = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
      (element) => element.getClientRects().length > 0
    );
    const first = items[0];
    const last = items[items.length - 1];
    if (first === undefined || last === undefined) {
      event.preventDefault();
      root.querySelector<HTMLButtonElement>('.hs-now-playing__close')?.focus();
      return;
    }
    const active = document.activeElement;
    const outside = !(active instanceof Node) || !root.contains(active);
    if (event.shiftKey && (outside || active === first)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (outside || active === last)) {
      event.preventDefault();
      first.focus();
    }
  }
</script>

<svelte:window onkeydown={onKeydown} />

<div
  class="hs-now-playing"
  role="dialog"
  aria-modal="true"
  aria-labelledby={titleId}
  bind:this={root}
>
  <Button
    class="hs-now-playing__close"
    variant="flat"
    shape="icon"
    icon="adwaita-expand"
    label="Close"
    onclick={() => nowPlaying.close()}
  />

  {#if current !== null}
    <div class="hs-now-playing__left">
      <span class="hs-now-playing__cover">
        <CoverArt coverArt={current.coverArt} icon="adwaita-song" size={600} />
      </span>

      <div class="hs-now-playing__details">
        <div class="now-playing__title-row">
          <h1 id={titleId} class="hs-now-playing__title">{current.title}</h1>
          {#if fetchState.pill !== null && fetchState.failed}
            <span
              class="now-playing__status"
              role="status"
              {@attach tooltip(() => reason, { tap: true })}
            >
              <Pill
                tone={fetchState.pill.tone}
                glyph={fetchState.pill.glyph}
                label={fetchState.pill.label}
              />
            </span>
          {:else if fetchState.pill !== null}
            <span class="now-playing__status" role="status">
              <Pill
                tone={fetchState.pill.tone}
                glyph={fetchState.pill.glyph}
                label={fetchState.pill.label}
              />
            </span>
          {/if}
        </div>
        {#if current.artist !== null && current.artist !== undefined && current.artist !== ''}
          <p class="hs-now-playing__artist">{current.artist}</p>
        {/if}
      </div>

      <div class="hs-now-playing__actions">
        <FeedbackControls {entity} />
        <Menu label="More Actions" align="end" panelClass="hs-song-menu hs-song-menu--now-playing">
          <div class="hs-song-menu__rating-line">
            <span>Rating</span>
            <FeedbackControls {entity} variant="stars" menuItem />
          </div>
          <MenuSeparator />
          <AddToPlaylist songId={current.id} onnew={() => (creating = true)} />
          <MenuItem
            label="Go to Album"
            icon="adwaita-album"
            disabled={albumRoute === undefined && (current.albumId ?? '') === ''}
            onselect={() => {
              if (albumRoute !== undefined) {
                rememberTarget(albumRoute, current.albumId ?? '');
                leave(albumRoute);
              } else if ((current.albumId ?? '') !== '') {
                void openById(current.albumId ?? '', leave);
              }
            }}
          />
          <MenuItem
            label="Go to Artist"
            icon="adwaita-artist"
            disabled={artistRoute === undefined && (current.artistId ?? '') === ''}
            onselect={() => {
              if (artistRoute !== undefined) {
                rememberTarget(artistRoute, current.artistId ?? '');
                leave(artistRoute);
              } else if ((current.artistId ?? '') !== '') {
                void openById(current.artistId ?? '', leave);
              }
            }}
          />
        </Menu>
      </div>

      <div class="hs-now-playing__seek">
        <span>{formatDuration(position)}</span>
        <Slider
          kind="seek"
          label="Seek"
          value={position}
          max={duration}
          disabled={fetchState.fetching}
          valuetext="{formatDuration(position)} of {formatDuration(duration)}"
          onchange={(seconds) => player.seek(seconds)}
        />
        <span>{formatDuration(duration)}</span>
      </div>

      <Transport large class="hs-now-playing__transport">
        <Button
          variant="flat"
          shape="circular"
          icon="adwaita-shuffle"
          label={player.shuffle ? 'Shuffle On' : 'Shuffle Off'}
          pressed={player.shuffle}
          onclick={() => player.toggleShuffle()}
        />
        <Button
          variant="flat"
          shape="circular"
          icon="adwaita-previous"
          label="Previous"
          onclick={() => player.previous()}
        />
        <PlayButton state={disc} large onclick={play} />
        <Button
          variant="flat"
          shape="circular"
          icon="adwaita-next"
          label="Next"
          onclick={() => player.next()}
        />
        <Button
          variant="flat"
          shape="circular"
          icon={player.repeat === 'song' ? 'adwaita-repeat-song' : 'adwaita-repeat'}
          label={player.repeat === 'song'
            ? 'Repeat Song'
            : player.repeat === 'all'
              ? 'Repeat All'
              : 'Repeat Off'}
          pressed={player.repeat !== 'off'}
          onclick={() => player.cycleRepeat()}
        />
      </Transport>
    </div>

    <div class="hs-now-playing__right">
      {#if lyrics !== null}
        <div class="hs-now-playing__switch">
          <Segmented label="Lyrics or queue" segments={LYRICS_QUEUE} bind:value={view} flush />
        </div>
      {/if}
      {#if lyrics !== null && view === 'lyrics'}
        <LyricsPanel {lyrics} {positionMs} />
      {:else}
        <QueuePanel />
      {/if}
    </div>
  {/if}

  {#if creating}
    <PlaylistDialog
      created={(playlist) => void addToNewPlaylist(playlist)}
      close={() => (creating = false)}
    />
  {/if}
</div>

<style>
  /* Layout glue only: the panel cannot know where the fetch pill sits beside
     the title. */
  .now-playing__title-row {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }

  .now-playing__status {
    flex: none;
  }
</style>
