/**
 * The server's event stream.
 *
 * The client opens one `EventSource` against `/api/v1/events` once a session is
 * signed in. The browser authenticates it with the session cookie and resumes
 * it with `Last-Event-ID` after a dropped connection, so the store only has to
 * dispatch each frame to the interested parties by its event type. When the
 * server cannot replay what the client missed it sends a `system.notice` with
 * the code `events-lost`; the store bumps {@link EventStore.resync} so the
 * views that render live state refetch it over REST.
 *
 * The web does not ask for a stream ticket: a browser sends the session cookie
 * with the connection and resumes it with `Last-Event-ID`, which a single-use
 * ticket URL cannot do. The ticket route and its per-account cap therefore stay
 * a server contract for clients that cannot present a cookie.
 */
import type {
  AcquisitionState,
  Availability,
  FailureReason,
  ParkReason,
  PrefetchDecision,
  Priority
} from '#lib/subsonic/types';

/** The payload of an `acquisition.updated` event. */
export interface AcquisitionUpdatedPayload {
  /** The acquisition's client id. */
  acquisitionId: string;
  /** The client id of the track or album being acquired. */
  targetId: string;
  /** The acquisition's current state. */
  state: AcquisitionState;
  /** The acquisition's current priority. */
  priority: Priority;
  /** The download progress as a whole percentage, when one is known. */
  percent?: number;
  /** The estimated seconds until the download completes, when known. */
  etaSecs?: number;
  /** The slug of the provider instance serving the acquisition. */
  instance?: string;
  /** Why the acquisition failed, when it has failed. */
  failureReason?: FailureReason;
  /** Whether the acquisition waits for a download source rather than running. */
  awaitingSource?: boolean;
  /** Why it waits, when the server named the cause. */
  parkReason?: ParkReason;
}

/** The payload of a `track.availability` event. */
export interface TrackAvailabilityPayload {
  /** The track's client id. */
  trackId: string;
  /** The track's new availability. */
  availability: Availability;
}

/** The payload of a `library.changed` event. */
export interface LibraryChangedPayload {
  /** The kind of the entity that changed. */
  entityKind: string;
  /** The entity's client id. */
  entityId: string;
  /** What happened to the entity. */
  change: 'added' | 'removed';
}

/** The payload of a `playlist.changed` event. */
export interface PlaylistChangedPayload {
  /** The playlist's client id. */
  playlistId: string;
  /** What happened to the playlist. */
  change: string;
}

/** The payload of an `upload.updated` event. */
export interface UploadUpdatedPayload {
  /** The upload's client id. */
  uploadId: string;
  /** The upload's state. */
  state: string;
  /** The number of bytes received so far. */
  bytesReceived: number;
  /** The number of bytes the upload promised to send. */
  totalBytes: number;
}

/** The payload of a `scan.progress` event. */
export interface ScanProgressPayload {
  /** The scanned folder's client id. */
  folderId: string;
  /** The scan's current phase. */
  phase: string;
  /** The number of files seen so far. */
  filesSeen: number;
  /** The number of files processed so far. */
  filesDone: number;
  /** The error that stopped the scan, when it failed. */
  error?: string;
}

/** The payload of a `plugin.status` event. */
export interface PluginStatusPayload {
  /** The plugin's client id. */
  pluginId: string;
  /** The instance the status belongs to, when it belongs to one. */
  slug?: string;
  /** The plugin lifecycle state, or the health state the host reported. */
  state: string;
  /** A human-readable detail. */
  detail?: string;
}

/** The payload of a `queue.prefetch` event. */
export interface QueuePrefetchPayload {
  /** The client whose queue the prefetch was inferred from. */
  client: string;
  /** The prefetched track's client id. */
  trackId: string;
  /** The priority the prefetch ran at. */
  priority: Priority;
  /** Whether the prefetch was started or dropped. */
  state: PrefetchDecision;
}

/** The payload of an `entity.updated` event. */
export interface EntityUpdatedPayload {
  /** The entity kind: `track`, `album` or `artist`. */
  kind: 'track' | 'album' | 'artist';
  /** The entity's client id, as every surface names it. */
  id: string;
}

/** The payload of an `index.progress` event. */
export interface IndexProgressPayload {
  /** How many entities are waiting to be indexed. */
  pending: number;
  /** How many entities failed their last pass and wait for a retry. */
  failed: number;
  /** How many entities this process has indexed. */
  done: number;
  /** How many entities this process has claimed. */
  total: number;
}

/** The payload of a `system.notice` event. */
export interface SystemNoticePayload {
  /** The notice's severity. */
  level: string;
  /** The message shown to the client. */
  message: string;
  /** A machine-readable code, when the notice has one. */
  code?: string;
}

/** The payloads the event stream carries, by event type. */
export interface EventPayloads {
  'acquisition.updated': AcquisitionUpdatedPayload;
  'track.availability': TrackAvailabilityPayload;
  'library.changed': LibraryChangedPayload;
  'playlist.changed': PlaylistChangedPayload;
  'upload.updated': UploadUpdatedPayload;
  'scan.progress': ScanProgressPayload;
  'plugin.status': PluginStatusPayload;
  'queue.prefetch': QueuePrefetchPayload;
  'system.notice': SystemNoticePayload;
  'entity.updated': EntityUpdatedPayload;
  'index.progress': IndexProgressPayload;
}

/** Every event type the server publishes. */
export type EventType = keyof EventPayloads;

/** Every event type, in the order the server documents them. */
const EVENT_TYPES: readonly EventType[] = [
  'acquisition.updated',
  'track.availability',
  'library.changed',
  'playlist.changed',
  'upload.updated',
  'scan.progress',
  'plugin.status',
  'queue.prefetch',
  'system.notice',
  'entity.updated',
  'index.progress'
];

/** One event of the stream, narrowed by its type. */
export type ServerEvent = {
  [T in EventType]: {
    /** The event's sequence number. */
    id: number;
    /** The event type. */
    type: T;
    /** When the server published the event, in unix milliseconds. */
    at: number;
    /** The type-specific payload. */
    data: EventPayloads[T];
  };
}[EventType];

/** One event of a given type. */
export type EventOf<T extends EventType> = Extract<ServerEvent, { type: T }>;

/** A handler for one event type. */
export type EventHandler<T extends EventType> = (event: EventOf<T>) => void;

/** A source of typed server events, as {@link EventStore} provides them. */
export interface EventStream {
  /**
   * Registers a handler for one event type.
   *
   * @param type The event type to listen for.
   * @param handler The handler to call.
   * @returns A function that unregisters the handler.
   */
  on<T extends EventType>(type: T, handler: EventHandler<T>): () => void;
}

/** The part of the browser's `EventSource` the store drives. */
export interface EventSourceLike {
  /**
   * Registers a listener for one stream event.
   *
   * @param type The event name: an event type, `open` or `error`.
   * @param listener The listener to call.
   */
  addEventListener(type: string, listener: (event: { data?: string }) => void): void;
  /** Closes the connection. */
  close(): void;
}

/** The path the stream is served from. */
export const EVENTS_PATH = '/api/v1/events';

/** The notice code that tells the client its state is stale. */
export const EVENTS_LOST_CODE = 'events-lost';

/** Options of an {@link EventStore}. */
export interface EventStoreOptions {
  /** Builds the connection; tests replace it with a fake. */
  createSource?: (url: string) => EventSourceLike;
}

/**
 * Wraps the browser's `EventSource` in the small surface the store uses.
 *
 * @param url The stream URL.
 * @returns The wrapped connection.
 */
function openEventSource(url: string): EventSourceLike {
  const source = new EventSource(url);
  return {
    addEventListener: (type, listener) =>
      source.addEventListener(type, (event) => listener(event as MessageEvent<string>)),
    close: () => source.close()
  };
}

/**
 * The client's single connection to the server event stream.
 *
 * Handlers are keyed by event type; a view subscribes to the types it renders
 * and gets only those frames. The store owns the connection, so several views
 * share one stream.
 */
export class EventStore implements EventStream {
  /** How often the server told the client that it lost events. */
  resync = $state(0);

  readonly #createSource: ((url: string) => EventSourceLike) | null;
  readonly #handlers: { [T in EventType]?: ((event: ServerEvent) => void)[] } = {};
  #source: EventSourceLike | null = null;

  /**
   * Builds a store.
   *
   * @param options The connection factory to use.
   */
  constructor(options: EventStoreOptions = {}) {
    this.#createSource = options.createSource ?? null;
  }

  /**
   * Registers a handler for one event type.
   *
   * @param type The event type to listen for.
   * @param handler The handler to call.
   * @returns A function that unregisters the handler.
   */
  on<T extends EventType>(type: T, handler: EventHandler<T>): () => void {
    const adapter = (event: ServerEvent): void => {
      if (event.type === type) {
        handler(event as EventOf<T>);
      }
    };
    this.#handlers[type] = [...(this.#handlers[type] ?? []), adapter];
    return () => {
      this.#handlers[type] = (this.#handlers[type] ?? []).filter(
        (registered) => registered !== adapter
      );
    };
  }

  /**
   * Opens the stream, unless it is already open or the environment has no
   * `EventSource`.
   *
   * Every event type is listened for, because the connection cannot learn about
   * a type once it is open; a view subscribes to the types it renders whenever
   * it mounts.
   *
   * @param url The stream URL.
   * @returns Nothing.
   */
  open(url: string = EVENTS_PATH): void {
    if (this.#source !== null) {
      return;
    }
    if (this.#createSource === null && typeof EventSource === 'undefined') {
      return;
    }
    const source = (this.#createSource ?? openEventSource)(url);
    for (const type of EVENT_TYPES) {
      source.addEventListener(type, (event) => this.#receive(event.data));
    }
    this.#source = source;
  }

  /**
   * Closes the stream.
   *
   * @returns Nothing.
   */
  close(): void {
    this.#source?.close();
    this.#source = null;
  }

  /**
   * Dispatches a frame to the handlers of its event type, and counts the
   * `events-lost` notice.
   *
   * @param data The frame's `data` field, holding the event envelope.
   * @returns Nothing.
   */
  #receive(data: string | undefined): void {
    if (data === undefined) {
      return;
    }
    let event: ServerEvent;
    try {
      event = JSON.parse(data) as ServerEvent;
    } catch {
      return;
    }
    if (event.type === 'system.notice' && event.data.code === EVENTS_LOST_CODE) {
      this.resync += 1;
    }
    for (const handler of this.#handlers[event.type] ?? []) {
      handler(event);
    }
  }
}

/** The client's single connection to the server event stream. */
export const events = new EventStore();
