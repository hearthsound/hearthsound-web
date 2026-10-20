<!--
  An admin table (k28).

  The table scrolls sideways on phones with the package's edge fade. A
  sortable header is a button named "Sort by <field>"; the sorted header shows
  the direction in `aria-sort` and the collapse arrow. Choosing a sorted
  header again reverses the direction, which the page's `onsort` callback
  decides.

  The body rows are passed as content; give a numeric cell the
  `hs-table__cell--numeric` class.

  Usage:
  `<Table label="Music folders" {columns} sort={sort} onsort={sortBy}>
     <tr><td>Music</td><td class="hs-table__cell--numeric">4812</td></tr>
   </Table>`
-->
<script lang="ts" module>
  /** One column of the table. */
  export interface TableColumn {
    /** The identity the page sorts by. */
    key: string;
    /** The visible heading and the field named in "Sort by <field>". */
    label: string;
    /** Whether the column holds numbers and is aligned to the right. */
    numeric?: boolean;
  }

  /** The current sort, or `null` when the rows are not sorted. */
  export interface TableSort {
    /** The column key that is sorted. */
    key: string;
    /** The direction the header reports. */
    direction: 'ascending' | 'descending';
  }
</script>

<script lang="ts">
  import type { Snippet } from 'svelte';

  import Icon from './Icon.svelte';

  /** Props of the table. */
  interface Props {
    /** The accessible name of the table. */
    label: string;
    /** The columns, in order. */
    columns: TableColumn[];
    /** The current sort, when one applies. */
    sort?: TableSort | null;
    /**
     * Runs when a sortable header is chosen; the page sets the new direction,
     * reversing it when the same column is chosen again.
     */
    onsort?: (key: string) => void;
    /** The body rows. */
    children: Snippet;
  }

  let { label, columns, sort = null, onsort, children }: Props = $props();
</script>

<div class="hs-table__scroll">
  <table class="hs-table" aria-label={label}>
    <thead>
      <tr>
        {#each columns as column (column.key)}
          <th
            aria-sort={sort?.key === column.key ? sort.direction : undefined}
            class={column.numeric ? 'hs-table__cell--numeric' : undefined}
          >
            {#if onsort !== undefined}
              <button
                class="hs-sort-button"
                type="button"
                aria-label="Sort by {column.label}"
                onclick={() => onsort(column.key)}
              >
                {column.label}
                {#if sort?.key === column.key}
                  <Icon name="adwaita-collapse" />
                {/if}
              </button>
            {:else}
              {column.label}
            {/if}
          </th>
        {/each}
      </tr>
    </thead>
    <tbody>
      {@render children()}
    </tbody>
  </table>
</div>
