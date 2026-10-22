/**
 * Whether the server answers.
 *
 * The API layers report every request into this store: a request that never
 * reaches the server sets the unreachable state, and any answer clears it. The
 * shell draws the p27 unreachable banner from it. Its Retry action probes the
 * public setup status, which tells the client whether the server is back
 * without touching the session or the page underneath.
 */

/** The path the Retry action probes; it needs no session. */
const PROBE_PATH = '/api/v1/setup';

/** The client's view of the server's reachability. */
export class ConnectionStore {
  /** Whether a request failed to reach the server. */
  unreachable = $state(false);

  /** Whether a Retry probe is in flight. */
  retrying = $state(false);

  /**
   * Records a request that never reached the server.
   *
   * @returns Nothing.
   */
  failed(): void {
    this.unreachable = true;
  }

  /**
   * Records that the server answered, however it answered.
   *
   * @returns Nothing.
   */
  answered(): void {
    this.unreachable = false;
  }

  /**
   * Probes the server and clears the banner when it answers.
   *
   * Any HTTP answer means the server is reachable, including an error status;
   * only a rejected request keeps the banner up.
   *
   * @returns Nothing.
   */
  async retry(): Promise<void> {
    if (this.retrying) {
      return;
    }
    this.retrying = true;
    try {
      await fetch(PROBE_PATH, {
        method: 'GET',
        credentials: 'same-origin',
        headers: { accept: 'application/json' }
      });
      this.answered();
    } catch {
      this.failed();
    } finally {
      this.retrying = false;
    }
  }
}

/** The client's view of the server's reachability. */
export const connection = new ConnectionStore();
