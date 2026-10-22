<!--
  The player bar and the phone mini player (k35, l04 B).

  The bar is three zones: the song that plays, the transport over the seek bar,
  and the volume and queue controls. It is always shown (o02): with nothing
  playing the art slot and the title say so and every control is inert. While a
  track is being fetched the same bar shows the fetch pill, and a failure turns
  the disc into a retry button with the reason in a tooltip (p19b, o07).

  On phones the bar is the 64 px mini card: cover, title over artist, the disc
  and a progress line. Both surfaces, and the queue toggle, open the
  now-playing view (l05, p20-r4).

  A cover the server cannot serve - a remote id still being acquired is the
  usual case - falls back to the same note placeholder the bar shows without
  one, and the next cover id tries again (f15b, f15c).
-->
<script lang="ts">
  import { formatDuration } from '#lib/format';
  import { failureSentence } from '#lib/labels';
  import { fetchView, playDisc } from '#lib/player/fetch';
  import { nowPlaying } from '#lib/player/now-playing.svelte';
  import { player } from '#lib/player/player.svelte';
  import type { RepeatMode } from '#lib/player/settings';
  import { coverArtUrl } from '#lib/player/stream';
  import Button from '#lib/ui/Button.svelte';
  import Icon from '#lib/ui/Icon.svelte';
  import Pill from '#lib/ui/Pill.svelte';
  import PlayButton from '#lib/ui/PlayButton.svelte';
  import Slider from '#lib/ui/Slider.svelte';
  import Transport from '#lib/ui/Transport.svelte';
  import { tooltip } from '#lib/ui/tooltip.svelte';

  const current = $derived(player.queue.current);
  const idle = $derived(current === null);
  const duration = $derived(player.durationSecs > 0 ? player.durationSecs : 0);
  const position = $derived(
    duration > 0 ? Math.min(player.positionSecs, duration) : player.positionSecs
  );
  const fetchState = $derived(fetchView(player.fetchProgress, player.failureReason));
  const disc = $derived(playDisc(fetchState, player.playing));
  const reason = $derived(failureSentence(player.failureReason));
  const queueOpen = $derived(nowPlaying.opened);
  const fraction = $derived(
    duration > 0 ? Math.min(100, Math.max(0, (position / duration) * 100)) : 0
  );

  /** The cover id whose image failed, so a new id gets a fresh image. */
  let failedCover = $state<string | null>(null);
  const coverShown = $derived(
    current !== null &&
      current.coverArt !== null &&
      current.coverArt !== undefined &&
      current.coverArt !== '' &&
      failedCover !== current.coverArt
  );

  /**
   * Opens the now-playing view (l05, p20-r4) from a press on the bar's own
   * surface; a press on one of the bar's controls keeps its own action.
   *
   * @param event The press.
   */
  function barClick(event: MouseEvent): void {
    if (idle || !(event.target instanceof Element)) {
      return;
    }
    if (event.target.closest('button, a, input, [role="slider"], [role="menu"]') !== null) {
      return;
    }
    nowPlaying.open();
  }

  /**
   * Opens the now-playing view from the cover or the title, and from the queue
   * toggle.
   */
  function openQueue(): void {
    nowPlaying.open();
  }

  /** Plays, pauses, or asks again for a track whose fetch failed (p19b). */
  function play(): void {
    if (fetchState.failed) {
      player.play(player.queue.items, player.queue.currentIndex);
      return;
    }
    player.toggle();
  }

  /** The repeat button's name in each mode (repeat3). */
  const REPEAT_LABELS: Record<RepeatMode, string> = {
    off: 'Repeat Off',
    all: 'Repeat All',
    song: 'Repeat Song'
  };
</script>

<div
  class="hs-player player-bar"
  class:hs-player--idle={idle}
  onclick={barClick}
  role="presentation"
>
  {#if current === null}
    <div class="hs-player__now-playing">
      <span class="hs-player__cover">
        <Icon name="adwaita-song" />
      </span>
      <span class="hs-player__meta">
        <span class="hs-player__title-row">
          <span class="hs-player__title player-title">Nothing playing</span>
        </span>
      </span>
    </div>
  {:else}
    <button
      class="hs-player__now-playing"
      type="button"
      aria-label="Show Queue"
      onclick={openQueue}
    >
      <span class="hs-player__cover">
        {#if coverShown}
          <img
            src={coverArtUrl(current.coverArt ?? '', 104)}
            alt=""
            onerror={() => (failedCover = current?.coverArt ?? null)}
          />
        {:else}
          <Icon name="adwaita-song" />
        {/if}
      </span>
      <span class="hs-player__meta">
        <span class="hs-player__title-row">
          <span class="hs-player__title player-title">{current.title}</span>
          {#if fetchState.pill !== null}
            {#if fetchState.failed}
              <span class="player-progress" {@attach tooltip(() => reason)}>
                <Pill
                  tone={fetchState.pill.tone}
                  glyph={fetchState.pill.glyph}
                  label={fetchState.pill.label}
                />
              </span>
            {:else}
              <span class="player-progress">
                <Pill
                  tone={fetchState.pill.tone}
                  glyph={fetchState.pill.glyph}
                  label={fetchState.pill.label}
                />
              </span>
            {/if}
          {/if}
        </span>
        {#if current.artist !== null && current.artist !== undefined && current.artist !== ''}
          <span class="hs-player__artist">{current.artist}</span>
        {/if}
      </span>
    </button>
  {/if}

  <div class="hs-player__transport">
    <Transport>
      <Button
        variant="flat"
        shape="circular"
        icon="adwaita-shuffle"
        label={player.shuffle ? 'Shuffle On' : 'Shuffle Off'}
        pressed={player.shuffle}
        disabled={idle}
        onclick={() => player.toggleShuffle()}
      />
      <Button
        variant="flat"
        shape="circular"
        icon="adwaita-previous"
        label="Previous"
        disabled={idle}
        onclick={() => player.previous()}
      />
      <PlayButton state={disc} disabled={idle} onclick={play} />
      <Button
        variant="flat"
        shape="circular"
        icon="adwaita-next"
        label="Next"
        disabled={idle}
        onclick={() => player.next()}
      />
      <Button
        variant="flat"
        shape="circular"
        icon={player.repeat === 'song' ? 'adwaita-repeat-song' : 'adwaita-repeat'}
        label={REPEAT_LABELS[player.repeat]}
        pressed={player.repeat !== 'off'}
        disabled={idle}
        onclick={() => player.cycleRepeat()}
      />
    </Transport>

    <div class="hs-player__seek-row">
      <span class="hs-player__times">{formatDuration(idle ? 0 : position)}</span>
      <Slider
        kind="seek"
        label="Seek"
        value={position}
        max={idle ? 0 : duration}
        disabled={idle}
        valuetext="{formatDuration(idle ? 0 : position)} of {formatDuration(idle ? 0 : duration)}"
        onchange={(seconds) => player.seek(seconds)}
      />
      <span class="hs-player__times">{formatDuration(idle ? 0 : duration)}</span>
    </div>
  </div>

  <div class="hs-player__end">
    <div class="hs-player__volume">
      <Button
        variant="flat"
        shape="circular"
        icon={player.muted || player.volume === 0 ? 'adwaita-mute' : 'adwaita-volume'}
        label={player.muted ? 'Unmute' : 'Mute'}
        pressed={player.muted}
        disabled={idle}
        onclick={() => player.toggleMute()}
      />
      <Slider
        kind="volume"
        label="Volume"
        value={idle ? 0 : Math.round(player.volume * 100)}
        disabled={idle}
        onchange={(next) => player.setVolume(next / 100)}
      />
    </div>
    <Button
      variant="flat"
      shape="circular"
      icon="adwaita-queue"
      label="Show Queue"
      pressed={queueOpen}
      disabled={idle}
      onclick={openQueue}
    />
  </div>
</div>

<div
  class="hs-player hs-player--mini player-mini"
  class:hs-player--idle={idle}
  onclick={barClick}
  role="presentation"
>
  {#if current === null}
    <div class="hs-player__now-playing">
      <span class="hs-player__cover">
        <Icon name="adwaita-song" />
      </span>
      <span class="hs-player__meta">
        <span class="hs-player__title-row">
          <span class="hs-player__title">Nothing playing</span>
        </span>
      </span>
    </div>
  {:else}
    <button
      class="hs-player__now-playing"
      type="button"
      aria-label="Show Queue"
      onclick={openQueue}
    >
      <span class="hs-player__cover">
        {#if coverShown}
          <img
            src={coverArtUrl(current.coverArt ?? '', 96)}
            alt=""
            onerror={() => (failedCover = current?.coverArt ?? null)}
          />
        {:else}
          <Icon name="adwaita-song" />
        {/if}
      </span>
      <span class="hs-player__meta">
        <span class="hs-player__title-row">
          <span class="hs-player__title">{current.title}</span>
          {#if fetchState.pill !== null}
            {#if fetchState.failed}
              <span class="player-progress-mini" {@attach tooltip(() => reason)}>
                <Pill
                  tone={fetchState.pill.tone}
                  glyph={fetchState.pill.glyph}
                  label={fetchState.pill.label}
                />
              </span>
            {:else}
              <span class="player-progress-mini">
                <Pill
                  tone={fetchState.pill.tone}
                  glyph={fetchState.pill.glyph}
                  label={fetchState.pill.label}
                />
              </span>
            {/if}
          {/if}
        </span>
        {#if current.artist !== null && current.artist !== undefined && current.artist !== ''}
          <span class="hs-player__artist">{current.artist}</span>
        {/if}
      </span>
    </button>
  {/if}

  <PlayButton state={disc} disabled={idle} onclick={play} />

  {#if !idle}
    <span class="hs-player__progress-line">
      <i style:width="{fraction}%"></i>
    </span>
  {/if}
</div>

<style>
  /* The package hides the bar on phones; the mini card is its desktop twin. */
  @media (min-width: 721px) {
    .player-mini {
      display: none;
    }
  }

  @media (max-width: 720px) {
    .player-bar {
      display: none;
    }
  }
</style>
