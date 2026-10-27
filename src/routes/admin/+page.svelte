<!--
  The administration overview (l10 B, E2, c04, k28).

  The first row of the admin sidebar opens this page: one card per admin area,
  each the link to it, with that area's key number and a line of context. The
  cards, their icons and their count reads come from the overview registry, so
  a new area adds one entry there rather than another block here. A card whose
  area counts health states shows one k10 pill per state present with its
  count; the storage card shows a k09 bar of the disk used instead of a number.
  A read that fails is the page-wide o03 status page with Retry.
-->
<script lang="ts">
  import { onMount } from 'svelte';

  import { ADMIN_CARDS, readOverview } from '#lib/admin/overview';
  import type { OverviewData } from '#lib/admin/overview';
  import { loadIndexStatus } from '#lib/entities/api';
  import type { IndexStatus } from '#lib/entities/api';
  import { events } from '#lib/stores/events.svelte';
  import type { ScanProgressPayload } from '#lib/stores/events.svelte';
  import Button from '#lib/ui/Button.svelte';
  import CountBadge from '#lib/ui/CountBadge.svelte';
  import OverviewCard from '#lib/ui/OverviewCard.svelte';
  import PageHeader from '#lib/ui/PageHeader.svelte';
  import Pill from '#lib/ui/Pill.svelte';
  import ProgressBar from '#lib/ui/ProgressBar.svelte';
  import Skeleton from '#lib/ui/Skeleton.svelte';
  import StatusPage from '#lib/ui/StatusPage.svelte';

  /** The counts every card draws, or `null` before the first read settles. */
  let data = $state<OverviewData | null>(null);
  /** What the event stream last said about each folder's scan. */
  let scans = $state<Record<string, ScanProgressPayload>>({});
  /** The entity index queue, or `null` while nothing is known. */
  let index = $state<IndexStatus | null>(null);
  let loading = $state(true);
  let failure = $state<string | null>(null);

  /** The cards of the loaded page, each with the body its counts shape. */
  const cards = $derived.by(() => {
    const loaded = data;
    if (loaded === null) {
      return [];
    }
    return ADMIN_CARDS.map((card) => ({
      id: card.id,
      title: card.title,
      icon: card.icon,
      href: card.href,
      body: card.body(loaded, scans)
    }));
  });

  onMount(() => {
    void load();
    const stopScans = events.on('scan.progress', (event) => {
      scans = { ...scans, [event.data.folderId]: event.data };
    });
    const stopIndex = events.on('index.progress', (event) => {
      index = event.data;
    });
    return () => {
      stopScans();
      stopIndex();
    };
  });

  /**
   * Reads every area's count, then the whole page settles.
   */
  async function load(): Promise<void> {
    loading = true;
    // The index queue is an addition to the page: a read that fails leaves the
    // progress card out rather than failing the counts beside it.
    const [result, status] = await Promise.all([
      readOverview(),
      loadIndexStatus().catch(() => null)
    ]);
    index = status;
    loading = false;
    if (!result.ok) {
      failure = result.message;
      return;
    }
    failure = null;
    data = result.value;
  }
</script>

<svelte:head>
  <title>Overview - Hearthsound</title>
</svelte:head>

{#snippet retryAction()}
  <Button onclick={() => void load()}>Retry</Button>
{/snippet}

<PageHeader title="Overview" class="admin-header" />

{#if failure !== null}
  <div class="state">
    <StatusPage
      level={2}
      alert
      icon="adwaita-error"
      title="Could Not Load This Page"
      text="The server did not answer. Try again in a moment."
      action={retryAction}
    />
  </div>
{:else}
  <div class="hs-admin-overview">
    {#if loading}
      {#each [0, 1, 2, 3, 4, 5] as card (card)}
        <div class="hs-admin-card" aria-hidden="true">
          <Skeleton width="55%" height="14px" />
          <Skeleton width="30%" height="29px" />
          <Skeleton width="65%" height="12px" />
        </div>
      {/each}
    {:else}
      {#if index !== null && index.pending > 0}
        <OverviewCard
          area="Metadata index"
          icon="adwaita-refresh"
          line={`Indexing metadata: ${index.done} of ${index.total} items${index.failed > 0 ? ` - ${index.failed} failed` : ''}`}
        />
      {/if}
      {#each cards as card (card.id)}
        <OverviewCard
          area={card.title}
          icon={card.icon}
          href={card.href}
          value={card.body.kind === 'storage' ? undefined : String(card.body.number)}
          line={card.body.kind === 'providers' ? undefined : card.body.line}
        >
          {#if card.body.kind === 'providers'}
            {#if card.body.states.length > 0}
              <span class="pills">
                {#each card.body.states as state (state.label)}
                  <span class="pills__item">
                    <Pill tone={state.tone} glyph={state.glyph} label={state.label} />
                    <CountBadge count={state.count} />
                  </span>
                {/each}
              </span>
            {/if}
          {:else if card.body.kind === 'storage'}
            <ProgressBar label="Storage used" value={card.body.percent} />
          {/if}
        </OverviewCard>
      {/each}
    {/if}
  </div>
{/if}

<style>
  /* Layout glue only: the shell already holds the page off the window edge, so
     the k25 header aligns to that margin. */
  :global(.admin-header) {
    padding-inline: 0;
  }

  /* Layout glue only: the page's card grid under the header, and the state page
     filling the column when the read fails. */
  .hs-admin-overview {
    padding-block: var(--hs-space-4) var(--hs-space-7);
  }

  .state {
    display: flex;
    flex-direction: column;
    min-height: 60vh;
  }

  /* Layout glue only: the cards' pills wrap with their counts; the package
     draws one pill per line in the admin row, not a count per state. */
  .pills {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .pills__item {
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }
</style>
