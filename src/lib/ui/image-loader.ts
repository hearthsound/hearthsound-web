/**
 * A small FIFO gate in front of the browser's image requests.
 *
 * A grid of a hundred cards asks for a hundred covers at once. Over HTTP/1.1 the
 * browser opens six connections per origin and one of them carries the event
 * stream, so the covers would hold every remaining connection and the page's own
 * API calls would wait behind them. The gate keeps a few images in flight and
 * leaves the other connections to the requests that decide what the page shows.
 *
 * A URL that already loaded is answered without taking a slot: the browser's own
 * cache serves the bytes, so a second visit to a page costs no queue position.
 * Failures are not remembered here; the component that shows the image decides
 * what a failure means for its placeholder.
 */

/** How many images one page loads at once. */
export const MAX_IMAGE_LOADS = 4;

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

/** One queued or running request. */
interface Entry {
  /** The image URL. */
  readonly url: string;
  /** Settles the caller's promise, at most once. */
  settle(loaded: boolean): void;
  /** Starts the request, reporting its outcome to the gate. */
  start(report: (loaded: boolean) => void): void;
  /** Aborts a running request and reports the failure. */
  abort(): void;
}

/**
 * Builds a loader over a fixed concurrency.
 *
 * @param max How many images may be in flight at once.
 * @param makeImage Creates the image element a request runs through, which a
 * test replaces with a fake.
 * @returns The loader.
 */
export function createImageLoader(
  max: number,
  makeImage: () => HTMLImageElement = () => new Image()
): ImageLoader {
  const loaded = new Set<string>();
  const queue: Entry[] = [];
  let inFlight = 0;

  const pump = (): void => {
    while (inFlight < max && queue.length > 0) {
      const entry = queue.shift() as Entry;
      inFlight += 1;
      let reported = false;
      entry.start((ok) => {
        if (reported) return;
        reported = true;
        inFlight -= 1;
        if (ok) loaded.add(entry.url);
        entry.settle(ok);
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
          image.onload = () => report(true);
          image.onerror = () => report(false);
          image.src = url;
          abort = () => {
            image.onload = null;
            image.onerror = null;
            image.src = '';
            report(false);
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
