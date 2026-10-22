# Hearthsound web client

The first-party web client for [Hearthsound](https://github.com/hearthsound/hearthsound),
a self-hostable music server. It is a static single-page application: the server
serves the built files from its origin root, and every request for data goes to
the server's own APIs. Library browsing and playback use the Subsonic `/rest`
surface; the player's queue collection, uploads, administration, setup and the
session use the native `/api/v1` API.

## Stack

- SvelteKit 3 with `@sveltejs/adapter-static`. The build writes `build/`, and
  `fallback: index.html` makes every client route resolve to the entry document.
- Svelte 5 with runes only: `$state`, `$derived`, `$props`, `$effect` and the
  other rune forms. Shared reactive state lives in `*.svelte.ts` modules.
- TypeScript in strict mode, checked by `svelte-check`.
- Vite 8 and Vitest 5 for unit and component tests, Playwright for end-to-end
  tests.
- The visual design is the npm package `@hearthsound/design`, pinned to the
  exact version in `package.json`.

## Development

The client expects a running Hearthsound server and is developed against a
local one. Use Node 22.17 or newer, the minimum `package.json` declares.

1. Install the dependencies with `npm install`.
2. Start a Hearthsound server. The client proxies API and media requests to
   `http://localhost:4327`; set `HEARTHSOUND_DEV_SERVER` to another origin when
   the server listens elsewhere.
3. Run `npm run dev` and open the printed URL.

The development server proxies `/rest`, `/api`, `/healthz` and `/readyz` to the
configured server, so the client talks to the server from its own origin and
cookies behave as they do in production. A production build is served by the
server itself: `npm run build` writes the site to `build/`, and the server
serves those files from its origin root, falling back to `index.html` for a
client route.

## Scripts

| Script              | What it does                                                            |
| ------------------- | ----------------------------------------------------------------------- |
| `npm run dev`       | Starts the development server.                                          |
| `npm run build`     | Builds the static site into `build/`.                                   |
| `npm run preview`   | Serves the last build locally.                                          |
| `npm run check`     | Runs `svelte-check` against the project's TypeScript configuration.     |
| `npm run lint`      | Runs ESLint and checks formatting with Prettier.                        |
| `npm run format`    | Rewrites files with Prettier.                                           |
| `npm run test:unit` | Runs the unit and component tests with Vitest.                          |
| `npm run test:e2e`  | Builds the site, then runs the end-to-end tests with Playwright.        |
| `npm run api:sync`  | Regenerates the API types from a server's OpenAPI document.             |
| `npm run api:check` | Fails when the generated types no longer match the committed document.  |
| `npm run predev`    | Copies the component showcase into the route tree; `dev` runs it first. |
| `npm run prebuild`  | Removes the showcase route; `build` runs it first.                      |

## Project layout

| Path                  | What lives there                                                                                                                                                           |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/routes/`         | The SvelteKit pages. `+layout.ts` turns off server-side rendering and prerendering, and `+error.svelte` draws the status pages inside the shell.                           |
| `src/lib/ui/`         | Design-system primitives, one component per design-spec k-number. They render the package's `hs-*` classes; a scoped `<style>` holds only layout glue.                     |
| `src/lib/components/` | Application composites: the player bar, now playing with `LyricsPanel` and `QueuePanel`, the song row, the drawer, the account menu, and the album and artist cards.       |
| `src/lib/library/`    | The library views, the feedback and playlist controls, the upload pipeline, and `kinds.ts`, the library kind registry the sidebar and route table derive from.             |
| `src/lib/home/`       | `HomeView`, the `CustomizeHome` dialog and `sections.ts`, the registry of Home sections and their full-list routes.                                                        |
| `src/lib/search/`     | The results list and the Top Result card.                                                                                                                                  |
| `src/lib/setup/`      | The first-run wizard: its steps, the layer order state and the steps registry.                                                                                             |
| `src/lib/admin/`      | The administration views, their dialogs and area modules. `admin/api/` holds the per-area facades that call the admin endpoints; `overview.ts` defines the `/admin` cards. |
| `src/lib/player/`     | The player core (`player`, `audio`, `queue`, `now-playing`), the media session, the queue declaration, playback settings and the fetch-state helpers.                      |
| `src/lib/stores/`     | The session, event stream, availability, connection, toast and appearance stores.                                                                                          |
| `src/lib/subsonic/`   | The `/rest` transport, its wire types and the library facade.                                                                                                              |
| `src/lib/api/`        | The native API client (`native.ts`) and the generated OpenAPI types (`schema.d.ts`).                                                                                       |
| `src/lib/jsonforms/`  | The JSON Forms renderer set that turns a plugin's configuration schema into controls.                                                                                      |
| `src/lib/*.ts`        | Shared modules at the library root: the route registry, paging, navigation, shell and search navigation, formatting, labels and the search field.                          |
| `api/`                | The committed OpenAPI document (`openapi.json`) and `SOURCE.json`, which records the core commit and server version it came from.                                          |
| `scripts/`            | The showcase route switch, the API sync script, and the Playwright server setup and teardown.                                                                              |
| `tests/e2e/`          | The Playwright suite.                                                                                                                                                      |
| `dev/showcase/`       | The development-only component showcase page, copied into the route tree by `npm run dev`.                                                                                 |

The shared modules at the `src/lib/` root are:

- `routes.ts` - the route registry. It derives which routes draw their own
  header from the library kinds, the Home sections and the administration rows,
  so a new entry in one of those registries needs no edit here.
- `library/kinds.ts` - the library kind registry: route segment, title, icon,
  route and, where the view has one, the collection its Play action queues. The
  sidebar's Library section and the route table derive from it.
- `paging.svelte.ts` - `PagedList`, the shared "Load more" paging state over
  either an offset or an opaque cursor.
- `navigation.ts` - `navigate`, `goBack` and `clientRoute`, the one place a
  client route is resolved against the deployment's paths.
- `nav.ts` - the sidebar sections and the administration area's rows, including
  the visibility rules.
- `nav-context.ts` - builds the session's navigation context.
- `shell-navigation.ts` - the "Open Navigation" command a page that draws its
  own header takes from the shell.
- `search-navigation.ts` - where the search results return to when the query is
  cleared.
- `format.ts` - durations, byte counts and the other shared formatting.
- `labels.ts` - the fixed wording of availability, acquisition progress and
  queue prefetch state.
- `config-object.ts` - turns an edited configuration back into the request body
  the generated types describe.
- `search-field.svelte.ts` - the search field's tie to the address's `?q=`.

## Design package

`@hearthsound/design` supplies the design language: tokens, fonts, icons and the
component stylesheets. It is pinned to an exact version in `package.json`
(currently `0.2.7`); do not replace the pin with a range. `src/routes/+layout.svelte`
imports `@hearthsound/design/index.css` once, and components use the package's
`hs-*` classes and `--hs-*` tokens. Icons come from
`@hearthsound/design/icons`; the lockup and favicon come from the package's
identity files.

To update the package:

1. Change the exact version in `package.json` and run `npm install`.
2. Start the development server and open `/ui-preview`.
3. Compare that showcase with the package's specimen page, which its repository
   generates with `npm run specimen`, and fix any component whose states no
   longer match the design.

There is no local-checkout override of the package: the dependency resolves from
npm like any other, and the package is never edited from this repository.

## Component showcase (development only)

`npm run dev` copies `dev/showcase/+page.svelte` to `src/routes/ui-preview/` (a
gitignored directory) and serves it at `/ui-preview`: every component in
`src/lib/ui`, in all of its states, light and dark. `npm run build` removes that
directory again, so a release build never contains the page. The page is the
visual regression reference for the design package: compare it with
`@hearthsound/design`'s specimen page after a package update.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

AGPL-3.0-or-later. See [LICENSE](LICENSE).
