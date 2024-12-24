<!-- src/lib/components/ResultDisplay.svelte -->

<script>
  import { files } from '$lib/stores/files.js';
  import { fade } from 'svelte/transition';
  import Container from './common/Container.svelte';
  import { derived } from 'svelte/store';

  // Derived store to get all converted files
  const convertedFiles = derived(files, $files => $files.filter(file => file.status === 'completed'));

  // Derived store to check if all files are processed
  const allConverted = derived(files, $files => 
    $files.length > 0 && $files.every(file => file.status === 'completed' || file.status === 'error')
  );
</script>

<div class="result-display" in:fade>
  <h2>
    <span class="icon">🎉</span>
    Conversion Results
  </h2>
  {#if $convertedFiles.length > 0}
    <ul class="result-list">
      {#each $convertedFiles as file (file.id)}
        <li class="result-item" in:fade out:fade>
          <div class="file-info">
            <span class="icon">📄</span>
            <span class="file-name">{file.name}</span>
            <span class="badge-success" title="Conversion successful">
              ✨ Success
            </span>
          </div>
        </li>
      {/each}
    </ul>
  {:else}
    <p class="no-results">No conversions completed yet.</p>
  {/if}
</div>

<style>
  .result-display {
    width: 100%;
    max-width: 800px; /* Increased max-width for better layout */
    margin: 0 auto;
    padding: var(--spacing-lg);
    background: var(--color-surface);
    border-radius: var(--rounded-lg);
    box-shadow: var(--shadow-sm);
    border: 1px solid var(--color-border);
    transition: all var(--transition-duration-normal) var(--transition-timing-ease);
  }

  .result-display h2 {
    margin-bottom: var(--spacing-md);
    font-size: var(--font-size-lg);
    color: var(--color-text-primary);
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
  }

  .result-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
  }

  .result-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--spacing-xs);
    padding: var(--spacing-2xs) var(--spacing-sm);
    border-bottom: 1px solid var(--color-background-secondary);
    transition: background 0.3s ease;
  }

  .result-item:hover {
    background: var(--color-background-hover);
  }

  .result-item:last-child {
    border-bottom: none;
  }

  .result-item .icon {
    font-size: var(--font-size-xl);
  }

  .file-info {
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
    flex: 1;
  }

  .file-name {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-weight: var(--font-weight-medium);
    color: var(--color-text-primary);
  }

  .badge-success {
    background-color: var(--color-success-light);
    color: var(--color-success);
    padding: 4px 8px;
    border-radius: var(--rounded-full);
    display: flex;
    align-items: center;
    gap: var(--spacing-2xs);
    font-size: var(--font-size-sm);
    transition: background 0.3s ease;
  }

  .download-button, .download-all-button, .batch-download {
    display: none;
  }

  .no-results {
    text-align: center;
    color: var(--color-text-secondary);
    padding: var(--spacing-lg);
  }

  /* Responsive Design */
  @media (max-width: 640px) {
    .result-display {
      padding: var(--spacing-md);
    }

    .result-display h2 {
      font-size: var(--font-size-base);
    }

    .result-item {
      gap: var(--spacing-2xs);
      padding: var(--spacing-2xs) var(--spacing-xs);
    }

    .result-item .icon {
      font-size: var(--font-size-lg);
    }

    .download-button, .download-all-button {
      padding: var(--spacing-xs) var(--spacing-2xs);
      font-size: var(--font-size-xs);
    }

    .download-all-button {
      max-width: 100%;
    }
  }

  /* High Contrast Mode */
  @media (prefers-contrast: high) {
    .badge-success {
      border: 2px solid currentColor;
    }
  }

  /* Reduced Motion */
  @media (prefers-reduced-motion: reduce) {
    .result-item {
      transition: none;
    }
  }
</style>
