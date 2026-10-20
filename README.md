# Hearthsound web client

The first-party web client for [Hearthsound](https://github.com/hearthsound/hearthsound),
a self-hostable music server. It is a static single-page application built with
SvelteKit: the server serves the built files from its origin root, and every
request for data goes to the server's own APIs.

## Development

The client expects a running Hearthsound server and is developed against a
local one:

1. Install the dependencies with `npm install`.
2. Start a Hearthsound server. The client proxies API and media requests to
   `http://localhost:4327`; set `HEARTHSOUND_DEV_SERVER` to another origin when
   the server listens elsewhere.
3. Run `npm run dev` and open the printed URL.

The development server proxies `/rest`, `/api`, `/healthz` and `/readyz` to the
configured server, so the client talks to the server from its own origin and
cookies behave as they do in production. A production build is served by the
server itself: `npm run build` writes the site to `build/`, and the server
serves those files from its origin root.

## Scripts

| Script              | What it does                                                        |
| ------------------- | ------------------------------------------------------------------- |
| `npm run dev`       | Starts the development server.                                      |
| `npm run build`     | Builds the static site into `build/`.                               |
| `npm run preview`   | Serves the last build locally.                                      |
| `npm run check`     | Runs `svelte-check` against the project's TypeScript configuration. |
| `npm run lint`      | Runs ESLint and checks formatting with Prettier.                    |
| `npm run format`    | Rewrites files with Prettier.                                       |
| `npm run test:unit` | Runs the unit tests with Vitest.                                    |
| `npm run test:e2e`  | Runs the end-to-end tests with Playwright.                          |
| `npm run api:sync`  | Regenerates the API types from the server's OpenAPI document.       |
| `npm run api:check` | Fails when the committed API types are out of date.                 |
| `npm run package`   | Builds the release archive for the current version.                 |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

AGPL-3.0-or-later. See [LICENSE](LICENSE).

## Component showcase (development only)

`npm run dev` copies `dev/showcase/+page.svelte` to `src/routes/ui-preview/` (a
gitignored directory) and serves it at `/ui-preview`: every component in
`src/lib/ui`, in all of its states, light and dark. `npm run build` removes that
directory again, so a release build never contains the page. The page is the
visual regression reference for the design package: compare it with
`@hearthsound/design`'s specimen page after a package update.
