<!--
  A reorderable group of rows (k30 / k30-r1).

  The rows can be dragged with the pointer and moved with the keyboard. The
  handle appears always (setup Order, Customize Home, admin Layers) or only
  while the page is in reorder mode, which it enters from its overflow menu.
  Focus a row and press Space to pick it up, Up or Down to move it, Space to
  drop it and Escape to cancel; Alt+Up and Alt+Down move it one step directly.
  Every move is announced as "Moving, position N of M".

  The row's own contents, including its trailing controls, are passed as
  content, which receives the item and its position.

  Usage:
  `<ReorderList label="Instances of metadata" bind:items={instances}
     handles="always" onchange={save}>
     {#snippet children(item, position)}
       <span class="hs-setting-row__text"><span>{item.name}</span></span>
     {/snippet}
   </ReorderList>`
-->
<script lang="ts" generics="T extends { id: string }">
  import { dndzone } from 'svelte-dnd-action';
  import type { DndEvent } from 'svelte-dnd-action';
  import { SvelteMap } from 'svelte/reactivity';
  import { tick } from 'svelte';
  import type { Snippet } from 'svelte';

  import Icon from './Icon.svelte';

  /** Props of the reorderable list. */
  interface Props {
    /** The rows, in order; bindable so a drag or a key move updates the page. */
    items?: T[];
    /** The accessible name of the list, e.g. "Instances of metadata". */
    label: string;
    /** Whether the handle is always shown or only in reorder mode. */
    handles?: 'always' | 'mode';
    /** Whether reorder mode is on; bindable for the page's overflow menu. */
    reordering?: boolean;
    /** Whether the rows carry their position number. */
    numbered?: boolean;
    /** Whether each row holds a title over a second line (60 px rows, k11-r1). */
    twoLine?: boolean;
    /** Reports the order after every change, for a page that saves at once. */
    onchange?: (items: T[]) => void;
    /**
     * Closes reorder mode from a Suggested Done button. Pages with a hero
     * place their own Done button and leave this out.
     */
    ondone?: () => void;
    /** The row content, with the item and its position. */
    children: Snippet<[T, number]>;
    /**
     * A final row inside the group, for a list whose group ends with an action
     * (setup Order's "Add instance" row).
     */
    footer?: Snippet;
  }

  let {
    items = $bindable([]),
    label,
    handles = 'mode',
    reordering = $bindable(false),
    numbered = true,
    twoLine = false,
    onchange = () => {},
    ondone,
    children,
    footer
  }: Props = $props();

  let grabbed = $state<string | null>(null);
  let announcement = $state('');
  /** The order a grabbed row returns to when the move is cancelled. */
  let before: T[] = [];
  const rows = new SvelteMap<string, HTMLElement>();

  const active = $derived(handles === 'always' || reordering);
  const listClasses = $derived(
    [
      'hs-reorder-list',
      handles === 'always' && 'hs-reorder-list--handles',
      handles === 'mode' && reordering && 'hs-reorder-list--reordering'
    ]
      .filter((name) => name !== false)
      .join(' ')
  );
  const options = $derived({
    items,
    dragDisabled: !active,
    autoAriaDisabled: true,
    dropTargetStyle: {},
    zoneItemTabIndex: active ? 0 : -1,
    delayTouchStart: true
  });

  /**
   * Keeps the row element the keyboard moves focus back to and makes it a tab
   * stop only while reordering is on.
   *
   * @param node The row element.
   * @param state The item's identity and whether rows are active.
   */
  function registerRow(node: HTMLElement, state: { id: string; active: boolean }) {
    let current = state;
    const apply = (): void => {
      rows.delete(current.id);
      rows.set(current.id, node);
      node.tabIndex = current.active ? 0 : -1;
    };
    apply();
    return {
      update(next: { id: string; active: boolean }): void {
        current = next;
        apply();
      },
      destroy(): void {
        rows.delete(current.id);
      }
    };
  }

  /**
   * Announces a row's position in the list.
   *
   * @param index The row's new zero-based position.
   */
  function announce(index: number): void {
    announcement = `Moving, position ${index + 1} of ${items.length}`;
  }

  /**
   * Moves one row and keeps focus on it.
   *
   * @param from The row's position now.
   * @param to The row's position after the move.
   */
  function move(from: number, to: number): void {
    if (to < 0 || to >= items.length || from === to) {
      return;
    }
    const id = items[from]?.id;
    if (id === undefined) {
      return;
    }
    const next = [...items];
    const [moved] = next.splice(from, 1);
    if (moved === undefined) {
      return;
    }
    next.splice(to, 0, moved);
    items = next;
    onchange(items);
    announce(to);
    void tick().then(() => rows.get(id)?.focus());
  }

  /**
   * Picks a row up for a keyboard move.
   *
   * @param id The item's identity.
   */
  function pick(id: string): void {
    const index = items.findIndex((item) => item.id === id);
    if (index === -1) {
      return;
    }
    before = [...items];
    grabbed = id;
    announce(index);
  }

  /** Puts the grabbed row down where it stands. */
  function drop(): void {
    grabbed = null;
  }

  /**
   * Returns a grabbed row to where it was picked up.
   *
   * @param id The item's identity.
   */
  function cancel(id: string): void {
    const index = before.findIndex((item) => item.id === id);
    grabbed = null;
    announcement = '';
    if (index === -1) {
      return;
    }
    items = before;
    onchange(items);
    void tick().then(() => rows.get(id)?.focus());
  }

  /**
   * Handles the row's keyboard commands before the drag library sees them.
   *
   * @param event The key press on a row.
   */
  function keydown(event: KeyboardEvent): void {
    if (!active || event.target !== event.currentTarget) {
      return;
    }
    const id = (event.currentTarget as HTMLElement).dataset.id;
    const index = items.findIndex((item) => item.id === id);
    if (id === undefined || index === -1) {
      return;
    }
    if (![' ', 'ArrowUp', 'ArrowDown', 'Escape', 'Enter'].includes(event.key)) {
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    if (event.key === 'Escape') {
      if (grabbed === null) {
        return;
      }
      event.preventDefault();
      event.stopImmediatePropagation();
      cancel(grabbed);
      return;
    }
    if (event.key === ' ') {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (grabbed === id) {
        drop();
      } else if (grabbed === null) {
        pick(id);
      }
      return;
    }
    if (grabbed === id) {
      event.preventDefault();
      event.stopImmediatePropagation();
      move(index, index + (event.key === 'ArrowUp' ? -1 : 1));
      return;
    }
    if (event.altKey) {
      event.preventDefault();
      event.stopImmediatePropagation();
      move(index, index + (event.key === 'ArrowUp' ? -1 : 1));
    }
  }

  /**
   * Keeps the list where an entry was dragged.
   *
   * @param event The drag event with the current order.
   */
  function consider(event: CustomEvent<DndEvent<T>>): void {
    items = event.detail.items;
  }

  /**
   * Keeps the list where an entry was dropped and reports the new order.
   *
   * @param event The drag event with the final order.
   */
  function finalize(event: CustomEvent<DndEvent<T>>): void {
    items = event.detail.items;
    onchange(items);
  }

  /** Closes reorder mode from the Suggested Done button. */
  function finish(): void {
    reordering = false;
    ondone?.();
  }
</script>

<div class="hs-settings-group">
  <ul
    class={listClasses}
    aria-label={label}
    use:dndzone={options}
    onconsider={consider}
    onfinalize={finalize}
  >
    {#each items as item, index (item.id)}
      <li
        class="hs-setting-row"
        class:hs-setting-row--two-line={twoLine}
        class:hs-setting-row--grabbed={grabbed === item.id}
        class:hs-setting-row--interactive={active}
        data-id={item.id}
        use:registerRow={{ id: item.id, active }}
        onkeydowncapture={keydown}
      >
        <Icon name="adwaita-drag" class="hs-reorder-handle" />
        {#if numbered}
          <span class="hs-setting-row__number">{index + 1}</span>
        {/if}
        {@render children(item, index)}
      </li>
    {/each}
  </ul>
  {#if footer}
    <div class="footer">{@render footer()}</div>
  {/if}
</div>

<p class="hs-visually-hidden" role="status">{announcement}</p>

{#if reordering && handles === 'mode' && ondone !== undefined}
  <div class="done">
    <button class="hs-button hs-button--suggested" type="button" onclick={finish}>Done</button>
  </div>
{/if}

<style>
  .done {
    display: flex;
    justify-content: flex-end;
    margin-top: var(--hs-row-pad-compact);
  }

  /* The footer row follows the list inside the same group, so it carries the
     same hairline the rows draw between themselves. */
  .footer {
    box-shadow: inset 0 1px 0 var(--hs-separator);
  }
</style>
