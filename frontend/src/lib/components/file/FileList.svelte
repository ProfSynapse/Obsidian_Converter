<!-- src/lib/components/file/FileList.svelte -->
<script>
  import { files, FileStatus } from '$lib/stores/files.js';
  import { fade, slide } from 'svelte/transition';
  import FileCard from './FileCard.svelte';
  import { createEventDispatcher } from 'svelte';
  
  const dispatch = createEventDispatcher();

  /**
   * Handles individual file removal
   * @param {CustomEvent} event - The removal event
   */
  function handleRemove(event) {
      const { id } = event.detail;
      if (!id) return;

      const result = files.removeFile(id);
      if (result.success) {
          dispatch('fileRemoved', { id, file: result.file });
      } else {
          console.error('Error removing file:', result.message);
      }
  }

  /**
   * Handles file selection
   * @param {CustomEvent} event - The selection event
   */
  function handleSelect(event) {
      const { id, selected } = event.detail;
      if (!id) return;

      const result = files.updateFile(id, { selected });
      if (result.success) {
          dispatch('fileSelected', { id, selected, file: result.file });
      }
  }

  // Reactive declarations
  $: hasFiles = $files && $files.length > 0;
  $: selectedCount = $files.filter(f => f.selected).length;
</script>

{#if hasFiles}
  <div class="file-list" in:slide>
      {#each $files as file (file.id)}
          <div 
              class="file-item"
              in:fade={{ duration: 200 }}
              out:fade={{ duration: 150 }}
          >
              <FileCard 
                  {file}
                  on:remove={handleRemove}
                  on:select={handleSelect}
              />
          </div>
      {/each}
  </div>
{:else}
  <div class="empty-state" in:fade>
      <p>No files added yet.</p>
  </div>
{/if}

<style>
  .file-list {
      display: flex;
      flex-direction: column;
      gap: var(--spacing-sm);
      width: 100%;
  }

  .file-item {
      width: 100%;
  }

  .empty-state {
      text-align: center;
      padding: var(--spacing-lg);
      color: var(--color-text-secondary);
  }

  /* Animation support */
  @media (prefers-reduced-motion: reduce) {
      .file-list, .file-item {
          transition: none;
      }
  }
</style>