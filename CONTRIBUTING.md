# Contributing

Hearthsound is in early development and changes quickly, so please open an
issue to discuss a change before starting work on it.

Contributions are licensed AGPL-3.0-or-later.

## Checks

Every change must pass the same checks that continuous integration runs:

```sh
npm run lint && npm run check && npm run test:unit && npm run build
```

`npm run lint` runs ESLint and checks that every file is formatted with
Prettier (`npm run format` rewrites files). `npm run check` runs `svelte-check`
against the project's TypeScript configuration. `npm run build` must leave
`build/index.html` in place, because that is the document the server serves.

## Style

- Source files are ASCII only.
- Every exported function and class carries a TSDoc block with `@param` and
  `@returns` where they apply, and every TypeScript module starts with a module
  header comment.
- Components are written with Svelte 5 runes, and shared state lives in
  `*.svelte.ts` modules.

## End-to-end tests

The end-to-end suite drives a real Hearthsound server through a browser. It
needs:

- a Hearthsound core checkout containing a built debug binary
  (`cargo build -p hearthsound`) and the fixture plugins (`cargo xtask fixtures`),
  located at `HEARTHSOUND_SRC` (default `../hearthsound`);
- `ffmpeg` on the path, used to generate the test audio;
- the Chromium build for Playwright (`npx playwright install chromium`).

Then run:

```sh
npm run test:e2e
```
