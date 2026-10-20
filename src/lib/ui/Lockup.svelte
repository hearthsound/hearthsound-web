<!--
  The Hearthsound lockup (i03).

  The mark follows the colour scheme from the appearance store's data
  attribute or, when none is set, the system preference. The text is the small
  or the large size; the sidebar supplies an `href` so the lockup is the Home
  link, while the onboarding frames leave it as plain text.

  Usage: `<Lockup />`, `<Lockup large />`, `<Lockup href={resolve('/')} />`
-->
<script lang="ts">
  import markDark from '@hearthsound/design/identity/mark/mark-dark.svg?url';
  import markLight from '@hearthsound/design/identity/mark/mark-light.svg?url';

  /** Props of the lockup. */
  interface Props {
    /** Draws the 46 px mark and 34 px name of the split sign-in panel. */
    large?: boolean;
    /** The page the lockup links to; plain text when absent. */
    href?: string;
  }

  let { large = false, href }: Props = $props();
</script>

{#snippet content()}
  <img class="lockup-mark-light" src={markLight} alt="" />
  <img class="lockup-mark-dark" src={markDark} alt="" />
  Hearthsound
{/snippet}

{#if href === undefined}
  <span class="hs-lockup" class:hs-lockup--large={large}>{@render content()}</span>
{:else}
  <!-- The caller resolves the route before passing it (the shell uses resolve('/')). -->
  <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
  <a class="hs-lockup" class:hs-lockup--large={large} {href}>{@render content()}</a>
{/if}

<style>
  /* i03: the lockup's mark follows the scheme, from the data attribute the
     appearance store writes or, with none, from the system preference. */
  .lockup-mark-dark {
    display: none;
  }

  :global([data-scheme='dark']) .lockup-mark-light {
    display: none;
  }

  :global([data-scheme='dark']) .lockup-mark-dark {
    display: inline;
  }

  @media (prefers-color-scheme: dark) {
    :global(html:not([data-scheme='light'])) .lockup-mark-light {
      display: none;
    }

    :global(html:not([data-scheme='light'])) .lockup-mark-dark {
      display: inline;
    }
  }
</style>
