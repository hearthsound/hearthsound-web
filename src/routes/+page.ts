/**
 * The root route: the client opens the personal library.
 *
 * A browser that is not signed in never reaches here, because the shell's boot
 * sequence sends it to the sign-in form first.
 */
import { redirect } from '@sveltejs/kit';

/** Sends the browser to the albums of the personal library. */
export function load(): void {
  redirect(307, '/library/albums');
}
