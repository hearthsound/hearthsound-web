<!--
  A playlist.

  The approved playlist page (p17 A, l09 A): a drill-down header, the hero with
  the k16 mosaic, the name, the song and minute detail line and the actions,
  then the tracks as k12 list-context rows. The owner renames the playlist,
  reorders its tracks or deletes it from the hero menu, through the k19 dialogs
  and the k30 reorder list; every write is followed by a fresh read, so the list
  always shows what the server stored. Play, Shuffle and a row queue the whole
  playlist through the server's collection queue (queue-api).

  Playlists carry no lifetime indication: the web client never shows or changes
  one (p12, k15, p17-life). A lost event stream is not a problem here:
  `playlist.changed` reads the playlist again.
-->
<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import { page } from '$app/state';

  import SongRow from '#lib/components/SongRow.svelte';
  import { formatMinuteTotal } from '#lib/format';
  import { goBack, navigate } from '#lib/navigation';
  import { player } from '#lib/player/player.svelte';
  import { coverArtUrl } from '#lib/player/stream';
  import TrackRowPlaceholders from '#lib/library/TrackRowPlaceholders.svelte';
  import { changedOrder } from '#lib/library/playlist-order';
  import { reorderPlaylist } from '#lib/library/playlist-write';
  import { loadCollection } from '#lib/library/queue-source';
  import { availability } from '#lib/stores/availability.svelte';
  import { entities } from '#lib/stores/entities';
  import { events } from '#lib/stores/events.svelte';
  import { toasts } from '#lib/stores/toasts.svelte';
  import { libraryApi } from '#lib/subsonic/library';
  import type { Child, PlaylistWithEntries } from '#lib/subsonic/types';
  import Button from '#lib/ui/Button.svelte';
  import Dialog from '#lib/ui/Dialog.svelte';
  import FormField from '#lib/ui/FormField.svelte';
  import Hero from '#lib/ui/Hero.svelte';
  import Icon from '#lib/ui/Icon.svelte';
  import Menu from '#lib/ui/Menu.svelte';
  import MenuItem from '#lib/ui/MenuItem.svelte';
  import MenuSeparator from '#lib/ui/MenuSeparator.svelte';
  import Mosaic from '#lib/ui/Mosaic.svelte';
  import PageHeader from '#lib/ui/PageHeader.svelte';
  import ReorderList from '#lib/ui/ReorderList.svelte';
  import Skeleton from '#lib/ui/Skeleton.svelte';
  import StatusPage from '#lib/ui/StatusPage.svelte';
  import TextField from '#lib/ui/TextField.svelte';

  const id = $derived(page.params.id ?? '');

  let playlist = $state<PlaylistWithEntries | null>(null);
  let failure = $state<string | null>(null);
  let loading = $state(true);
  let busy = $state(false);
  let renaming = $state(false);
  let deleting = $state(false);
  let draftName = $state('');
  /** Whether the page is showing the rows as a reorderable list. */
  let reordering = $state(false);
  /** The rows in the order the reader has arranged them while reordering. */
  let rows = $state<Child[]>([]);

  let generation = 0;

  const renameForm = $props.id();
  const renameNameId = `${renameForm}-name`;

  const entries = $derived(playlist?.entry ?? []);
  const empty = $derived(entries.length === 0);
  /** Whether the entries are known: a seed from the list carries the count, not the songs. */
  const entriesLoaded = $derived(playlist?.entry !== undefined);
  const covers = $derived(
    entries
      .map((entry) => entry.coverArt)
      .filter((cover): cover is string => cover !== undefined && cover !== '')
      .slice(0, 4)
      .map((cover) => coverArtUrl(cover, 232))
  );
  const details = $derived(playlist === null ? [] : detailLines(playlist));
  const emptyText = 'Add songs with "Add to Playlist" in any song\'s menu.';

  $effect(() => {
    const current = id;
    const mine = ++generation;
    untrack(() => void load(current, mine));
  });

  onMount(() =>
    events.on('playlist.changed', (event) => {
      if (event.data.playlistId === id) {
        void load(id, ++generation);
      }
    })
  );

  /** Returns to the page that opened the playlist. */
  function back(): void {
    goBack('/library/playlists');
  }

  /**
   * Reads the playlist and remembers the availability of its tracks.
   *
   * @param current The playlist's client id.
   * @param mine The generation of this read.
   */
  async function load(current: string, mine: number): Promise<void> {
    // The row that opened this page already drew the playlist, so the hero is
    // there at once and only its tracks can still be missing.
    playlist = entities.playlist(current) ?? null;
    loading = true;
    failure = null;
    try {
      const answer = await libraryApi.playlist(current);
      if (mine !== generation) {
        return;
      }
      playlist = answer;
      availability.remember(answer?.entry ?? []);
    } catch {
      if (mine === generation) {
        failure = 'The server did not answer.';
        playlist = null;
      }
    } finally {
      if (mine === generation) {
        loading = false;
      }
    }
  }

  /**
   * Formats the hero's muted detail line: songs and minutes.
   *
   * @param entry The playlist.
   * @returns The line, or an empty list when nothing is known.
   */
  function detailLines(entry: PlaylistWithEntries): string[] {
    const count = entry.entry?.length ?? entry.songCount ?? 0;
    const parts = [`${count} ${count === 1 ? 'song' : 'songs'}`];
    const sum = (entry.entry ?? []).reduce((total, song) => total + (song.duration ?? 0), 0);
    const seconds = entry.duration !== undefined && entry.duration > 0 ? entry.duration : sum;
    if (seconds > 0) {
      parts.push(formatMinuteTotal(seconds));
    }
    return [parts.join(' - ')];
  }

  /**
   * Queues the whole playlist and starts at one of its tracks.
   *
   * @param from The track to start at; absent starts at the first.
   * @param shuffle Whether to switch the player's shuffled order on.
   */
  async function playCollection(from?: string, shuffle = false): Promise<void> {
    try {
      const collection = await loadCollection(`playlist:${id}`, from);
      if (collection === null || collection.items.length === 0) {
        return;
      }
      player.play(collection.items, collection.startIndex);
      player.setShuffle(shuffle);
    } catch (error) {
      toasts.push(
        error instanceof Error && error.message !== ''
          ? `Could not play this playlist: ${error.message}`
          : 'Could not play this playlist.',
        'error'
      );
    }
  }

  /**
   * Plays one of the playlist's tracks, with the playlist as the queue.
   *
   * @param song The track to play.
   */
  function playTrack(song: Child): void {
    void playCollection(song.id);
  }

  /**
   * Removes a track from the playlist.
   *
   * The index is what the protocol takes, so it is read out of the track list
   * as it stands right now.
   *
   * @param song The track to remove.
   */
  async function removeTrack(song: Child): Promise<void> {
    const index = entries.findIndex((entry) => entry.id === song.id);
    if (index < 0) {
      return;
    }
    await write(() => libraryApi.updatePlaylist(id, { remove: [index] }), 'remove the track');
  }

  /** Opens the Rename Playlist dialog. */
  function beginRename(): void {
    draftName = playlist?.name ?? '';
    renaming = true;
  }

  /** Saves a new name for the playlist. */
  async function saveName(): Promise<void> {
    const name = draftName.trim();
    if (name === '') {
      return;
    }
    if (await write(() => libraryApi.updatePlaylist(id, { name }), 'rename the playlist')) {
      renaming = false;
    }
  }

  /** Opens reorder mode with the playlist's rows in their stored order. */
  function beginReorder(): void {
    rows = [...entries];
    reordering = true;
  }

  /**
   * Leaves reorder mode without saving and shows the stored order again.
   *
   * A row that is being moved cancels its own move first and keeps Escape from
   * reaching this handler.
   */
  function cancelReorder(): void {
    reordering = false;
    void load(id, ++generation);
  }

  /** Saves the order the reader arranged, when it changed, and closes the mode. */
  async function finishReorder(): Promise<void> {
    const order = changedOrder(
      entries.map((entry) => entry.id),
      rows.map((row) => row.id)
    );
    if (order === null) {
      reordering = false;
      return;
    }
    if (await write(() => reorderPlaylist(id, order), 'reorder the playlist')) {
      reordering = false;
    }
  }

  // Escape leaves reorder mode; the rows return to what the server stored.
  $effect(() => {
    if (!reordering) {
      return;
    }
    const onKey = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') {
        return;
      }
      event.preventDefault();
      cancelReorder();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  /** Opens the Delete Playlist dialog. */
  function beginDelete(): void {
    deleting = true;
  }

  /** Deletes the playlist and returns to the playlists view. */
  async function removePlaylist(): Promise<void> {
    if (await write(() => libraryApi.deletePlaylist(id), 'delete the playlist', false)) {
      deleting = false;
      await navigate('/library/playlists');
    }
  }

  /**
   * Runs one write and reads the playlist again when it succeeded.
   *
   * @param call The write to make.
   * @param action The words the failure message uses.
   * @param reload Whether to read the playlist again; a deletion does not.
   * @returns `true` when the write succeeded.
   */
  async function write(call: () => Promise<void>, action: string, reload = true): Promise<boolean> {
    if (busy) {
      return false;
    }
    busy = true;
    try {
      await call();
      if (reload) {
        await load(id, ++generation);
      }
      return true;
    } catch (error) {
      toasts.push(
        error instanceof Error && error.message !== ''
          ? `Could not ${action}: ${error.message}`
          : `Could not ${action}.`,
        'error'
      );
      return false;
    } finally {
      busy = false;
    }
  }
</script>

<svelte:head>
  <title>{playlist?.name ?? 'Playlist'} - Hearthsound</title>
</svelte:head>

{#snippet retryAction()}
  <Button onclick={() => void load(id, ++generation)}>Retry</Button>
{/snippet}

{#snippet artwork()}
  <Mosaic {covers} />
{/snippet}

{#snippet heroActions()}
  {#if playlist !== null}
    <button
      class="hs-play-button hs-play-button--large"
      type="button"
      aria-label="Play {playlist.name}"
      disabled={empty}
      onclick={() => void playCollection(undefined, false)}
    >
      <Icon name="adwaita-play" />
    </button>
    <Button
      variant="flat"
      shape="icon"
      icon="adwaita-shuffle"
      label="Shuffle"
      disabled={empty}
      onclick={() => void playCollection(undefined, true)}
    />
    <Menu label="More Actions">
      <MenuItem label="Rename" icon="adwaita-edit" onselect={beginRename} />
      <MenuItem
        label="Reorder"
        icon="adwaita-drag"
        disabled={entries.length < 2}
        onselect={beginReorder}
      />
      <MenuSeparator />
      <MenuItem label="Delete" icon="adwaita-delete" destructive onselect={beginDelete} />
    </Menu>
    {#if reordering}
      <Button variant="suggested" {busy} onclick={() => void finishReorder()}>Done</Button>
    {/if}
  {/if}
{/snippet}

<div class="detail-page playlist-page">
  <PageHeader onback={back} />

  {#if failure !== null}
    <div class="state">
      <StatusPage
        alert
        icon="adwaita-error"
        title="Could Not Load This Page"
        text="The server did not answer. Try again in a moment."
        action={retryAction}
      />
    </div>
  {:else if loading && playlist === null}
    <div class="loading" aria-busy="true">
      <span class="hs-visually-hidden" role="status">Loading...</span>
      <div class="hs-hero">
        <span class="hs-hero__art"><Skeleton width="100%" height="100%" radius="art" /></span>
        <div class="hs-hero__text">
          <Skeleton width="260px" height="30px" />
          <Skeleton width="130px" height="12px" />
        </div>
      </div>
      <ul class="hs-track-list songs">
        {#each Array.from({ length: 8 }, (_, index) => index) as row (row)}
          <li class="hs-track-row" aria-hidden="true">
            <span class="hs-track-row__lead">
              <Skeleton width="40px" height="40px" radius="art-small" />
            </span>
            <span class="hs-track-row__text">
              <Skeleton width="45%" height="12px" />
              <Skeleton width="30%" height="10px" />
            </span>
            <span class="hs-track-row__album"><Skeleton width="40%" height="10px" /></span>
            <span class="hs-track-row__status"></span>
            <span></span>
            <span class="hs-track-row__duration"><Skeleton width="30px" height="10px" /></span>
          </li>
        {/each}
      </ul>
    </div>
  {:else if playlist === null}
    <div class="state">
      <StatusPage
        icon="adwaita-playlist"
        title="Playlist Not Found"
        text="It is not in your library."
      />
    </div>
  {:else}
    <Hero title={playlist.name} meta={details} {artwork} actions={heroActions} />

    {#if !entriesLoaded && loading}
      <ul class="hs-track-list songs">
        <TrackRowPlaceholders count={Math.max(0, playlist.songCount ?? 0)} />
      </ul>
    {:else if reordering}
      <div class="songs">
        <ReorderList
          label="Playlist songs"
          bind:items={rows}
          bind:reordering
          handles="mode"
          numbered={false}
          twoLine
        >
          {#snippet children(row)}
            <span class="hs-setting-row__text">
              <span>{row.title ?? row.name ?? ''}</span>
              <span class="hs-setting-row__subtitle">{row.artist ?? ''}</span>
            </span>
          {/snippet}
        </ReorderList>
      </div>
    {:else if empty}
      <StatusPage inline icon="adwaita-playlist" title="This Playlist Is Empty" text={emptyText} />
    {:else}
      <ul class="hs-track-list songs">
        {#each entries as song (song.id)}
          <SongRow {song} play={playTrack} remove={removeTrack} />
        {/each}
      </ul>
    {/if}
  {/if}
</div>

{#if renaming}
  <Dialog title="Rename Playlist" onclose={() => (renaming = false)}>
    <form
      id={renameForm}
      class="hs-form"
      novalidate
      onsubmit={(event) => {
        event.preventDefault();
        void saveName();
      }}
    >
      <FormField label="Name" for={renameNameId}>
        <TextField id={renameNameId} bind:value={draftName} disabled={busy} required />
      </FormField>
    </form>

    {#snippet footer()}
      <Button disabled={busy} onclick={() => (renaming = false)}>Cancel</Button>
      <Button
        variant="suggested"
        type="submit"
        form={renameForm}
        {busy}
        disabled={busy || draftName.trim() === ''}
      >
        Rename
      </Button>
    {/snippet}
  </Dialog>
{/if}

{#if deleting}
  <Dialog
    title="Delete Playlist?"
    alert
    onclose={() => (deleting = false)}
    description={`"${playlist?.name ?? ''}" and its song order are deleted. The songs stay in your library.`}
  >
    <span aria-hidden="true"></span>

    {#snippet footer()}
      <Button disabled={busy} onclick={() => (deleting = false)}>Cancel</Button>
      <Button variant="destructive" {busy} disabled={busy} onclick={() => void removePlaylist()}>
        Delete
      </Button>
    {/snippet}
  </Dialog>
{/if}

<style>
  /* The shell already holds the page off the window edge. The hero keeps only
     the 8 px that puts the mosaic on the approved content line (fc5b-diff). */
  .detail-page :global(.hs-page-header) {
    padding-inline: 0;
  }

  .detail-page :global(.hs-hero) {
    padding: var(--hs-space-3) var(--hs-space-3) calc(var(--hs-space-6) + var(--hs-space-1));
  }

  .songs {
    margin: 0;
    padding: 0 0 var(--hs-space-6);
    list-style: none;
  }

  .state {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-height: 60vh;
  }

  @media (max-width: 720px) {
    .detail-page :global(.hs-hero) {
      padding: var(--hs-space-2) var(--hs-space-1) 18px;
    }

    .songs {
      margin-inline: calc(-1 * var(--hs-space-3));
    }
  }
</style>
