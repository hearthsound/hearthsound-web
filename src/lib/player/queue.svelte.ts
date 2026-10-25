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
 *
 * Shuffle changes only the order after the current track and remembers the
 * order it replaced, so switching it off restores that order with the same
 * track playing. Tracks added while shuffled join the end of both orders;
 * removals leave both, and a move is mirrored into the remembered order.
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
  /** The id of the album the track belongs to, when the source reported one. */
  albumId?: string | null;
  /** The id of the credited artist, when the source reported one. */
  artistId?: string | null;
  /** The album's readable path, when the source reported one. */
  albumPath?: string | null;
  /** The credited artist's readable path segment, when the source reported one. */
  artistPath?: string | null;
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

  /** Whether the tracks after the current one play in a shuffled order. */
  shuffle = $state(false);

  /** The order shuffle replaced, while it is on. */
  #original: QueueItem[] | null = null;

  /** The track that plays, or `null`. */
  get current(): QueueItem | null {
    return this.items[this.currentIndex] ?? null;
  }

  /** The tracks after the current one, in order. */
  get following(): QueueItem[] {
    return this.currentIndex < 0 ? [] : this.items.slice(this.currentIndex + 1);
  }

  /** The order shuffle replaced while it is on, or `null`. */
  get originalItems(): readonly QueueItem[] | null {
    return this.#original;
  }

  /**
   * Replaces the queue with a stored one without starting anything.
   *
   * The index is clamped into the list, so an index that no longer names a
   * track leaves the same track current as a removal would. While shuffle is
   * on, the remembered order comes back too, so turning shuffle off returns to
   * the stored order rather than emptying the queue.
   *
   * @param items The tracks, in play order.
   * @param currentIndex The index of the track that plays, or `-1` for none.
   * @param original The order shuffle replaced, when one was stored.
   * @returns Nothing.
   */
  restore(
    items: readonly QueueItem[],
    currentIndex: number,
    original: readonly QueueItem[] | null = null
  ): void {
    this.items = [...items];
    this.currentIndex =
      this.items.length === 0 ? -1 : Math.min(Math.max(currentIndex, 0), this.items.length - 1);
    if (this.shuffle) {
      this.#original = original === null ? [...this.items] : [...original];
    } else {
      this.#original = null;
    }
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
    if (this.shuffle) {
      this.#original = [...this.items];
      this.#shuffleAroundCurrent();
    }
  }

  /**
   * Turns shuffle on or off.
   *
   * Turning it on moves the track that plays to the front and shuffles every
   * other track after it, so Previous only goes back through tracks played in
   * the shuffled order (shuffle-prev). Turning it off restores the order the
   * queue held before, with the same track still playing.
   *
   * @param on Whether the upcoming tracks play shuffled.
   * @returns Nothing.
   */
  setShuffle(on: boolean): void {
    if (on === this.shuffle) {
      return;
    }
    if (on) {
      this.#original = [...this.items];
      this.shuffle = true;
      this.#shuffleAroundCurrent();
      return;
    }
    const current = this.current;
    const original = this.#original ?? [...this.items];
    this.shuffle = false;
    this.#original = null;
    this.items = original;
    const index = current === null ? -1 : original.indexOf(current);
    this.currentIndex =
      index >= 0 || original.length === 0
        ? index
        : Math.min(Math.max(this.currentIndex, 0), original.length - 1);
  }

  /**
   * Puts the track that plays first and every other track after it in a random
   * order; with nothing playing, the whole queue is shuffled and nothing is
   * current.
   */
  #shuffleAroundCurrent(): void {
    const current = this.current;
    const rest = this.items.filter((_, index) => index !== this.currentIndex);
    for (let index = rest.length - 1; index > 0; index -= 1) {
      const swap = Math.floor(Math.random() * (index + 1));
      [rest[index], rest[swap]] = [rest[swap], rest[index]];
    }
    this.items = current === null ? rest : [current, ...rest];
    this.currentIndex = current === null ? -1 : 0;
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
    if (this.#original !== null) {
      const current = this.current;
      const original = [...this.#original];
      const at = current === null ? -1 : original.indexOf(current);
      original.splice(at + 1, 0, item);
      this.#original = original;
    }
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
    if (this.#original !== null) {
      this.#original = [...this.#original, ...items];
    }
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
    const removed = this.items[index];
    this.items = this.items.filter((_, position) => position !== index);
    if (this.#original !== null) {
      this.#original = this.#original.filter((entry) => entry !== removed);
    }
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
    if (this.#original !== null) {
      // The move is mirrored into the remembered order: the track follows the
      // track it now stands behind there.
      const before = items[to - 1] ?? null;
      const original = this.#original.filter((entry) => entry !== moved);
      const at = before === null ? -1 : original.indexOf(before);
      original.splice(at + 1, 0, moved);
      this.#original = original;
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
   * Returns to the first track, which is where a repeated queue wraps to.
   * While shuffle is on, the new round is shuffled again (shuffle-wrap).
   *
   * @returns The track that now plays, or `null` when the queue is empty.
   */
  rewind(): QueueItem | null {
    if (this.items.length === 0) {
      return null;
    }
    if (this.shuffle) {
      this.currentIndex = -1;
      this.#shuffleAroundCurrent();
    }
    this.currentIndex = 0;
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
