/**
 * A small FIFO gate in front of the browser's image requests, and the memory of
 * what this session already knows about an image.
 *
 * A grid of a hundred cards asks for a hundred covers at once. Over HTTP/1.1 the
 * browser opens six connections per origin and one of them carries the event
 * stream, so the covers would hold every remaining connection and the page's own
 * API calls would wait behind them. The gate keeps a few images in flight and
 * leaves the other connections to the requests that decide what the page shows.
 *
 * The memory is what makes a revisit cheap: a URL that already loaded is
 * answered without taking a slot, so a box can draw it at once - the browser
 * holds the bytes and paints them without waiting for a request of its own.
 * The memory lives in `sessionStorage` when it is available, which is what
 * carries it across a page load; without it it lasts as long as this document.
 */

/** How many images one page loads at once. */
export const MAX_IMAGE_LOADS = 4;

/** How many loaded URLs one session remembers. */
const LOADED_LIMIT = 500;

/** The `sessionStorage` key of the URLs that loaded. */
const LOADED_KEY = 'hs.images.loaded';

/** The answer to one request for an image. */
export interface ImageLoad {
  /** Resolves `true` when the image loaded and `false` when it failed or was cancelled. */
  readonly done: Promise<boolean>;
  /**
   * Gives up on the image.
   *
   * A queued image never starts; an image in flight is aborted and its slot goes
   * to the next queued image.
   */
  cancel(): void;
}

/** The gate itself. */
export interface ImageLoader {
  /**
   * Queues an image.
   *
   * @param url The image URL.
   * @returns The load, whose promise settles when the image loaded or failed.
   */
  load(url: string): ImageLoad;
  /**
   * Reports whether an image already loaded in this session.
   *
   * @param url The image URL.
   * @returns `true` when a load of that URL succeeded before.
   */
  isLoaded(url: string): boolean;
}

/** What a caller may replace in a loader, for tests. */
export interface ImageLoaderOptions {
  /** Creates the image element a request runs through; defaults to the browser's `Image`. */
  makeImage?: () => HTMLImageElement;
  /** Where the session memory lives; `null` keeps it in this document only. */
  storage?: Storage | null;
}

/** One queued or running request. */
interface Entry {
  /** The image URL. */
  readonly url: string;
  /** Settles the caller's promise, at most once. */
  settle(loaded: boolean): void;
  /** Starts the request, reporting its outcome to the gate. */
  start(report: (outcome: Outcome) => void): void;
  /** Aborts a running request and reports the cancellation. */
  abort(): void;
}

/** How a queued image ended. */
type Outcome = 'loaded' | 'failed' | 'cancelled';

/**
 * Returns the browser's session storage, or `null` where it cannot be used.
 *
 * @returns The storage, or `null` on the server, in a private mode that refuses
 *   it, and in a test environment that has none.
 */
function defaultStorage(): Storage | null {
  try {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage;
  } catch {
    return null;
  }
}

/**
 * Reads a stored list of URLs.
 *
 * @param storage Where the list is kept, or `null`.
 * @param key The list's key.
 * @returns The URLs, empty for a missing or unreadable entry.
 */
function readList(storage: Storage | null, key: string): string[] {
  if (storage === null) {
    return [];
  }
  try {
    const raw = storage.getItem(key);
    const parsed: unknown = raw === null ? [] : JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((entry): entry is string => typeof entry === 'string')
      : [];
  } catch {
    return [];
  }
}

/**
 * Writes a value to the session memory, ignoring a store that refuses it.
 *
 * @param storage Where the value is kept, or `null`.
 * @param key The value's key.
 * @param value The value, which must serialize to JSON.
 * @returns Nothing.
 */
function write(storage: Storage | null, key: string, value: unknown): void {
  try {
    storage?.setItem(key, JSON.stringify(value));
  } catch {
    // A full or disabled store keeps the memory in this document.
  }
}

/**
 * Builds a loader over a fixed concurrency.
 *
 * @param max How many images may be in flight at once.
 * @param options The image factory and the session memory, for tests.
 * @returns The loader.
 */
export function createImageLoader(max: number, options: ImageLoaderOptions = {}): ImageLoader {
  const makeImage = options.makeImage ?? (() => new Image());
  const storage = options.storage === undefined ? defaultStorage() : options.storage;

  const loaded = new Set<string>(readList(storage, LOADED_KEY));
  const queue: Entry[] = [];
  let inFlight = 0;

  /** Remembers that a URL loaded. */
  const rememberLoaded = (url: string): void => {
    loaded.delete(url);
    loaded.add(url);
    while (loaded.size > LOADED_LIMIT) {
      const oldest = loaded.values().next().value;
      if (oldest === undefined) {
        break;
      }
      loaded.delete(oldest);
    }
    write(storage, LOADED_KEY, [...loaded]);
  };

  const pump = (): void => {
    while (inFlight < max && queue.length > 0) {
      const entry = queue.shift() as Entry;
      inFlight += 1;
      let reported = false;
      entry.start((outcome) => {
        if (reported) return;
        reported = true;
        inFlight -= 1;
        if (outcome === 'loaded') {
          rememberLoaded(entry.url);
        }
        entry.settle(outcome === 'loaded');
        pump();
      });
    }
  };

  return {
    isLoaded(url: string) {
      return loaded.has(url);
    },

    load(url: string): ImageLoad {
      if (loaded.has(url)) {
        return { done: Promise.resolve(true), cancel() {} };
      }
      const { promise, resolve } = Promise.withResolvers<boolean>();
      let settled = false;
      const settle = (ok: boolean) => {
        if (settled) return;
        settled = true;
        resolve(ok);
      };
      let abort = () => settle(false);
      const entry: Entry = {
        url,
        settle,
        start(report) {
          const image = makeImage();
          image.decoding = 'async';
          image.onload = () => report('loaded');
          image.onerror = () => report('failed');
          image.src = url;
          abort = () => {
            image.onload = null;
            image.onerror = null;
            image.src = '';
            report('cancelled');
          };
        },
        abort() {
          abort();
        }
      };
      queue.push(entry);
      pump();
      return {
        done: promise,
        cancel() {
          const queued = queue.indexOf(entry);
          if (queued >= 0) {
            queue.splice(queued, 1);
            settle(false);
            return;
          }
          entry.abort();
        }
      };
    }
  };
}

/** The loader every cover image of the page goes through. */
export const imageLoader: ImageLoader = createImageLoader(MAX_IMAGE_LOADS);
