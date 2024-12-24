<!-- src/lib/components/common/DropZone.svelte -->
<script>
    import { createEventDispatcher } from 'svelte';
    import { fade, scale } from 'svelte/transition';
    import { uploadStore } from '../../stores/uploadStore';
  
    export let acceptedTypes = [];
    let fileInput;
    let dragCounter = 0;
    
    const dispatch = createEventDispatcher();
  
    function handleDrop(event) {
      event.preventDefault();
      uploadStore.setDragOver(false);
      dragCounter = 0;
      
      const files = Array.from(event.dataTransfer.files);
      dispatch('filesDropped', { files });
    }
  
    function handleDragEnter(event) {
      event.preventDefault();
      dragCounter++;
      uploadStore.setDragOver(true);
    }
  
    function handleDragLeave(event) {
      event.preventDefault();
      dragCounter--;
      if (dragCounter === 0) {
        uploadStore.setDragOver(false);
      }
    }
  
    function handleFileSelect(event) {
      const files = Array.from(event.target.files);
      dispatch('filesSelected', { files });
      event.target.value = ''; // Reset input
    }
  
    // Format accepted file types for display
    $: displayTypes = acceptedTypes
      .map(type => type.toUpperCase())
      .join(', ');
  </script>
  
  <div 
    class="drop-zone"
    class:drag-over={$uploadStore.dragOver}
    on:dragenter={handleDragEnter}
    on:dragleave={handleDragLeave}
    on:dragover|preventDefault
    on:drop={handleDrop}
    on:click={() => fileInput.click()}
    on:keydown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileInput.click(); }}
    role="button"
    tabindex="0"
  >
    <input
      type="file"
      multiple
      accept={acceptedTypes.map(ext => `.${ext}`).join(',')}
      class="file-input"
      bind:this={fileInput}
      on:change={handleFileSelect}
    />
    
    <div class="drop-zone-content" in:scale={{ duration: 200 }}>
      <!-- Default State -->
      {#if !$uploadStore.dragOver}
        <div class="icon-container">
          <span class="icon primary">📂</span>
          <span class="icon secondary">📄</span>
        </div>
        <div class="text-content">
          <p class="primary-text">Drag and drop files here</p>
          <p class="secondary-text">or click to select files</p>
          <p class="file-types">Supported formats: {displayTypes}</p>
        </div>
      <!-- Drag Over State -->
      {:else}
        <div class="icon-container" in:scale={{ duration: 200 }}>
          <span class="icon primary">📥</span>
        </div>
        <p class="primary-text">Drop files to convert!</p>
      {/if}
    </div>
  </div>
  
  <style>
    .drop-zone {
      width: 100%;
      min-height: 200px;
      border: 2px dashed var(--color-border);
      border-radius: var(--rounded-lg);
      background: var(--color-surface);
      transition: all var(--transition-duration-normal);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: var(--spacing-xl);
    }
  
    .drop-zone:hover {
      border-color: var(--color-prime);
      background: var(--color-background);
    }
  
    .drop-zone.drag-over {
      border-color: var(--color-prime);
      border-style: solid;
      background: var(--color-background);
      transform: scale(1.02);
      box-shadow: var(--shadow-md);
    }
  
    .drop-zone-content {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--spacing-md);
      text-align: center;
    }
  
    .icon-container {
      position: relative;
      height: 60px;
      width: 60px;
    }
  
    .icon {
      position: absolute;
      font-size: var(--font-size-3xl);
      transition: all var(--transition-duration-normal);
    }
  
    .icon.primary {
      left: 50%;
      top: 50%;
      transform: translate(-50%, -50%);
      z-index: 2;
    }
  
    .icon.secondary {
      left: 60%;
      top: 60%;
      transform: translate(-50%, -50%) scale(0.6);
      opacity: 0.6;
      z-index: 1;
    }
  
    .text-content {
      display: flex;
      flex-direction: column;
      gap: var(--spacing-xs);
    }
  
    .primary-text {
      font-size: var(--font-size-lg);
      font-weight: var(--font-weight-medium);
      color: var(--color-text);
      margin: 0;
    }
  
    .secondary-text {
      font-size: var(--font-size-base);
      color: var(--color-text-secondary);
      margin: 0;
    }
  
    .file-types {
      font-size: var(--font-size-sm);
      color: var(--color-text-secondary);
      margin-top: var(--spacing-sm);
    }
  
    .file-input {
      display: none;
    }
  
    /* Hover Effects */
    .drop-zone:hover .icon.primary {
      transform: translate(-50%, -50%) scale(1.1);
    }
  
    .drop-zone:hover .icon.secondary {
      transform: translate(-50%, -50%) scale(0.7);
      opacity: 0.8;
    }
  
    /* Dark Mode */
    @media (prefers-color-scheme: dark) {
      .drop-zone {
        background: var(--color-background);
      }
  
      .drop-zone:hover,
      .drop-zone.drag-over {
        background: var(--color-surface);
      }
    }
  
    /* Mobile Adjustments */
    @media (max-width: 640px) {
      .drop-zone {
        min-height: 160px;
        padding: var(--spacing-lg);
      }
  
      .icon-container {
        height: 48px;
        width: 48px;
      }
  
      .primary-text {
        font-size: var(--font-size-base);
      }
  
      .secondary-text {
        font-size: var(--font-size-sm);
      }
    }
  
    /* High Contrast Mode */
    @media (prefers-contrast: high) {
      .drop-zone {
        border-width: 3px;
      }
    }
  
    /* Reduced Motion */
    @media (prefers-reduced-motion: reduce) {
      .drop-zone,
      .icon {
        transition: none;
      }
  
      .drop-zone.drag-over {
        transform: none;
      }
    }
  </style>