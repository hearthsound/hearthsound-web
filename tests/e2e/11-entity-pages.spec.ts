/**
 * Unified artist and album pages by id.
 *
 * An artist page is the artist's whole discography whichever id opened it: the
 * catalog's albums with the library's own in their places, marked when the
 * library holds them. An album page is the whole tracklist the same way, with
 * the songs the library holds marked, the release details under the hero and
 * the artist's other albums beside it. The spec saves one catalog song, so the
 * artist and its album are in the personal library, and then reaches the pages
 * by the id the native search answered and from the pages themselves.
 *
 * The pages read the native entity endpoints, so what the spec asserts about
 * links, similar artists and "More by" is what those endpoints answered.
 */
import { expect, test } from '@playwright/test';
import type { BrowserContext, Page } from '@playwright/test';

import {
  api,
  createProvider,
  INDEX_WAIT_MS,
  nativeSearch,
  restPost,
  setLayer,
  signIn,
  sleep,
  state
} from './support';
import type { NativeAlbum, NativeArtist } from './support';

/** The plugin id of the discography catalog fixture. */
const DISCOGRAPHY_CATALOG = 'com.example.discography-catalog';

/** The instance slug the spec gives the discography fixture. */
const DISCOGRAPHY_SLUG = 'disco';

/** The artist the discography fixture holds. */
const DISCOGRAPHY_ARTIST = 'Discography Artist';

/** The remastered album the saved song belongs to. */
const SECOND_WIND = 'Second Wind (Remastered 2009)';

/** The song the spec saves; the other two tracks stay in the catalog. */
const SAVED_SONG = 'Breeze';

/** The labels the artist page shows for the link kinds it names. */
const LINK_LABELS: Record<string, string> = {
  homepage: 'Website',
  wikipedia: 'Wikipedia',
  wikidata: 'Wikidata',
  lastfm: 'Last.fm',
  discogs: 'Discogs',
  allmusic: 'AllMusic',
  bandcamp: 'Bandcamp',
  musicbrainz: 'MusicBrainz'
};

/** The labels the album page shows for the release types it names. */
const TYPE_LABELS: Record<string, string> = {
  album: 'Album',
  ep: 'EP',
  single: 'Single',
  compilation: 'Compilation',
  live: 'Live',
  remix: 'Remix',
  soundtrack: 'Soundtrack'
};

/** One artist page's answer, as the spec reads the endpoints. */
interface ArtistAnswer {
  /** The artist's client id. */
  id: string;
  /** The display name. */
  name: string;
  /** The stored links. */
  links: { kind: string; url: string }[];
  /** The discography. */
  albums: NativeAlbum[];
  /** Similar artists. */
  similarArtists: NativeArtist[];
  /** Whether the stored data covers the page. */
  complete: boolean;
}

/** One album page's answer, as the spec reads the endpoints. */
interface AlbumAnswer {
  /** The album's client id. */
  id: string;
  /** The title. */
  title: string;
  /** The release date, when the provider stated one. */
  releaseDate: string | null;
  /** The release year. */
  year: number | null;
  /** The release type. */
  albumType: string | null;
  /** The edition label. */
  edition: string | null;
  /** The display artist. */
  displayArtist: string | null;
  /** The credited artists. */
  artists: { id: string; name: string }[];
  /** The tracks, in disc and track order. */
  tracks: { id: string; title: string }[];
  /** The primary artist's other albums. */
  moreByArtist: NativeAlbum[];
  /** Whether the stored data covers the page. */
  complete: boolean;
}

/** The catalog layer as the spec found it, so it can be put back. */
let previousLayer: string[] = [];

/** Whether the fixture is already in service for this run. */
let seeded = false;

/**
 * Reads one entity page from the native API.
 *
 * @param context The browser context, signed in.
 * @param route The page's route, starting with `/api/v1/`.
 * @returns The answer.
 */
async function readJson<T>(context: BrowserContext, route: string): Promise<T> {
  const response = await api(context, 'GET', route);
  return (await response.json()) as T;
}

/**
 * Waits until the server's stored data covers one entity page.
 *
 * The indexer walks a cold entity inline up to `index.view_timeout_ms` and
 * publishes `entity.updated` when the rest is stored, so the pages fill in
 * after the first answer.
 *
 * @param context The browser context, signed in.
 * @param route The page's route.
 * @returns The complete answer.
 */
async function completePage<T extends { complete: boolean }>(
  context: BrowserContext,
  route: string
): Promise<T> {
  for (let attempt = 0; attempt < 40; attempt++) {
    const answer = await readJson<T>(context, route);
    if (answer.complete) {
      return answer;
    }
    await sleep(500);
  }
  throw new Error(`${route} never reported complete data`);
}

/**
 * Puts the discography fixture in service and saves one of its songs.
 *
 * The instance goes first in the catalog layer, so every page the spec opens
 * reads its albums from it. The saved song is what puts the artist and its
 * album in the personal library, which is what the pages then mark.
 *
 * @param context The browser context, signed in as the administrator.
 * @returns Nothing.
 */
async function seedDiscography(context: BrowserContext): Promise<void> {
  if (seeded) {
    return;
  }
  seeded = true;
  const listed = (await (await api(context, 'GET', '/api/v1/admin/providers')).json()) as {
    providers?: { slug: string }[];
  };
  if (!(listed.providers ?? []).some((provider) => provider.slug === DISCOGRAPHY_SLUG)) {
    await createProvider(context, {
      slug: DISCOGRAPHY_SLUG,
      pluginId: DISCOGRAPHY_CATALOG,
      displayName: 'Discography catalog',
      serverConfig: {},
      hostConfig: null
    });
  }
  const layer = (await (await api(context, 'GET', '/api/v1/admin/layers')).json()) as {
    layers?: { layer: string; instances: string[] }[];
  };
  const catalog = (layer.layers ?? []).find((entry) => entry.layer === 'catalog');
  previousLayer = (catalog?.instances ?? []).filter((slug) => slug !== DISCOGRAPHY_SLUG);
  await setLayer(context, 'catalog', [DISCOGRAPHY_SLUG, ...previousLayer]);

  // The instance becomes the layer's primary when the registry the write woke
  // has rebuilt, so the search is repeated until it answers from it.
  for (let attempt = 0; attempt < 20; attempt++) {
    const found = await nativeSearch(context, SAVED_SONG, 'tracks', 30);
    const song = found.tracks.find((entry) => entry.title === SAVED_SONG);
    if (song !== undefined) {
      await restPost(context, 'hsSave', { id: song.id });
      return;
    }
    if (attempt === 19) {
      throw new Error(`no ${SAVED_SONG} in the catalog answer`);
    }
    await sleep(500);
  }
}

/**
 * Returns the discography fixture's artist, as the native search answered it.
 *
 * @param context The browser context, signed in.
 * @returns The artist.
 */
async function findArtist(context: BrowserContext): Promise<NativeArtist> {
  const answer = await nativeSearch(context, DISCOGRAPHY_ARTIST, 'artists', 30);
  const artist = answer.artists.find((entry) => entry.name === DISCOGRAPHY_ARTIST);
  if (artist === undefined) {
    throw new Error(`no ${DISCOGRAPHY_ARTIST} in the native search`);
  }
  return artist;
}

/**
 * Returns the labels the artist page shows for the links the server stored.
 *
 * @param links The stored links.
 * @returns The visible labels.
 */
function visibleLinkLabels(links: readonly { kind: string }[]): string[] {
  return links.flatMap((link) => {
    const label = LINK_LABELS[link.kind];
    return label === undefined ? [] : [label];
  });
}

/**
 * Builds the album page's release detail line the way the page does.
 *
 * @param album The album's release fields.
 * @returns The date, type and edition that are known, joined by ` - `.
 */
function expectedReleaseDetails(album: AlbumAnswer): string {
  const date =
    album.releaseDate !== null && album.releaseDate.length === 10
      ? new Intl.DateTimeFormat(undefined, { dateStyle: 'long' }).format(
          new Date(`${album.releaseDate}T00:00:00`)
        )
      : album.year !== null && album.year > 0
        ? String(album.year)
        : undefined;
  const type = album.albumType === null ? undefined : TYPE_LABELS[album.albumType];
  const edition = album.edition === null || album.edition === '' ? undefined : album.edition;
  return [date, type, edition].filter((part) => part !== undefined).join(' - ');
}

/**
 * Opens one route of the client.
 *
 * @param page The page to navigate.
 * @param route The route, starting with `/`.
 * @returns Nothing.
 */
async function open(page: Page, route: string): Promise<void> {
  await page.goto(`${state().baseUrl}${route}`);
}

/**
 * Returns the marks a container shows for library membership.
 *
 * @param page The page to read.
 * @param container The selector of the list or grid that holds the items.
 * @returns The locator of the marks.
 */
function libraryMarks(page: Page, container: string) {
  return page.locator(container).getByRole('img', { name: 'In your library' });
}

test.beforeAll(async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await signIn(page);
  await seedDiscography(context);
  await context.close();
});

test.afterAll(async ({ browser }) => {
  if (previousLayer.length === 0) {
    return;
  }
  const context = await browser.newContext();
  const page = await context.newPage();
  await signIn(page);
  await setLayer(context, 'catalog', previousLayer);
  await context.close();
});

test('an artist page lists the whole discography and marks the library album', async ({
  page,
  context
}) => {
  await signIn(page);
  await seedDiscography(context);
  const artist = await findArtist(context);

  await open(page, `/artist/${artist.id}`);

  await expect(page.getByRole('heading', { name: DISCOGRAPHY_ARTIST })).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/artist/${artist.id}$`));
  const grid = page.locator('.album-grid');
  await expect(grid.getByRole('link', { name: SECOND_WIND })).toBeVisible();
  await expect(page.getByText('Nothing by this artist yet.')).toHaveCount(0);

  // The discography the catalog knows arrives in place, whether the first
  // answer was partial or not; the address does not move.
  const address = page.url();
  await expect(grid.locator('.hs-card--album')).toHaveCount(3, {
    timeout: INDEX_WAIT_MS
  });
  expect(page.url()).toBe(address);
  await expect(libraryMarks(page, '.album-grid')).toHaveCount(1);
  await expect(
    page.locator('.album-grid .hs-card').filter({ hasText: SECOND_WIND }).getByRole('img')
  ).toHaveAttribute('aria-label', 'In your library');

  // Top Songs is the five-row preview, and its header opens the complete list.
  const topSongs = page.locator('.top-list');
  await expect(topSongs.locator('.hs-track-row')).toHaveCount(5);
  await expect(page.getByRole('link', { name: 'See all Top Songs' })).toHaveAttribute(
    'href',
    new RegExp(`/artist/${artist.id}/top-songs$`)
  );
});

test('an artist page shows the links, similar artists and top songs the server stored', async ({
  page,
  context
}) => {
  await signIn(page);
  await seedDiscography(context);
  const artist = await findArtist(context);
  const answer = await completePage<ArtistAnswer>(
    context,
    `/api/v1/artists/${encodeURIComponent(artist.id)}`
  );

  await open(page, `/artist/${artist.id}`);
  await expect(page.getByRole('heading', { name: DISCOGRAPHY_ARTIST })).toBeVisible();

  // The links row is exactly the stored links this client has a label for.
  const labels = visibleLinkLabels(answer.links);
  const links = page.locator('.links a');
  await expect(links).toHaveCount(labels.length);
  for (const [index, label] of labels.entries()) {
    await expect(links.nth(index)).toHaveText(label);
    await expect(links.nth(index)).toHaveAttribute('target', '_blank');
    await expect(links.nth(index)).toHaveAttribute('rel', 'noopener noreferrer');
  }

  // The similar artists shelf is the answer's list, capped at twelve.
  const similar = page.getByRole('heading', { name: 'Similar Artists' });
  if (answer.similarArtists.length === 0) {
    await expect(similar).toHaveCount(0);
  } else {
    await expect(similar).toBeVisible({ timeout: INDEX_WAIT_MS });
    await expect(page.locator('.hs-shelf .hs-card--artist')).toHaveCount(
      Math.min(12, answer.similarArtists.length)
    );
  }
});

test('an artist page shimmers while its read is in flight and claims nothing', async ({
  page,
  context
}) => {
  await signIn(page);
  await seedDiscography(context);
  const artist = await findArtist(context);

  // Hold the artist read so the page stays in the state it opens in: a hero
  // shimmer and nothing under it. It must draw what is coming and never claim
  // the artist has nothing.
  const artistRead = (url: URL): boolean => url.pathname === `/api/v1/artists/${artist.id}`;
  await page.route(artistRead, async (route) => {
    await sleep(1500);
    await route.continue();
  });

  await open(page, `/artist/${artist.id}`);

  await expect(page.locator('.loading .hs-track-list .hs-track-row')).toHaveCount(5);
  await expect(page.locator('.loading .hs-card-grid .hs-card')).toHaveCount(6);
  await expect(page.getByText('Nothing by this artist yet.')).toHaveCount(0);

  await page.unroute(artistRead);
  await expect(page.getByRole('heading', { name: DISCOGRAPHY_ARTIST })).toBeVisible();
  await expect(page.getByText('Nothing by this artist yet.')).toHaveCount(0);
});

test('an album page lists the whole tracklist, its release details and More by', async ({
  page,
  context
}) => {
  await signIn(page);
  await seedDiscography(context);
  const artist = await findArtist(context);
  const artistAnswer = await completePage<ArtistAnswer>(
    context,
    `/api/v1/artists/${encodeURIComponent(artist.id)}`
  );
  const summary = artistAnswer.albums.find((album) => album.title === SECOND_WIND);
  if (summary === undefined) {
    throw new Error(`no ${SECOND_WIND} in the artist's discography`);
  }
  const album = await completePage<AlbumAnswer>(
    context,
    `/api/v1/albums/${encodeURIComponent(summary.id)}`
  );

  await open(page, `/album/${album.id}`);

  await expect(page.getByRole('heading', { name: SECOND_WIND })).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/album/${album.id}$`));
  const rows = page.locator('.hs-track-list');
  await expect(rows.locator('.hs-track-row')).toHaveCount(3);
  for (const track of album.tracks) {
    await expect(rows.getByText(track.title, { exact: true })).toBeVisible();
  }
  await expect(libraryMarks(page, '.hs-track-list')).toHaveCount(1);

  // The hero's second muted line is the release detail: date, type, edition.
  const meta = page.locator('.hs-hero__meta');
  await expect(meta.last()).toHaveText(expectedReleaseDetails(album));

  // "More by <artist>" is the artist's other albums, captured at twelve, and
  // its header opens the artist page.
  const primary = album.artists[0];
  if (album.moreByArtist.length === 0 || primary === undefined) {
    await expect(page.getByRole('heading', { name: /^More by / })).toHaveCount(0);
  } else {
    await expect(
      page.getByRole('link', { name: `See all More by ${primary.name}` })
    ).toHaveAttribute('href', new RegExp(`/artist/${primary.id}$`));
    await expect(page.locator('.more-by .hs-card--album')).toHaveCount(
      Math.min(12, album.moreByArtist.length)
    );
  }
});

test('an artist top songs page lists the complete list and a row plays', async ({
  page,
  context
}) => {
  await signIn(page);
  await seedDiscography(context);
  const artist = await findArtist(context);

  await open(page, `/artist/${artist.id}/top-songs`);

  await expect(
    page.getByRole('heading', { name: `Top Songs by ${DISCOGRAPHY_ARTIST}` })
  ).toBeVisible({ timeout: INDEX_WAIT_MS });
  const rows = page.locator('.songs .hs-track-row');
  await expect(rows.first()).toBeVisible();
  const title = await rows.first().locator('.hs-track-row__title').textContent();
  await rows.first().locator('.hs-track-row__open').click();

  await expect(page.locator('.player-title')).toHaveText(title ?? '');
});

test('a search result opens the same artist page by id', async ({ page, context }) => {
  await signIn(page);
  await seedDiscography(context);
  const artist = await findArtist(context);

  await open(page, '/search');
  await page.locator('.app-search').getByLabel('Search', { exact: true }).fill(DISCOGRAPHY_ARTIST);
  const top = page.locator('.hs-top-result');
  await expect(top.locator('.hs-top-result__name')).toHaveText(DISCOGRAPHY_ARTIST);
  await top.getByRole('link').first().click();

  await expect(page.getByRole('heading', { name: DISCOGRAPHY_ARTIST })).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/artist/${artist.id}$`));
});

test('an album card opens the album page by id', async ({ page, context }) => {
  await signIn(page);
  await seedDiscography(context);
  const artist = await findArtist(context);

  await open(page, `/artist/${artist.id}`);
  await page.locator('.album-grid').getByRole('link', { name: SECOND_WIND }).click();

  await expect(page.getByRole('heading', { name: SECOND_WIND })).toBeVisible();
  await expect(page).toHaveURL(/\/album\/al_[a-z0-9]+$/i);
});
