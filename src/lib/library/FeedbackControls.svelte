<!--
  The feedback controls of one entity.

  A like and a dislike are one choice each and are mutually exclusive, and the
  stars are a rating from one to five that clicking its own number clears. The
  controls render the state the store reports and write through it, so the same
  entity shows the same opinion everywhere it appears.
-->
<script lang="ts">
  import { feedback } from '#lib/library/feedback.svelte';
  import type { FeedbackEntity } from '#lib/library/feedback';

  /** The stars a rating control offers. */
  const STARS = [1, 2, 3, 4, 5];

  /** Props of a feedback control set. */
  interface Props {
    /** The entity the controls report on and write. */
    entity: FeedbackEntity;
    /** Whether the rating stars are shown. */
    rating?: boolean;
    /** Whether the dislike control is shown. */
    dislike?: boolean;
  }

  let { entity, rating = true, dislike = true }: Props = $props();

  const state = $derived(feedback.stateFor(entity));
</script>

<span class="feedback">
  <button
    class="feedback-button"
    type="button"
    aria-pressed={state.liked}
    onclick={() => feedback.toggleLike(entity)}
  >
    {state.liked ? 'Liked' : 'Like'}
  </button>

  {#if dislike}
    <button
      class="feedback-button"
      type="button"
      aria-pressed={state.disliked}
      onclick={() => feedback.toggleDislike(entity)}
    >
      {state.disliked ? 'Disliked' : 'Dislike'}
    </button>
  {/if}

  {#if rating}
    <span class="feedback-stars" role="group" aria-label="Rating">
      {#each STARS as star (star)}
        <button
          class="feedback-star"
          type="button"
          aria-pressed={state.rating >= star}
          aria-label="{star} of 5"
          onclick={() => feedback.rate(entity, star)}
        >
          {state.rating >= star ? '\u2605' : '\u2606'}
        </button>
      {/each}
    </span>
  {/if}
</span>

<style>
  .feedback {
    display: flex;
    gap: var(--space-1);
    align-items: center;
  }

  .feedback-button {
    padding: 0 var(--space-2);
    color: var(--color-fg-muted);
    font: inherit;
    font-size: 0.875rem;
    background: none;
    border: var(--border-width) solid var(--color-border);
    border-radius: var(--radius);
    cursor: pointer;
  }

  .feedback-button[aria-pressed='true'] {
    color: var(--color-accent);
    border-color: var(--color-accent);
  }

  .feedback-stars {
    display: flex;
    gap: 0;
  }

  .feedback-star {
    padding: 0 var(--space-1);
    color: var(--color-fg-muted);
    font: inherit;
    font-size: 0.875rem;
    line-height: 1;
    background: none;
    border: none;
    cursor: pointer;
  }

  .feedback-star[aria-pressed='true'],
  .feedback-star:hover {
    color: var(--color-accent);
  }
</style>
