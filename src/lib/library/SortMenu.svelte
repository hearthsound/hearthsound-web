<!--
  The album list's sort and genre menu (k28, l03).

  A flat "Sort" button in the page header opens the orders the album list
  offers with the current one checked. Below them sit the genres the collection
  holds: a genre is the list's `byGenre` order on the server, so choosing one
  shows that genre's albums and choosing an order again drops the filter. The
  menu only reports the choice; the page writes it into the address.

  Usage:
  ```
  <SortMenu query={query} genres={genres} onchoose={(next) => void navigate(albumRoute(next))} />
  ```
-->
<script lang="ts">
  import { ALBUM_SORTS, DEFAULT_ALBUM_SORT } from '#lib/library/sort';
  import type { AlbumQuery } from '#lib/library/sort';
  import type { Genre } from '#lib/subsonic/types';
  import Menu from '#lib/ui/Menu.svelte';
  import MenuCheckItem from '#lib/ui/MenuCheckItem.svelte';
  import MenuItem from '#lib/ui/MenuItem.svelte';
  import MenuSeparator from '#lib/ui/MenuSeparator.svelte';

  /** Props of the sort menu. */
  interface Props {
    /** The order and genre the list shows, as the address names them. */
    query: AlbumQuery;
    /** The genres the collection holds; their list is absent when it is empty. */
    genres: readonly Genre[];
    /**
     * Reports the choice the reader made.
     *
     * @param next The order and genre to show.
     */
    onchoose: (next: AlbumQuery) => void;
  }

  let { query, genres, onchoose }: Props = $props();
</script>

<Menu label="Sort" icon="adwaita-sort">
  {#each ALBUM_SORTS as option (option.id)}
    <MenuCheckItem
      label={option.label}
      checked={query.sort === option.id}
      onselect={() => onchoose({ sort: option.id, genre: undefined })}
    />
  {/each}
  {#if genres.length > 0}
    <MenuSeparator />
    <MenuItem label="Genre" submenuLabel="Genre">
      {#snippet submenu()}
        <MenuCheckItem
          label="All Genres"
          checked={query.genre === undefined}
          onselect={() => onchoose({ sort: query.sort, genre: undefined })}
        />
        {#each genres as genre (genre.name)}
          <MenuCheckItem
            label={genre.name}
            checked={query.genre === genre.name}
            onselect={() => onchoose({ sort: DEFAULT_ALBUM_SORT, genre: genre.name })}
          />
        {/each}
      {/snippet}
    </MenuItem>
  {/if}
</Menu>
