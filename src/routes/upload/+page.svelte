<!--
  Upload music.

  Files are picked or dropped here and each one travels in its own request, so
  every file has its own bar: how much of it has been sent, whether the server
  is storing it, and what became of it. What the server answers and what it
  publishes on the event stream both land on the file they belong to.
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import { resolve } from '$app/paths';

  import { uploadLabel, uploads } from '#lib/library/upload.svelte';
  import { uploadFile } from '#lib/library/uploader';
  import { clientRoute } from '#lib/navigation';
  import { events } from '#lib/stores/events.svelte';
  import { session } from '#lib/stores/session.svelte';

  let dragging = $state(false);

  onMount(() =>
    events.on('upload.updated', (event) => {
      uploads.processing(event.data.uploadId);
    })
  );

  /**
   * Sends the files the picker answered with.
   *
   * @param event The change event of the file input.
   */
  function pick(event: Event): void {
    const input = event.currentTarget as HTMLInputElement;
    if (input.files !== null) {
      send(input.files);
      input.value = '';
    }
  }

  /**
   * Sends the files that were dropped on the page.
   *
   * @param event The drop event.
   */
  function drop(event: DragEvent): void {
    event.preventDefault();
    dragging = false;
    const files = event.dataTransfer?.files;
    if (files !== undefined && files !== null) {
      send(files);
    }
  }

  /**
   * Sends every file, one request each.
   *
   * @param files The files to send.
   */
  function send(files: Iterable<File>): void {
    for (const file of files) {
      const [item] = uploads.add([{ name: file.name }]);
      void begin(item.id, file);
    }
  }

  /**
   * Sends one file and records what the server made of it.
   *
   * @param id The item's identity in the queue.
   * @param file The file to send.
   */
  async function begin(id: number, file: File): Promise<void> {
    uploads.start(id);
    try {
      const outcome = await uploadFile(file, session.csrfToken, (percent) =>
        uploads.progress(id, percent)
      );
      if (outcome.status === 413) {
        uploads.tooLarge(id);
        return;
      }
      if (outcome.status >= 400) {
        uploads.fail(id, `the server answered HTTP ${outcome.status}`);
        return;
      }
      const entry = outcome.entries[0];
      if (entry === undefined) {
        uploads.fail(id, 'the server answered nothing about the file');
        return;
      }
      uploads.finish(id, entry);
    } catch (error) {
      uploads.fail(
        id,
        error instanceof Error && error.message !== ''
          ? error.message
          : 'the upload did not go through'
      );
    }
  }
</script>

<svelte:head>
  <title>Upload - Hearthsound</title>
</svelte:head>

<section>
  <h1>Upload music</h1>

  <div
    class="drop"
    class:drop-active={dragging}
    role="group"
    aria-label="Drop audio files"
    ondragover={(event) => {
      event.preventDefault();
      dragging = true;
    }}
    ondragleave={() => (dragging = false)}
    ondrop={drop}
  >
    <label class="drop-pick">
      <span>Choose files</span>
      <input type="file" accept="audio/*" multiple onchange={pick} />
    </label>
    <p class="drop-hint">Drop audio files here, or choose them.</p>
  </div>

  {#if uploads.items.length > 0}
    <ul class="upload-list">
      {#each uploads.items as item (item.id)}
        <li class="upload-item">
          <span class="upload-name">{item.fileName}</span>
          {#if item.state === 'uploading'}
            <progress class="upload-bar" value={item.percent} max="100"></progress>
          {/if}
          <span class="upload-state" role="status">{uploadLabel(item)}</span>
        </li>
      {/each}
    </ul>
  {/if}

  <p class="upload-link">
    <a href={resolve(clientRoute('/library/uploads'))}>See what you uploaded</a>
  </p>
</section>

<style>
  .drop {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    align-items: flex-start;
    padding: var(--space-4);
    border: var(--border-width) dashed var(--color-border);
    border-radius: var(--radius);
  }

  .drop-active {
    border-color: var(--color-accent);
    background: var(--color-bg-raised);
  }

  .drop-pick {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .drop-hint {
    margin: 0;
    color: var(--color-fg-muted);
  }

  .upload-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    margin: var(--space-4) 0 0;
    padding: 0;
    list-style: none;
  }

  .upload-item {
    display: flex;
    gap: var(--space-3);
    align-items: center;
  }

  .upload-name {
    flex: 0 1 20rem;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .upload-bar {
    flex: 1 1 12rem;
  }

  .upload-state {
    flex: none;
    color: var(--color-fg-muted);
    font-size: 0.875rem;
  }

  .upload-link {
    margin-top: var(--space-4);
  }

  .upload-link a {
    color: var(--color-fg);
  }
</style>
