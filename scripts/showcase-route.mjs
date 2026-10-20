/**
 * Enables or removes the development-only component showcase route.
 *
 * The showcase lives in `dev/showcase/+page.svelte`, outside SvelteKit's route
 * tree, because it is a development page and must never reach a release build.
 * `npm run dev` runs this script with `on` first, which copies it to
 * `src/routes/ui-preview/+page.svelte` (a gitignored directory); `npm run build`
 * runs it with `off`, so the production bundle never contains the route.
 *
 * Usage: `node scripts/showcase-route.mjs on|off`
 */
import { copyFileSync, mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

/** The repository root, one level above this script. */
const root = path.resolve(import.meta.dirname, '..');
/** Where the page is kept in the repository. */
const source = path.join(root, 'dev', 'showcase', '+page.svelte');
/** The route directory the development server reads. */
const routeDirectory = path.join(root, 'src', 'routes', 'ui-preview');

const mode = process.argv[2];
if (mode === 'on') {
  mkdirSync(routeDirectory, { recursive: true });
  copyFileSync(source, path.join(routeDirectory, '+page.svelte'));
  process.stdout.write('showcase: enabled at /ui-preview\n');
} else if (mode === 'off') {
  rmSync(routeDirectory, { recursive: true, force: true });
} else {
  process.stderr.write('usage: node scripts/showcase-route.mjs on|off\n');
  process.exitCode = 1;
}
