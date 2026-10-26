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
 * The memory is what makes a revisit cheap. A URL that already loaded is
 * answered without taking a slot, so a box can draw it at once - the browser
 * holds the bytes and paints them without waiting for a request of its own.
 * A URL that failed is remembered for {@link IMAGE_FAILURE_TTL_MS}, so a broken
 * cover is not asked for again by every box that mounts; the box that asked
 * keeps its placeholder. Both kinds of memory live in `sessionStorage` when it
 * is available, which is what carries them across a page load; without it they
 * last as long as this document.
 */

/** How many images one page loads at once. */
export const MAX_IMAGE_LOADS = 4;

/** How long a failed image is remembered, in milliseconds. */
export const IMAGE_FAILURE_TTL_MS = 5 * 60_000;

/**
 * How long a cover waits after a `503` before it asks once more.
 *
 * The server answers `503` with `Retry-After` when the artwork source refused
 * the request for now - a provider rate limit, most often - so the picture is
 * late rather than missing. The wait is capped, because a box that holds a gate
 * slot for minutes is worse than a placeholder.
 */
export const MAX_RETRY_AFTER_SECS = 30;

/** How many loaded URLs one session remembers. */
const LOADED_LIMIT = 500;

/** The `sessionStorage` key of the URLs that loaded. */
const LOADED_KEY = 'hs.images.loaded';

/** The `sessionStorage` key of the URLs that failed, with the time they expire. */
const FAILED_KEY = 'hs.images.failed';

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
  /**
   * Reports whether an image failed in this session and is still remembered.
   *
   * @param url The image URL.
   * @returns `true` while the last failure of that URL has not expired.
   */
  isFailed(url: string): boolean;
  /**
   * Remembers an image the caller tried to show itself and that failed.
   *
   * A box that draws a URL this session already loaded paints it without asking
   * the gate; an image that turns out to be gone from the browser's cache fails
   * on the element, and this is how that failure reaches the other boxes and the
   * session memory.
   *
   * @param url The image URL.
   * @returns Nothing.
   */
  reportFailure(url: string): void;
}

/** What a caller may replace in a loader, for tests. */
export interface ImageLoaderOptions {
  /** Creates the image element a request runs through; defaults to the browser's `Image`. */
  makeImage?: () => HTMLImageElement;
  /** Where the session memory lives; `null` keeps it in this document only. */
  storage?: Storage | null;
  /** The clock the failure memory expires against. */
  now?: () => number;
  /** Asks the server why a picture failed; the browser's `fetch` by default. */
  probe?: (url: string) => Promise<ImageProbe>;
  /** Waits before a retry; the browser's timer by default. */
  wait?: (milliseconds: number) => Promise<void>;
}

/** What a refused picture answered. */
export interface ImageProbe {
  /** The status the server answered with. */
  status: number;
  /** The `Retry-After` it named, in seconds, when it named one. */
  retryAfterSecs: number | null;
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
 * Reads the stored failures that have not expired.
 *
 * @param storage Where the failures are kept, or `null`.
 * @param key The failures' key.
 * @param at The current time, in milliseconds.
 * @returns The URLs that failed and the time each one's failure expires.
 */
function readFailures(storage: Storage | null, key: string, at: number): Map<string, number> {
  const failures = new Map<string, number>();
  if (storage === null) {
    return failures;
  }
  try {
    const raw = storage.getItem(key);
    const parsed: unknown = raw === null ? {} : JSON.parse(raw);
    if (typeof parsed === 'object' && parsed !== null) {
      for (const [url, until] of Object.entries(parsed)) {
        if (typeof until === 'number' && until > at) {
          failures.set(url, until);
        }
      }
    }
  } catch {
    return new Map();
  }
  return failures;
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
 * Asks the server why a picture it served could not be painted.
 *
 * A browser's `<img>` reports an error and nothing else, so a refused cover is
 * one request with the same credentials: the body is dropped unread and only
 * the status and the wait are kept.
 *
 * @param url The image URL.
 * @returns The status and the wait the server named, both neutral when the
 *   request itself failed.
 */
async function probeImage(url: string): Promise<ImageProbe> {
  if (typeof fetch !== 'function') {
    return { status: 0, retryAfterSecs: null };
  }
  try {
    const answer = await fetch(url, { method: 'GET', cache: 'no-store' });
    await answer.body?.cancel();
    const header = answer.headers.get('retry-after');
    const seconds = header === null ? Number.NaN : Number(header);
    return {
      status: answer.status,
      retryAfterSecs: Number.isFinite(seconds) && seconds >= 0 ? seconds : null
    };
  } catch {
    return { status: 0, retryAfterSecs: null };
  }
}

/**
 * Waits for a delay.
 *
 * @param milliseconds How long to wait.
 * @returns A promise that resolves once it has passed.
 */
function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

/**
 * Builds a loader over a fixed concurrency.
 *
 * @param max How many images may be in flight at once.
 * @param options The image factory, the session memory and the clock, for tests.
 * @returns The loader.
 */
export function createImageLoader(max: number, options: ImageLoaderOptions = {}): ImageLoader {
  const makeImage = options.makeImage ?? (() => new Image());
  const storage = options.storage === undefined ? defaultStorage() : options.storage;
  const now = options.now ?? Date.now;
  const probe = options.probe ?? probeImage;
  const wait = options.wait ?? sleep;

  const loaded = new Set<string>(readList(storage, LOADED_KEY));
  const failed = readFailures(storage, FAILED_KEY, now());
  const queue: Entry[] = [];
  let inFlight = 0;

  /** Remembers that a URL loaded and forgets a failure it had. */
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
    if (failed.delete(url)) {
      write(storage, FAILED_KEY, Object.fromEntries(failed));
    }
  };

  /** Remembers that a URL failed for the failure window. */
  const rememberFailure = (url: string): void => {
    failed.set(url, now() + IMAGE_FAILURE_TTL_MS);
    write(storage, FAILED_KEY, Object.fromEntries(failed));
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
        } else if (outcome === 'failed') {
          rememberFailure(entry.url);
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

    isFailed(url: string) {
      const until = failed.get(url);
      return until !== undefined && until > now();
    },

    reportFailure(url: string) {
      rememberFailure(url);
    },

    load(url: string): ImageLoad {
      if (loaded.has(url)) {
        return { done: Promise.resolve(true), cancel() {} };
      }
      if (this.isFailed(url)) {
        return { done: Promise.resolve(false), cancel() {} };
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
          let cancelled = false;
          /**
           * Asks for the picture, once more when the server asked for a wait.
           *
           * @param attemptsLeft How many requests are still allowed.
           */
          const attempt = (attemptsLeft: number): void => {
            const image = makeImage();
            image.decoding = 'async';
            image.onload = () => report('loaded');
            image.onerror = () => {
              if (attemptsLeft <= 1) {
                report('failed');
                return;
              }
              void probe(url).then(async (answer) => {
                if (cancelled) {
                  return;
                }
                const delay = answer.status === 503 ? (answer.retryAfterSecs ?? 0) : null;
                if (delay === null || delay > MAX_RETRY_AFTER_SECS) {
                  report('failed');
                  return;
                }
                await wait(delay * 1000);
                if (cancelled) {
                  return;
                }
                attempt(attemptsLeft - 1);
              });
            };
            image.src = url;
            abort = () => {
              cancelled = true;
              image.onload = null;
              image.onerror = null;
              image.src = '';
              report('cancelled');
            };
          };
          attempt(2);
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
