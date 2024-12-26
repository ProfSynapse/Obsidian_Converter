<!-- src/lib/components/file/FileListHeader.svelte -->
<script>
    import { createEventDispatcher } from 'svelte';
    import { slide, fade } from 'svelte/transition';
    import SelectionControls from '../common/SelectionControls.svelte';
    import ApiKeyInput from '../ApiKeyInput.svelte';
    import { requiresApiKey } from '$lib/utils/fileUtils.js';
    import { files } from '$lib/stores/files.js';
    import { apiKey } from '$lib/stores/apiKey.js';
  
    const dispatch = createEventDispatcher();
  
    export let title = 'Files';
    export let selectedCount = 0;
    export let totalCount = 0;
    export let showSelectionControls = true;
    export let actions = [
      { 
        id: 'remove', 
        label: 'Remove', 
        icon: '🗑️', 
        variant: 'danger' 
      }
    ];
  
    $: needsApiKey = $files.some(file => requiresApiKey(file));
  
    // Handle selection controls events
    function handleSelect(event) {
      dispatch('select', event.detail);
    }
  
    function handleAction(event) {
      dispatch('action', event.detail);
    }
</script>
  
<header class="file-list-header">
    <div class="title-section">
      <h3 class="title">
        <span class="icon">📑</span>
        <span>{title}</span>
        {#if totalCount > 0}
          <span 
            class="count-badge"
            transition:fade
          >
            {totalCount} {totalCount === 1 ? 'file' : 'files'}
          </span>
        {/if}
      </h3>

      {#if needsApiKey && !$apiKey}
        <div class="api-key-warning" transition:slide>
          <span class="warning-icon">⚠️</span>
          <span>API key required for audio/video files</span>
          <ApiKeyInput />
        </div>
      {/if}
    </div>
  
    {#if showSelectionControls && totalCount > 0}
      <div 
        class="controls-section"
        transition:slide
      >
        <SelectionControls
          {selectedCount}
          {totalCount}
          {actions}
          on:select={handleSelect}
          on:action={handleAction}
        />
      </div>
    {/if}
  </header>
  
  <style>
    .file-list-header {
      display: flex;
      flex-direction: column;
      gap: var(--spacing-sm);
      padding-bottom: var(--spacing-md);
      border-bottom: 1px solid var(--color-border);
    }
  
    .title-section {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
  
    .title {
      display: flex;
      align-items: center;
      gap: var(--spacing-xs);
      margin: 0;
      font-size: var(--font-size-lg);
      font-weight: var(--font-weight-semibold);
      color: var(--color-text-primary);
    }
  
    .count-badge {
      font-size: var(--font-size-sm);
      color: var(--color-text-secondary);
      background: var(--color-background);
      padding: 2px var(--spacing-xs);
      border-radius: var(--rounded-full);
      margin-left: var(--spacing-xs);
    }
  
    .controls-section {
      display: flex;
      flex-wrap: wrap;
      gap: var(--spacing-sm);
    }
  
    /* Responsive Design */
    @media (min-width: 640px) {
      .file-list-header {
        flex-direction: row;
        align-items: center;
        justify-content: space-between;
      }
    }
  
    /* High Contrast */
    @media (prefers-contrast: high) {
      .count-badge {
        border: 1px solid currentColor;
      }
    }

    .api-key-warning {
        display: flex;
        align-items: center;
        gap: var(--spacing-sm);
        padding: var(--spacing-sm);
        background: var(--color-warning-light);
        border-radius: var(--rounded-md);
        margin-top: var(--spacing-sm);
        font-size: var(--font-size-sm);
    }

    .warning-icon {
        font-size: var(--font-size-lg);
    }
  </style>