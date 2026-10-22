<!--
  The Repositories group of the plugins page (p24).

  Every row names a registered index, the URL it is read from and whether its
  index is signed; the row menu edits the name and key or removes the
  repository. The page asks before removing one.
-->
<script lang="ts">
  import type { RepositoryView } from '#lib/admin/plugins';
  import Menu from '#lib/ui/Menu.svelte';
  import MenuItem from '#lib/ui/MenuItem.svelte';
  import Skeleton from '#lib/ui/Skeleton.svelte';

  /** Props of the repositories group. */
  interface Props {
    /** The registered repositories, in the order the server lists them. */
    repositories: RepositoryView[];
    /** Whether a page is being read right now. */
    loading: boolean;
    /** Opens the repository dialog for one entry. */
    onedit: (repository: RepositoryView) => void;
    /** Asks to remove one repository. */
    onremove: (repository: RepositoryView) => void;
  }

  let { repositories, loading, onedit, onremove }: Props = $props();
</script>

{#snippet loadingRows()}
  {#each [0, 1, 2] as row (row)}
    <li class="hs-setting-row" aria-hidden="true">
      <span class="hs-setting-row__text">
        <Skeleton width="35%" height="12px" />
        <Skeleton width="65%" height="10px" />
      </span>
    </li>
  {/each}
{/snippet}

<h2 class="hs-section-header__title group-heading">Repositories</h2>
<ul class="hs-settings-group group" aria-label="Repositories">
  {#each repositories as repository (repository.id)}
    <li class="hs-setting-row hs-setting-row--two-line plugin-row">
      <span class="hs-setting-row__text">
        <span>{repository.name ?? repository.url}</span>
        <span class="hs-setting-row__subtitle hs-setting-row__subtitle--mono">
          {repository.url}
        </span>
        <span class="hs-setting-row__subtitle">
          {repository.verified ? 'Signed' : 'Read unsigned'}
        </span>
      </span>
      <Menu label="More Actions" align="end">
        <MenuItem label="Edit" icon="adwaita-edit" onselect={() => onedit(repository)} />
        <MenuItem
          label="Delete"
          icon="adwaita-delete"
          destructive
          onselect={() => onremove(repository)}
        />
      </Menu>
    </li>
  {/each}

  {#if loading && repositories.length === 0}
    {@render loadingRows()}
  {:else if repositories.length === 0}
    <li class="hs-setting-row">
      <span class="hs-setting-row__text">
        <span class="hs-setting-row__subtitle">Nothing here yet.</span>
      </span>
    </li>
  {/if}
</ul>

<style>
  /* Layout glue only: the boards' group heading is 19/750 with a 10 px top
     margin and a -6 px bottom one against the group. */
  .group-heading {
    margin: 10px 0 -6px;
  }

  /* Layout glue only: p24 caps every group at 760 px. */
  .group {
    max-width: 760px;
  }

  /* p24-r1 pins the row menu to the top right on phones and keeps the row's
     text off it. */
  @media (max-width: 720px) {
    .plugin-row {
      position: relative;
      flex-wrap: wrap;
      padding-right: 48px;
    }

    .plugin-row > .hs-setting-row__text {
      flex: 1 1 100%;
    }

    .plugin-row > :global(.menu-anchor) {
      position: absolute;
      top: 8px;
      right: 6px;
    }
  }
</style>
