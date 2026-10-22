<!--
  The lyrics of the playing song (p20-r4 synced, p20b unsynced).

  Synced lines hold the line that plays at the panel's centre on desktops, and
  at the top on phones so it is read the moment the panel appears; the line is
  marked current for the reader and the assistive technology alike. Unsynced
  lyrics scroll by hand from the top, grouped by verse, and nothing is
  highlighted.

  The component owns the right column's scrolling panel, so the centring and
  the padding stay with the content they measure.
-->
<script lang="ts">
  import { currentLineIndex, versesOf } from '#lib/player/lyrics.svelte';
  import type { Lyrics } from '#lib/player/lyrics.svelte';

  /** Props of the lyrics panel. */
  interface Props {
    /** The song's lyrics. */
    lyrics: Lyrics;
    /** The playback position in milliseconds. */
    positionMs: number;
  }

  let { lyrics, positionMs }: Props = $props();

  let panel: HTMLDivElement | undefined = $state();

  const lineIndex = $derived(lyrics.synced ? currentLineIndex(lyrics, positionMs) : -1);
  const verses = $derived(lyrics.synced ? [] : versesOf(lyrics));

  /**
   * Puts the line that plays at the panel's vertical centre (p20-r4).
   *
   * Unsynced lyrics scroll by hand and never move themselves.
   */
  function centreLine(): void {
    if (panel === undefined || !lyrics.synced || lineIndex < 0) {
      return;
    }
    const phone = window.matchMedia('(max-width: 720px)').matches;
    const line = panel.querySelector<HTMLElement>('.hs-lyrics-line[aria-current="true"]');
    if (line === null) {
      return;
    }
    // Above the first line sits exactly the distance that puts its centre at the
    // panel's centre, so the topmost scroll position shows the first line there
    // instead of empty space (p20-r4).
    const half = panel.clientHeight / 2;
    panel.style.setProperty('--hs-lyrics-pad', phone ? '0px' : `${half - line.clientHeight / 2}px`);
    // Phones lead with the playing line at the panel's top so it is read the
    // moment the panel appears; desktops hold it at the centre.
    panel.scrollTop = phone ? line.offsetTop : line.offsetTop + line.clientHeight / 2 - half;
  }

  // The panel opens on the playing line and follows it as the track runs.
  $effect(() => {
    void lineIndex;
    centreLine();
  });

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
</script>

<div class="hs-now-playing__panel" bind:this={panel}>
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
</div>

<style>
  /* Synced lines are padded by half the panel (set from the panel's height) so
     the first line can reach the centre and the panel cannot scroll it away. */
  .hs-now-playing__panel .hs-lyrics:not(.hs-lyrics--unsynced) {
    padding-block: var(--hs-lyrics-pad, 0);
  }

  /* Unsynced verses are one paragraph with hard line breaks, as the source
     writes them; the package sets the type only (p20b). */
  .hs-lyrics--unsynced .hs-lyrics-line {
    white-space: pre-line;
  }
</style>
