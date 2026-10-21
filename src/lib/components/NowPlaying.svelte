<!--
  The now-playing view (l05, p20-r4, p19-r1, p20b).

  A full-window overlay on the view background, opened from the player bar's
  cover and title, the phone mini player, the sidebar's Queue row or the
  player's queue toggle. It is not a route. The flat chevron at the top left
  and Escape close it, and focus returns to the control that opened it.

  Desktop puts the cover, title, feedback, seek and transport in one centred
  column beside the queue panel; phones stack the same parts in one scroll.
  The server has no lyrics source, so the Lyrics | Queue switch is absent and
  the right column always shows the queue, exactly as the no-lyrics case asks
  (p19 C, p19-r1).

  A track being fetched shows its k10 pill beside the title and the spinner in
  the play disc; a failed fetch becomes a retry disc, and the Failed pill's
  tooltip carries the reason as a sentence (p19b, o07).
-->
<script lang="ts">
  import type { IconName } from '@hearthsound/design/icons';
  import { onMount } from 'svelte';

  import CoverArt from '#lib/components/CoverArt.svelte';
  import { formatDuration } from '#lib/format';
  import { failureSentence, prefetchLabel } from '#lib/labels';
  import AddToPlaylist from '#lib/library/AddToPlaylist.svelte';
  import FeedbackControls from '#lib/library/FeedbackControls.svelte';
  import PlaylistDialog from '#lib/library/PlaylistDialog.svelte';
  import type { FeedbackEntity } from '#lib/library/feedback';
  import { navigate } from '#lib/navigation';
  import { currentLineIndex, demoLyrics, versesOf } from '#lib/player/lyrics.svelte';
  import type { Lyrics } from '#lib/player/lyrics.svelte';
  import { nowPlaying } from '#lib/player/now-playing.svelte';
  import { player } from '#lib/player/player.svelte';
  import { toasts } from '#lib/stores/toasts.svelte';
  import { libraryApi } from '#lib/subsonic/library';
  import type { Playlist } from '#lib/subsonic/types';
  import Button from '#lib/ui/Button.svelte';
  import Icon from '#lib/ui/Icon.svelte';
  import Menu from '#lib/ui/Menu.svelte';
  import MenuItem from '#lib/ui/MenuItem.svelte';
  import MenuSeparator from '#lib/ui/MenuSeparator.svelte';
  import Pill from '#lib/ui/Pill.svelte';
  import type { PillTone } from '#lib/ui/Pill.svelte';
  import PlayButton from '#lib/ui/PlayButton.svelte';
  import type { PlayState } from '#lib/ui/PlayButton.svelte';
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

  /** One fetch state, as the k10 pill draws it. */
  interface FetchPill {
    /** The state colour. */
    tone: PillTone;
    /** The state glyph. */
    glyph: IconName;
    /** The visible label. */
    label: string;
  }

  let root: HTMLDivElement | undefined = $state();
  let panel: HTMLDivElement | undefined = $state();
  let creating = $state(false);
  /**
   * The current song's lyrics, or `null` when there are none.
   *
   * TEMPORARY: filled from `demoLyrics` with `?lyrics=synced` or
   * `?lyrics=unsynced` until a lyrics source exists (A5); with no source and
   * no parameter the switch is absent and the panel shows the queue.
   */
  let lyrics = $state<Lyrics | null>(null);
  /** Which tab of the right panel shows. */
  let view = $state('lyrics');
  const current = $derived(player.queue.current);
  const titleId = $props.id();
  const progress = $derived(player.progress);
  const lost = $derived(player.failureReason !== null && player.failureReason !== 'cancelled');
  const fetching = $derived(
    progress !== null && (progress === 'Searching sources' || progress.startsWith('Downloading'))
  );
  const disc = $derived<PlayState>(
    lost ? 'retry' : fetching ? 'fetching' : player.playing ? 'pause' : 'play'
  );
  const pill = $derived<FetchPill | null>(
    lost
      ? { tone: 'error', glyph: 'adwaita-error', label: 'Failed' }
      : progress === 'Searching sources'
        ? { tone: 'accent', glyph: 'adwaita-search', label: 'Searching sources' }
        : fetching
          ? { tone: 'accent', glyph: 'adwaita-acquire', label: progress ?? '' }
          : null
  );
  const reason = $derived(failureSentence(player.failureReason));
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

  const lineIndex = $derived(
    lyrics !== null && lyrics.synced ? currentLineIndex(lyrics, Math.round(position * 1000)) : -1
  );
  const verses = $derived(lyrics !== null && !lyrics.synced ? versesOf(lyrics) : []);

  /**
   * Puts the line that plays at the panel's vertical centre (p20-r4).
   *
   * Unsynced lyrics scroll by hand and never move themselves.
   */
  function centreLine(): void {
    if (panel === undefined || lyrics === null || !lyrics.synced || lineIndex < 0) {
      return;
    }
    const line = panel.querySelector<HTMLElement>('.hs-lyrics-line[aria-current="true"]');
    if (line === null) {
      return;
    }
    panel.scrollTop = line.offsetTop - panel.clientHeight / 2 + line.clientHeight / 2;
  }

  $effect(centreLine);

  // The panel changes height with the viewport (320 px on phones), and the
  // centred line must stay centred across that change.
  $effect(() => {
    if (panel === undefined) {
      return;
    }
    const observer = new ResizeObserver(() => centreLine());
    observer.observe(panel);
    return () => observer.disconnect();
  });

  // The view has nothing to show once the queue empties, so it goes away with
  // the last track (p19-r1 audit).
  $effect(() => {
    if (current === null) {
      nowPlaying.close();
    }
  });

  onMount(() => {
    lyrics = demoLyrics(new URL(window.location.href).searchParams.get('lyrics'));
    root?.querySelector<HTMLButtonElement>('.hs-now-playing__close')?.focus();
    return () => {
      const opener = nowPlaying.opener;
      if (opener !== null && opener.isConnected) {
        opener.focus();
      }
    };
  });

  /**
   * Builds the k10 pill of one upcoming queue row.
   *
   * @param label The prefetch label of the item.
   * @returns The state tone, glyph and label.
   */
  function queuePill(label: string): FetchPill {
    if (label === 'Ready') {
      return { tone: 'success', glyph: 'adwaita-check', label };
    }
    if (label.startsWith('Prefetching')) {
      return { tone: 'accent', glyph: 'adwaita-acquire', label };
    }
    if (label === 'Prefetch queued') {
      return { tone: 'neutral', glyph: 'adwaita-queue', label };
    }
    return { tone: 'neutral', glyph: 'adwaita-remove', label };
  }

  /**
   * Plays one row of the queue from the start.
   *
   * @param index The row's position in the queue.
   */
  function playRow(index: number): void {
    player.play(player.queue.items, index);
  }

  /** Plays, pauses, or asks again for a track whose fetch failed (p19b). */
  function play(): void {
    if (lost) {
      player.play(player.queue.items, player.queue.currentIndex);
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
        <CoverArt coverArt={current.coverArt} icon="adwaita-song" size={400} />
      </span>

      <div class="hs-now-playing__details">
        <div class="now-playing__title-row">
          <h1 id={titleId} class="hs-now-playing__title">{current.title}</h1>
          {#if pill !== null && lost}
            <span class="now-playing__status" role="status" {@attach tooltip(() => reason)}>
              <Pill tone={pill.tone} glyph={pill.glyph} label={pill.label} />
            </span>
          {:else if pill !== null}
            <span class="now-playing__status" role="status">
              <Pill tone={pill.tone} glyph={pill.glyph} label={pill.label} />
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
            <FeedbackControls {entity} variant="stars" />
          </div>
          <MenuSeparator />
          <AddToPlaylist songId={current.id} onnew={() => (creating = true)} />
          <MenuItem
            label="Go to Album"
            icon="adwaita-album"
            disabled={current.albumId === null || current.albumId === undefined}
            onselect={() => {
              if (current.albumId !== null && current.albumId !== undefined) {
                leave(`/album/${current.albumId}`);
              }
            }}
          />
          <MenuItem
            label="Go to Artist"
            icon="adwaita-artist"
            disabled={current.artistId === null || current.artistId === undefined}
            onselect={() => {
              if (current.artistId !== null && current.artistId !== undefined) {
                leave(`/artist/${current.artistId}`);
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
      <div class="hs-now-playing__panel" bind:this={panel}>
        {#if lyrics !== null && view === 'lyrics'}
          {#if lyrics.synced}
            <div class="hs-lyrics">
              {#each lyrics.lines as line, index (index)}
                <p class="hs-lyrics-line" aria-current={index === lineIndex ? 'true' : undefined}>
                  {line.text}
                </p>
              {/each}
              <p class="hs-lyrics-note hs-lyrics-note--source">Lyrics from {lyrics.source}</p>
            </div>
          {:else}
            <div class="hs-lyrics hs-lyrics--unsynced">
              <p class="hs-lyrics-note">Not synced to the music</p>
              {#each verses as verse, index (index)}
                <p class="hs-lyrics-line">{verse.join('\n')}</p>
              {/each}
              <p class="hs-lyrics-note hs-lyrics-note--source">Lyrics from {lyrics.source}</p>
            </div>
          {/if}
        {:else}
          <ul class="hs-track-list">
            {#each player.queue.items as item, index (index)}
              {@const isCurrent = index === player.queue.currentIndex}
              {@const isPlayed = index < player.queue.currentIndex}
              {@const isUpcoming = index > player.queue.currentIndex}
              {@const state = player.prefetch.stateFor(item.id)}
              {@const rowPill = isUpcoming
                ? queuePill(
                    prefetchLabel({
                      availability: state.availability,
                      state: state.state,
                      percent: state.percent,
                      prefetch: state.prefetch
                    })
                  )
                : null}
              {@const name = [item.title, item.artist ?? '', formatDuration(item.durationSecs)]
                .filter((part) => part !== '')
                .join(', ')}
              <li
                class="hs-track-row hs-track-row--queue"
                class:hs-track-row--current={isCurrent}
                class:hs-track-row--played={isPlayed}
                aria-current={isCurrent ? 'true' : undefined}
              >
                <button
                  class="hs-track-row__open"
                  type="button"
                  aria-label={name}
                  onclick={() => playRow(index)}
                ></button>
                <span class="hs-track-row__lead">
                  <CoverArt
                    coverArt={item.coverArt}
                    icon="adwaita-song"
                    size={80}
                    class="hs-track-row__art"
                  />
                  <span class="hs-track-row__overlay">
                    {#if isCurrent}
                      <span class="hs-eq" class:hs-eq--paused={!player.playing}>
                        <i></i><i></i><i></i>
                      </span>
                    {:else}
                      <Icon name="adwaita-play" />
                    {/if}
                  </span>
                </span>

                <span class="hs-track-row__text">
                  <span class="hs-track-row__title">{item.title}</span>
                  <span class="hs-track-row__artist">{item.artist ?? ''}</span>
                </span>

                <span class="hs-now-playing__queue-end">
                  {#if rowPill !== null}
                    <Pill tone={rowPill.tone} glyph={rowPill.glyph} label={rowPill.label} />
                  {/if}
                  <span class="hs-track-row__duration">{formatDuration(item.durationSecs)}</span>
                </span>
              </li>
            {/each}
          </ul>
        {/if}
      </div>
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
  /* Layout glue only: the package cannot know where the fetch pill sits beside
     the title, and the row's covering play target needs its own box. */
  .now-playing__title-row {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }

  .now-playing__status {
    flex: none;
  }

  /* The press target covers the whole row; the cells let the press through, so
     the text and the artwork do not swallow it (row-click). */
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
  .hs-now-playing__queue-end {
    pointer-events: none;
  }

  .hs-track-row__lead {
    position: relative;
  }

  /* Unsynced verses are one paragraph with hard line breaks, as the source
     writes them; the package sets the type only (p20b). */
  .hs-lyrics--unsynced .hs-lyrics-line {
    white-space: pre-line;
  }

  /* The package hides every track row's duration on phones; the queue end cell
     keeps it so the prefetch pill stacks above it (p19). */
  @media (max-width: 720px) {
    .hs-now-playing__queue-end .hs-track-row__duration {
      display: block;
    }
  }
</style>
