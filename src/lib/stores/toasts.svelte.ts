/**
 * The toast stack.
 *
 * Short-lived messages the shell renders in its corner: a failed upload, an
 * acquisition that could not be completed, a server notice. Each toast carries
 * a severity the shell styles and a lifetime after which it dismisses itself.
 */
import type { EventOf, EventStream } from './events.svelte';

/** How much attention a toast asks for. */
export type ToastLevel = 'info' | 'warn' | 'error';

/** One message in the stack. */
export interface Toast {
  /** The toast's identity, unique within the stack. */
  id: number;
  /** The severity the shell styles. */
  level: ToastLevel;
  /** The message shown. */
  message: string;
}

/** How long a toast stays before it dismisses itself, in milliseconds. */
export const TOAST_LIFETIME_MS = 6000;

/** The toast stack. */
export class ToastStore {
  /** The messages on screen, oldest first. */
  items = $state<Toast[]>([]);

  #nextId = 1;

  /**
   * Adds a message and schedules its dismissal.
   *
   * @param message The message shown.
   * @param level The severity to style it with.
   * @returns The new toast's id.
   */
  push(message: string, level: ToastLevel = 'info'): number {
    const id = this.#nextId++;
    this.items = [...this.items, { id, level, message }];
    setTimeout(() => this.dismiss(id), TOAST_LIFETIME_MS);
    return id;
  }

  /**
   * Removes a message.
   *
   * Dismissing a toast the stack no longer holds, which is what the lifetime
   * timer does after a manual dismissal, changes nothing.
   *
   * @param id The id the toast was pushed with.
   * @returns Nothing.
   */
  dismiss(id: number): void {
    this.items = this.items.filter((toast) => toast.id !== id);
  }

  /**
   * Shows a server notice as a toast.
   *
   * @param event The notice to show.
   * @returns Nothing.
   */
  apply(event: EventOf<'system.notice'>): void {
    const level = event.data.level;
    this.push(event.data.message, level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'info');
  }

  /**
   * Follows a stream, showing every notice it publishes.
   *
   * @param stream The stream to follow.
   * @returns A function that stops following.
   */
  follow(stream: EventStream): () => void {
    return stream.on('system.notice', (event) => this.apply(event));
  }
}

/** The toast stack of the running client. */
export const toasts = new ToastStore();
