<!--
  The sidebar's navigation list (k24, k02's one-tab-stop pattern).

  The rows are one tab stop: the current page keeps `tabindex="0"`, every other
  row sits at -1, and Up/Down with Home/End move between them. Tab leaves the
  list. A pointer or keyboard focus on another row makes it the tab stop, so
  returning with Shift+Tab lands where the reader left.

  The library list ends with the Administration row, held at the foot of the
  scrolling list while rows pass under it; the administration list starts with
  the Library row that leads back. Both render the same rows and headings the
  navigation data declares.

  Usage:
  `<SidebarNav adminArea={false} pathname={page.url.pathname} sections={library}
      backHref="/" administration={administrationEntry} />`
-->
<script lang="ts">
  import { libraryBackEntry } from '#lib/nav';
  import type { NavEntry, NavSection } from '#lib/nav';

  import NavHeading from '#lib/ui/NavHeading.svelte';
  import NavRow from '#lib/ui/NavRow.svelte';

  /** Props of the list. */
  interface Props {
    /** Whether the administration area's list is drawn. */
    adminArea: boolean;
    /** The path the browser shows, for the current row. */
    pathname: string;
    /** The visible sections, in order. */
    sections: readonly NavSection[];
    /** Where the administration area's Library row leads (b02). */
    backHref: string;
    /** The Administration row at the foot of the library list, when it is shown. */
    administration?: NavEntry | null;
    /**
     * Opens the now-playing view for a row that declares
     * {@link NavEntry.opens}.
     */
    openNowPlaying?: () => void;
  }

  let {
    adminArea,
    pathname,
    sections,
    backHref,
    administration = null,
    openNowPlaying
  }: Props = $props();

  /** The row that holds the list's tab stop, by href. */
  let focused = $state<string | null>(null);

  const back = $derived<NavEntry>({ ...libraryBackEntry, href: backHref });

  const entries = $derived<NavEntry[]>(
    adminArea
      ? [back, ...sections.flatMap((section) => section.entries)]
      : [
          ...sections.flatMap((section) => section.entries),
          ...(administration === null ? [] : [administration])
        ]
  );

  // The last row the reader stood on is the tab stop; a page the list no
  // longer holds, or a fresh render, falls back to the current row and then to
  // the first row.
  const tabHref = $derived(
    focused !== null && entries.some((entry) => entry.href === focused)
      ? focused
      : (entries.find((entry) => entry.href === pathname)?.href ?? entries[0]?.href ?? null)
  );

  /**
   * Moves between the rows with Up/Down, Home and End (k24).
   *
   * @param event The key press on a row.
   */
  function navKey(event: KeyboardEvent): void {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      return;
    }
    const nav = (event.currentTarget as HTMLElement).closest('nav');
    if (nav === null) {
      return;
    }
    const rows = Array.from(nav.querySelectorAll<HTMLElement>('.hs-nav-item'));
    const index = rows.indexOf(document.activeElement as HTMLElement);
    if (index === -1) {
      return;
    }
    event.preventDefault();
    let next: HTMLElement | undefined;
    if (event.key === 'Home') {
      next = rows[0];
    } else if (event.key === 'End') {
      next = rows[rows.length - 1];
    } else {
      const step = event.key === 'ArrowDown' ? 1 : -1;
      next = rows[(index + step + rows.length) % rows.length];
    }
    next?.focus();
    focused = next?.dataset.href ?? null;
  }
</script>

<nav aria-label="Main" class="app-nav">
  {#if adminArea}
    <NavRow
      href={back.href}
      label={back.label}
      icon={back.icon}
      tabindex={back.href === tabHref ? 0 : -1}
      data-href={back.href}
      onfocus={() => (focused = back.href)}
      onkeydown={navKey}
    />
    {#each sections as section (section.title)}
      {#if section.title !== undefined}
        <NavHeading text={section.title} />
      {/if}
      {#each section.entries as entry (entry.href)}
        <NavRow
          href={entry.href}
          label={entry.label}
          icon={entry.icon}
          current={pathname === entry.href}
          tabindex={entry.href === tabHref ? 0 : -1}
          data-href={entry.href}
          onfocus={() => (focused = entry.href)}
          onkeydown={navKey}
          onclick={(event) => {
            if (entry.opens !== 'now-playing') {
              return;
            }
            event.preventDefault();
            openNowPlaying?.();
          }}
        />
      {/each}
    {/each}
  {:else}
    {#each sections as section (section.title ?? section.entries[0].href)}
      {#if section.title !== undefined}
        <NavHeading text={section.title} />
      {/if}
      {#each section.entries as entry (entry.href)}
        <NavRow
          href={entry.href}
          label={entry.label}
          icon={entry.icon}
          current={pathname === entry.href}
          tabindex={entry.href === tabHref ? 0 : -1}
          data-href={entry.href}
          onfocus={() => (focused = entry.href)}
          onkeydown={navKey}
          onclick={(event) => {
            if (entry.opens !== 'now-playing') {
              return;
            }
            event.preventDefault();
            openNowPlaying?.();
          }}
        />
      {/each}
    {/each}

    {#if administration !== null}
      <div class="hs-sidebar__spacer" aria-hidden="true"></div>
      <NavRow
        class="app-nav-foot"
        href={administration.href}
        label={administration.label}
        icon={administration.icon}
        current={pathname === administration.href}
        tabindex={administration.href === tabHref ? 0 : -1}
        data-href={administration.href}
        onfocus={() => (focused = administration.href)}
        onkeydown={navKey}
      />
    {/if}
  {/if}
</nav>

<style>
  /* The list is the sidebar's scrolling region; the lockup, search field and
     account row stay put around it. */
  .app-nav {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: var(--hs-space-1);
    min-height: 0;
    overflow-y: auto;
  }

  /* k24, l02: the Administration row holds the foot of the list while the
     rows above it scroll. */
  .app-nav :global(.app-nav-foot) {
    position: sticky;
    bottom: 0;
    background: var(--hs-sidebar-bg);
  }
</style>
