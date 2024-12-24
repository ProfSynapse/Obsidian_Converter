<!-- src/lib/components/file/FileCard.svelte -->
<script>
  import { createEventDispatcher } from 'svelte';
  import { fade, slide } from 'svelte/transition';
  import { FileStatus } from '$lib/stores/files.js';
  
  export let file;
  
  const dispatch = createEventDispatcher();

  // Status configurations
  const STATUS_CONFIG = {
      [FileStatus.COMPLETED]: {
          icon: '✨',
          label: 'Success',
          class: 'success'
      },
      [FileStatus.ERROR]: {
          icon: '⚠️',
          label: 'Error',
          class: 'error'
      },
      [FileStatus.CONVERTING]: {
          icon: '🔄',
          label: 'Converting',
          class: 'converting'
      },
      [FileStatus.UPLOADING]: {
          icon: '⬆️',
          label: 'Uploading',
          class: 'uploading'
      },
      [FileStatus.PENDING]: {
          icon: '⏳',
          label: 'Ready',
          class: 'Ready'
      }
  };

  // Get status configuration
  $: statusConfig = STATUS_CONFIG[file.status] || STATUS_CONFIG[FileStatus.IDLE];

  /**
   * Handles file removal
   */
  function handleRemove() {
      dispatch('remove', { id: file.id });
  }

  /**
   * Handles file selection
   */
  function handleSelect() {
      dispatch('select', { 
          id: file.id, 
          selected: !file.selected 
      });
  }
</script>

<div 
  class="file-card"
  class:is-selected={file.selected}
  in:fade
>
  <!-- Selection checkbox -->
  <div class="select-area">
      <input
          type="checkbox"
          checked={file.selected}
          on:change={handleSelect}
          aria-label={`Select ${file.name}`}
          class="select-checkbox"
      />
  </div>

  <!-- File info -->
  <div class="file-info">
      <span class="icon" aria-hidden="true">
          {#if file.type === 'youtube'}
              🎥
          {:else if file.type === 'url'}
              🔗
          {:else}
              📄
          {/if}
      </span>

      <span class="file-name" title={file.name}>
          {file.name}
      </span>

      <!-- Status badge -->
      <span 
          class="badge badge-{statusConfig.class}" 
          title={`Status: ${statusConfig.label}`}
      >
          <span class="badge-icon" class:rotating={file.status === FileStatus.CONVERTING}>
              {statusConfig.icon}
          </span>
          <span class="badge-label">{statusConfig.label}</span>
          {#if file.progress > 0 && file.progress < 100}
              <span class="badge-progress">({file.progress}%)</span>
          {/if}
      </span>
  </div>

  <!-- Actions -->
  <div class="actions">
      <button 
          class="action-button remove-button" 
          on:click={handleRemove}
          aria-label={`Remove ${file.name}`}
          title="Remove file"
      >
          🗑️
      </button>
  </div>
</div>

<style>
  .file-card {
      display: flex;
      align-items: center;
      gap: var(--spacing-sm);
      padding: var(--spacing-sm);
      background: var(--color-surface);
      border-radius: var(--rounded-md);
      transition: all var(--transition-duration-normal) ease;
      border: 1px solid var(--color-border);
  }

  .file-card:hover {
      background: var(--color-background-hover);
      transform: translateY(-1px);
      box-shadow: var(--shadow-sm);
  }

  .file-card.is-selected {
      background: var(--color-background-selected);
      border-color: var(--color-prime);
  }

  .select-area {
      display: flex;
      align-items: center;
      padding-right: var(--spacing-xs);
  }

  .select-checkbox {
      width: 18px;
      height: 18px;
      cursor: pointer;
  }

  .file-info {
      display: flex;
      align-items: center;
      gap: var(--spacing-sm);
      flex: 1;
      min-width: 0;
  }

  .file-name {
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-weight: var(--font-weight-medium);
      color: var(--color-text);
  }

  .badge {
      display: flex;
      align-items: center;
      gap: var(--spacing-2xs);
      padding: var(--spacing-2xs) var(--spacing-xs);
      border-radius: var(--rounded-full);
      font-size: var(--font-size-sm);
      font-weight: var(--font-weight-medium);
      white-space: nowrap;
  }

  .badge-success {
      background: var(--color-success-light);
      color: var(--color-success);
  }

  .badge-error {
      background: var(--color-error-light);
      color: var(--color-error);
  }

  .badge-pending, .badge-idle {
      background: var(--color-warning-light);
      color: var(--color-warning);
  }

  .badge-converting, .badge-uploading {
      background: var(--color-prime-light);
      color: var(--color-prime);
  }

  .badge-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
  }

  .badge-icon.rotating {
      animation: rotate 1.5s linear infinite;
  }

  .actions {
      display: flex;
      align-items: center;
      gap: var(--spacing-xs);
  }

  .action-button {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      border: none;
      border-radius: var(--rounded-md);
      background: transparent;
      cursor: pointer;
      transition: all var(--transition-duration-normal) ease;
  }

  .action-button:hover {
      background: var(--color-background);
  }

  .remove-button {
      color: var(--color-error);
  }

  .remove-button:hover {
      color: var(--color-error-dark);
      background: var(--color-error-light);
  }

  @keyframes rotate {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
  }

  /* Accessibility */
  @media (prefers-reduced-motion: reduce) {
      .file-card {
          transform: none;
          transition: none;
      }

      .badge-icon.rotating {
          animation: none;
      }
  }

  /* High Contrast */
  @media (prefers-contrast: high) {
      .file-card {
          border: 2px solid currentColor;
      }

      .badge {
          border: 1px solid currentColor;
      }
  }
</style>