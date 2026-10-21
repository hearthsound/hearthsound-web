<!--
  The feedback controls of one entity (k17-r3).

  Three presentations of the same state: the like and dislike toggles that sit
  in a row's actions area and in the song menu's top line, the 1-to-5 star
  rating radio group that sits in the song menu, and the single like toggle the
  artist hero draws. A like and a dislike are one opinion each and exclude each
  other; clicking the star an entity already carries clears the rating.

  Usage:
  `<FeedbackControls entity={entity} />`
  `<FeedbackControls entity={entity} variant="stars" />`
-->
<script lang="ts">
  import { feedback } from '#lib/library/feedback.svelte';
  import type { FeedbackEntity } from '#lib/library/feedback';
  import Button from '#lib/ui/Button.svelte';
  import Icon from '#lib/ui/Icon.svelte';

  /** The stars a rating control offers. */
  const STARS = [1, 2, 3, 4, 5];

  /** Props of a feedback control set. */
  interface Props {
    /** The entity the controls report on and write. */
    entity: FeedbackEntity;
    /** The presentation; the row's two toggles when not given. */
    variant?: 'actions' | 'stars' | 'like';
  }

  let { entity, variant = 'actions' }: Props = $props();

  const state = $derived(feedback.stateFor(entity));
</script>

{#if variant === 'stars'}
  <span class="hs-stars" role="radiogroup" aria-label="Rating">
    {#each STARS as star (star)}
      <button
        class="hs-star"
        class:hs-star--on={state.rating >= star}
        type="button"
        role="radio"
        aria-checked={state.rating === star}
        aria-label="{star} of 5"
        onclick={() => void feedback.rate(entity, star)}
      >
        <Icon name={state.rating >= star ? 'adwaita-rating' : 'adwaita-rating-outline'} />
      </button>
    {/each}
  </span>
{:else if variant === 'like'}
  <Button
    variant="flat"
    shape="icon"
    icon={state.liked ? 'adwaita-like' : 'custom-like-outline'}
    label={state.liked ? 'Liked' : 'Like'}
    pressed={state.liked}
    class={state.liked ? 'hs-button--on' : ''}
    onclick={() => void feedback.toggleLike(entity)}
  />
{:else}
  <span class="feedback">
    <Button
      variant="flat"
      shape="icon"
      icon={state.liked ? 'adwaita-like' : 'custom-like-outline'}
      label={state.liked ? 'Liked' : 'Like'}
      pressed={state.liked}
      class={state.liked ? 'hs-button--on' : ''}
      onclick={() => void feedback.toggleLike(entity)}
    />
    <Button
      variant="flat"
      shape="icon"
      icon={state.disliked ? 'custom-dislike' : 'custom-dislike-outline'}
      label={state.disliked ? 'Disliked' : 'Dislike'}
      pressed={state.disliked}
      class={state.disliked ? 'hs-button--on' : ''}
      onclick={() => void feedback.toggleDislike(entity)}
    />
  </span>
{/if}

<style>
  /* Layout glue only: the two toggles keep their buttons' own sizes. */
  .feedback {
    display: inline-flex;
    align-items: center;
  }
</style>
