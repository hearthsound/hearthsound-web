/**
 * The reads behind Home and its shelf full lists.
 *
 * Home draws its shelves from the personal library: the album orders
 * `getAlbumList2` takes, the caller's liked entities from `getStarred2` and
 * random tracks from `getRandomSongs` (pages.md 4.2). The four Discovery
 * sections have no source today, so they answer with nothing and stay hidden
 * (l13d B); nothing stands in for data the server does not have.
 *
 * A page-wide read either succeeds as a whole or fails as a whole, because a
 * failed section is the page-wide o03 status page rather than an empty shelf.
 */
import {
  LIBRARY_PAGE_SIZE,
  PERSONAL_FOLDER,
  libraryApi,
  type AlbumListType
} from '#lib/subsonic/library';
import type { AlbumID3, ArtistID3, Child, Starred2 } from '#lib/subsonic/types';

import { HOME_SECTION_BY_ID, type HomeSection } from './sections';

/** How many cards one shelf asks for. */
export const HOME_SHELF_SIZE = 20;

/** How many k12 rows a song shelf shows (l13b). */
export const HOME_SONG_ROWS = 5;

/** How many songs a song full list and a random album list ask for at once. */
export const HOME_LONG_LIST_SIZE = 100;

/** The page size a section's full list asks for. */
export const HOME_PAGE_SIZE = LIBRARY_PAGE_SIZE;

/** How far back the Recently Added section reaches: one week. */
export const RECENTLY_ADDED_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Keeps the albums added to the library within the last week.
 *
 * The `newest` order answers with every album the server holds; "recently added"
 * is the week's arrivals, so an older album leaves the shelf (p07). An album
 * without a created timestamp cannot prove it is recent and is left out.
 *
 * @param albums The albums of a `newest` page.
 * @param now The moment the window is measured from, in milliseconds.
 * @returns The albums created within the window, in their original order.
 */
export function withinRecentlyAddedWindow(
  albums: readonly AlbumID3[],
  now = Date.now()
): AlbumID3[] {
  return albums.filter((album) => {
    if (album.created === undefined) {
      return false;
    }
    const created = Date.parse(album.created);
    return Number.isFinite(created) && now - created <= RECENTLY_ADDED_WINDOW_MS;
  });
}

/** The items one section holds, in its own shape. */
export interface HomeContent {
  /** The albums of an album shelf. */
  albums: AlbumID3[];
  /** The artists of an artist shelf. */
  artists: ArtistID3[];
  /** The tracks of a song shelf or list. */
  songs: Child[];
}

/** One page of a section's full list. */
export interface HomePageContent extends HomeContent {
  /** The cursor of the next page, or `null` when this was the last one. */
  next: number | null;
}

/** The `getAlbumList2` order behind each album section. */
const ALBUM_ORDERS: Readonly<Record<string, AlbumListType>> = {
  'recently-played': 'recent',
  'recently-added': 'newest',
  'most-played': 'frequent',
  'highest-rated': 'highest',
  'random-albums': 'random'
};

/** The sections whose full list may page through an album order. */
const PAGEABLE: Readonly<Record<string, true>> = {
  'recently-played': true,
  'recently-added': true,
  'most-played': true,
  'highest-rated': true
};

/**
 * Reads the content of the requested sections for Home's shelves.
 *
 * The liked entities are read once for the three Liked shelves, so a page with
 * every section on does not ask the server the same question three times.
 *
 * @param ids The ids of the sections to read, in any order.
 * @param size How many items each shelf asks for.
 * @returns The content of each requested section, keyed by id; an unreadable
 *   server rejects the whole read.
 */
export async function loadHomeShelves(
  ids: readonly string[],
  size = HOME_SHELF_SIZE
): Promise<Record<string, HomeContent>> {
  const wanted = ids
    .map((id) => HOME_SECTION_BY_ID[id])
    .filter((section): section is HomeSection => section !== undefined);
  const wantedIds = new Set(wanted.map((section) => section.id));
  const needsStarred =
    wantedIds.has('liked-albums') || wantedIds.has('liked-artists') || wantedIds.has('liked-songs');

  const [starred, albumAnswers, randomSongs] = await Promise.all([
    needsStarred ? libraryApi.starred() : Promise.resolve<Starred2>({}),
    Promise.all(
      wanted.flatMap((section) => {
        const type = ALBUM_ORDERS[section.id];
        return type === undefined
          ? []
          : [
              libraryApi
                .albumsBy(type, PERSONAL_FOLDER, 0, size)
                .then((albums) => [section.id, albums] as const)
            ];
      })
    ),
    wantedIds.has('random-songs')
      ? libraryApi.randomSongs(PERSONAL_FOLDER, size)
      : Promise.resolve<Child[]>([])
  ]);

  const answers: Record<string, HomeContent> = {};
  for (const section of wanted) {
    answers[section.id] = { albums: [], artists: [], songs: [] };
  }
  for (const [id, albums] of albumAnswers) {
    const answer = answers[id];
    if (answer !== undefined) {
      answer.albums = id === 'recently-added' ? withinRecentlyAddedWindow(albums) : albums;
    }
  }
  const likedAlbums = answers['liked-albums'];
  if (likedAlbums !== undefined) {
    likedAlbums.albums = (starred.album ?? []).slice(0, size);
  }
  const likedArtists = answers['liked-artists'];
  if (likedArtists !== undefined) {
    likedArtists.artists = (starred.artist ?? []).slice(0, size);
  }
  const likedSongs = answers['liked-songs'];
  if (likedSongs !== undefined) {
    likedSongs.songs = (starred.song ?? []).slice(0, size);
  }
  const random = answers['random-songs'];
  if (random !== undefined) {
    random.songs = randomSongs.slice(0, size);
  }
  return answers;
}

/**
 * Reads one page of a section's full list.
 *
 * Album orders that the server can page ask for the next window. The Liked
 * shelves and the random draws answer in one call - `getStarred2` carries every
 * liked entity and `getRandomSongs` has no cursor - so they finish on their
 * first page.
 *
 * @param id The section id from the route.
 * @param offset How many items to skip.
 * @param count How many items the page asks for.
 * @returns The page and the cursor of the next one.
 */
export async function loadHomePage(
  id: string,
  offset: number,
  count: number
): Promise<HomePageContent> {
  const section = HOME_SECTION_BY_ID[id];
  const page: HomePageContent = { albums: [], artists: [], songs: [], next: null };
  if (section === undefined || section.discovery) {
    return page;
  }

  if (PAGEABLE[id] === true) {
    const type = ALBUM_ORDERS[id];
    if (type !== undefined) {
      const albums = await libraryApi.albumsBy(type, PERSONAL_FOLDER, offset, count);
      page.albums = id === 'recently-added' ? withinRecentlyAddedWindow(albums) : albums;
      page.next = albums.length < count ? null : offset + count;
    }
    return page;
  }

  if (offset > 0) {
    return page;
  }

  if (id === 'random-albums') {
    page.albums = await libraryApi.albumsBy('random', PERSONAL_FOLDER, 0, HOME_LONG_LIST_SIZE);
  } else if (id === 'random-songs') {
    page.songs = await libraryApi.randomSongs(PERSONAL_FOLDER, HOME_LONG_LIST_SIZE);
  } else if (id === 'liked-albums' || id === 'liked-artists' || id === 'liked-songs') {
    const starred = await libraryApi.starred();
    if (id === 'liked-albums') {
      page.albums = starred.album ?? [];
    } else if (id === 'liked-artists') {
      page.artists = starred.artist ?? [];
    } else {
      page.songs = starred.song ?? [];
    }
  }
  return page;
}
