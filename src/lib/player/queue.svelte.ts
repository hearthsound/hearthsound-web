/**
 * The play queue.
 *
 * The queue is the ordered list of tracks the player walks through, with the
 * index of the one that is playing. It is held in memory only: the server keeps
 * the saved play queue, which is a different thing from what this tab is
 * playing right now.
 *
 * The index follows the list through every change: removing or moving an item
 * leaves the same track playing, and removing the one that plays hands over to
 * the item that takes its place.
 */

/** One track of the queue, with what the player needs to stream it. */
export interface QueueItem {
  /** The track's client id. */
  id: string;
  /** The track title. */
  title: string;
  /** The display artist. */
  artist?: string | null;
  /** The album title. */
  album?: string | null;
  /** The id to pass to `getCoverArt`. */
  coverArt?: string | null;
  /** The MIME type of the stored file, empty while no file exists. */
  contentType?: string | null;
  /** The duration in seconds, when known. */
  durationSecs?: number | null;
  /** Whether the caller likes the track, as the list it came from reported. */
  liked?: boolean;
  /** Whether the caller dislikes the track, as its vendor member reported. */
  disliked?: boolean;
  /** The caller's rating, 1 to 5, as the list it came from reported. */
  rating?: number;
}

/** The position after which going back restarts the track instead. */
export const RESTART_POSITION_SECS = 3;

/** The play queue. */
export class QueueStore {
  /** The tracks, in play order. */
  items = $state<QueueItem[]>([]);

  /** The index of the track that plays, or `-1` while nothing does. */
  currentIndex = $state(-1);

  /** The track that plays, or `null`. */
  get current(): QueueItem | null {
    return this.items[this.currentIndex] ?? null;
  }

  /** The tracks after the current one, in order. */
  get following(): QueueItem[] {
    return this.currentIndex < 0 ? [] : this.items.slice(this.currentIndex + 1);
  }

  /**
   * Replaces the queue and starts at one of its items.
   *
   * @param items The tracks to play, in order.
   * @param startIndex The index to start at; out-of-range values clamp into the
   *   list.
   * @returns Nothing.
   */
  play(items: readonly QueueItem[], startIndex: number): void {
    this.items = [...items];
    this.currentIndex =
      this.items.length === 0 ? -1 : Math.min(Math.max(startIndex, 0), this.items.length - 1);
  }

  /**
   * Puts a track next in line.
   *
   * A queue nothing plays yet starts with the track.
   *
   * @param item The track to insert.
   * @returns Nothing.
   */
  playNext(item: QueueItem): void {
    if (this.currentIndex < 0) {
      this.play([item], 0);
      return;
    }
    const items = [...this.items];
    items.splice(this.currentIndex + 1, 0, item);
    this.items = items;
  }

  /**
   * Appends tracks to the queue.
   *
   * A queue nothing plays yet starts with the first appended track.
   *
   * @param items The tracks to append, in order.
   * @returns Nothing.
   */
  append(items: readonly QueueItem[]): void {
    if (items.length === 0) {
      return;
    }
    const empty = this.items.length === 0;
    this.items = [...this.items, ...items];
    if (empty) {
      this.currentIndex = 0;
    }
  }

  /**
   * Removes a track.
   *
   * Removing the track that plays keeps the index, so the track that took its
   * place plays; when the last track is removed, the index moves to the new
   * last track, or to `-1` for an empty queue.
   *
   * @param index The index to remove.
   * @returns Nothing.
   */
  remove(index: number): void {
    if (index < 0 || index >= this.items.length) {
      return;
    }
    this.items = this.items.filter((_, position) => position !== index);
    if (this.items.length === 0) {
      this.currentIndex = -1;
    } else if (index < this.currentIndex) {
      this.currentIndex -= 1;
    } else if (index === this.currentIndex) {
      this.currentIndex = Math.min(this.currentIndex, this.items.length - 1);
    }
  }

  /**
   * Moves a track to another position, keeping the played track playing.
   *
   * @param from The index to move.
   * @param to The index to move it to.
   * @returns Nothing.
   */
  move(from: number, to: number): void {
    if (from === to || from < 0 || to < 0 || from >= this.items.length || to >= this.items.length) {
      return;
    }
    const items = [...this.items];
    const [moved] = items.splice(from, 1);
    items.splice(to, 0, moved);
    this.items = items;
    if (from === this.currentIndex) {
      this.currentIndex = to;
    } else if (from < this.currentIndex && to >= this.currentIndex) {
      this.currentIndex -= 1;
    } else if (from > this.currentIndex && to <= this.currentIndex) {
      this.currentIndex += 1;
    }
  }

  /**
   * Advances to the next track.
   *
   * @returns The track that now plays, or `null` when the queue has no next
   *   track.
   */
  next(): QueueItem | null {
    if (this.currentIndex < 0 || this.currentIndex + 1 >= this.items.length) {
      return null;
    }
    this.currentIndex += 1;
    return this.current;
  }

  /**
   * Steps back, or restarts the track that plays.
   *
   * @param positionSecs How far into the current track playback is; past
   *   {@link RESTART_POSITION_SECS} the track restarts instead of stepping back.
   * @returns The track to play, which is the current one when it restarts.
   */
  previous(positionSecs: number): QueueItem | null {
    if (positionSecs > RESTART_POSITION_SECS || this.currentIndex <= 0) {
      return this.current;
    }
    this.currentIndex -= 1;
    return this.current;
  }
}
