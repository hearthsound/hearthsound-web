# Contributing

Hearthsound is in early development and changes quickly, so please open an
issue to discuss a change before starting work on it.

Do not commit copyrighted audio.

Contributions are licensed AGPL-3.0-or-later.

## Checks

Every change must pass the same checks that continuous integration runs:

```sh
npm run lint && npm run check && npm run api:check && npm run test:unit && npm run build
```

`npm run lint` runs ESLint and checks that every file is formatted with
Prettier (`npm run format` rewrites files). `npm run check` runs `svelte-check`
against the project's TypeScript configuration. `npm run api:check` fails when
`schema.d.ts` no longer matches the committed OpenAPI document. `npm run build`
must leave `build/index.html` in place, because that is the document the server
serves for every client route.

The end-to-end suite is part of the gate as well. Run the full suite, never a
subset of it, against a core checkout:

```sh
HEARTHSOUND_SRC=../hearthsound npm run test:e2e
```

## Style

- Source files are ASCII only.
- Every exported function, class, type and module is documented: TypeScript
  modules start with a header comment and exported items carry TSDoc with
  `@param` and `@returns` where they apply; a Svelte component opens with a
  header comment that says what it draws and how it is used.
- Components are written with Svelte 5 runes, and shared reactive state lives in
  `*.svelte.ts` modules.
- Components render the `hs-*` classes of `@hearthsound/design`. A scoped
  `<style>` block holds layout glue only, with a comment that says why the
  package cannot express it; it never restates a colour, type scale, radius or
  spacing value the tokens already provide.
- Never edit `@hearthsound/design` from this repository. A design change belongs
  in the package and arrives as a version bump.
- Admin pages call the server through the per-area facades in
  `src/lib/admin/api/`, never through the native client directly.
- Do not add a dependency without discussing it first.

## Testing

`npm run test:unit` runs two Vitest projects, both configured in
`vite.config.ts`:

- `unit` runs every co-located `*.test.ts` in Node. This is where pure modules
  and stores are tested.
- `component` runs `*.component.test.ts` in jsdom. These files mount the
  components with `@testing-library/svelte`; `@testing-library/user-event` is
  available for user interactions.

Tests assert what a user can observe: behavior, boundaries, state transitions
and error handling. They do not assert wiring, internal call sequences or the
text of the source; a test that reads a file to look for a string is not a test
of the product.

## End-to-end tests

The end-to-end suite drives the built client against a real Hearthsound server
through Chromium. The Playwright global setup in `scripts/e2e-server.mjs`
creates a temporary data directory, generates the test audio, installs the
fixture plugins and starts `hearthsound serve`; teardown stops it and removes
the directory. Nothing reaches the network.

It needs:

- a Hearthsound core checkout containing a built debug binary
  (`cargo build -p hearthsound`) and the fixture plugins (`cargo xtask fixtures`),
  located at `HEARTHSOUND_SRC` (default `../hearthsound`);
- `ffmpeg` on the path, used to generate the test audio;
- the Chromium build for Playwright (`npx playwright install chromium`).

Then run:

```sh
HEARTHSOUND_SRC=../hearthsound npm run test:e2e
```

`test:e2e` builds the site first and then runs the specs in `tests/e2e/`. They
run in file order in one worker, because the first-run wizard has to create the
administrator before the views that need one. Continuous integration checks out
the core commit recorded in `api/SOURCE.json` for this job, so the client is
always tested against the server whose API it was generated from.

## Extending the client

### Adding a library kind

The library views are declared once and the navigation and route table follow.

1. Add the segment to `LIBRARY_KINDS` and an entry to `LIBRARY_KIND_INFO` in
   `src/lib/library/kinds.ts`: the `id`, the `title` used by the page and the
   sidebar, the 16 px `icon`, the `href` (always `/library/<id>`) and, when the
   view's Play action queues a collection, its `queueSource`. Add
   `requiresUpload: true` when the view is offered only to an account that may
   upload.
2. Add the view component to `src/lib/library/` and draw it in
   `src/lib/library/LibraryView.svelte`.

The sidebar's Library section comes from the registry, and `src/lib/routes.ts`
adds the route with its own header, so neither needs an edit. A URL segment no
kind names is answered with the Not Found page, and the uploads kind is hidden
when the account may not upload.

### Adding an administration page

1. Add the row to `adminSections` in `src/lib/nav.ts` with its `href`, `label`
   and icon. The sidebar and the route registry derive from this list; every
   administration route except `/admin` draws its own header.
2. Add the area's facade to `src/lib/admin/api/`, one module per area, over
   `nativeClient` and the `AdminResult` helpers in `admin/api/result.ts`. This is
   where the admin endpoint calls belong.
3. Add the page at `src/routes/admin/<area>/+page.svelte`, with a `PageHeader`
   and whatever area module shapes its data.
4. If the area has a count, add its card to `ADMIN_CARDS` in
   `src/lib/admin/overview.ts`. A card names its `id`, `title`, `icon`, `href`,
   the `read` that supplies its count and the `body` that shapes it for the
   overview page. The page reads the cards from that registry, so it needs no
   edit.

The administration guard in `src/routes/admin/+layout.ts` already refuses the
area to a signed-in account that is not an administrator.

### Adding a server setting

A new setting usually needs no client change: the settings page reads every
registered setting from the server, groups the rows by the first segment of the
key and picks a control from the value's kind. Add a readable name only when the
row needs one:

- add the key and its name to `SETTING_NAMES` in
  `src/lib/admin/setting-names.ts`; a key without an entry falls back to its leaf
  segment;
- add a label to `CHOICE_LABELS` when the setting accepts enumerated values whose
  tokens need readable wording.

### Updating the API types

The native API contract lives in the core repository, so the core change lands
first:

1. In `hearthsound/hearthsound`, change the handler and run `cargo xtask openapi`
   to regenerate `crates/api-native/openapi.json`. Commit that.
2. In this repository, run
   `npm run api:sync -- ../hearthsound/crates/api-native/openapi.json`. The script
   copies the document to `api/openapi.json`, records the source commit and
   server version in `api/SOURCE.json`, and regenerates
   `src/lib/api/schema.d.ts`. It also accepts a URL, in which case pass
   `--commit <sha>` because a download carries no git history.
3. Run `npm run api:check`. The generated schema and the copied document are
   never edited by hand; `.prettierignore` keeps them out of formatting, and the
   check fails when the schema no longer matches the document.
