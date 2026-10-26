<!--
  A library list's sort menu (k28, l03).

  A flat "Sort" button in the page header opens the orders the list offers with
  the current one checked. A list that can be narrowed also offers the genres
  the collection holds below a separator: on the server a genre is a list order
  of its own, so choosing one shows that genre and choosing an order again drops
  it. The menu only reports the choice; the page writes it into the address, so
  a reload, a shared link and Back all show the list the reader chose.

  Usage:
  ```
  <SortMenu
    sorts={ALBUM_SORTS}
    sort={query.sort}
    genre={query.genre}
    {genres}
    onsort={(id) => chooseQuery({ sort: id as AlbumSortId, genre: undefined })}
    ongenre={(genre) => chooseQuery({ sort: DEFAULT_ALBUM_SORT, genre })}
  />
  ```
-->
<script lang="ts">
  import type { Genre } from '#lib/subsonic/types';
  import Menu from '#lib/ui/Menu.svelte';
  import MenuCheckItem from '#lib/ui/MenuCheckItem.svelte';
  import MenuItem from '#lib/ui/MenuItem.svelte';
  import MenuSeparator from '#lib/ui/MenuSeparator.svelte';

  /** One order a list offers. */
  export interface SortChoice {
    /** The id the address carries. */
    id: string;
    /** The visible label of the menu item. */
    label: string;
  }

  /** Props of the sort menu. */
  interface Props {
    /** The orders the list offers, in the menu's order. */
    sorts: readonly SortChoice[];
    /** The order the list shows. */
    sort: string;
    /** The genre the list is narrowed to, when it offers genres. */
    genre?: string | undefined;
    /** The genres the collection holds; no genre list is drawn when empty. */
    genres?: readonly Genre[];
    /**
     * Reports the chosen order.
     *
     * @param id The order the reader picked.
     */
    onsort: (id: string) => void;
    /**
     * Reports the chosen genre, or `undefined` for every genre.
     *
     * @param genre The genre the reader picked.
     */
    ongenre?: (genre: string | undefined) => void;
  }

  let { sorts, sort, genre, genres = [], onsort, ongenre }: Props = $props();
</script>

<Menu label="Sort" icon="adwaita-sort">
  {#each sorts as option (option.id)}
    <MenuCheckItem
      label={option.label}
      checked={sort === option.id}
      onselect={() => onsort(option.id)}
    />
  {/each}
  {#if ongenre !== undefined && genres.length > 0}
    <MenuSeparator />
    <MenuItem label="Genre" submenuLabel="Genre">
      {#snippet submenu()}
        <MenuCheckItem
          label="All Genres"
          checked={genre === undefined}
          onselect={() => ongenre?.(undefined)}
        />
        {#each genres as entry (entry.name)}
          <MenuCheckItem
            label={entry.name}
            checked={genre === entry.name}
            onselect={() => ongenre?.(entry.name)}
          />
        {/each}
      {/snippet}
    </MenuItem>
  {/if}
</Menu>
