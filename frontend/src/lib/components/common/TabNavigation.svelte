<!-- src/lib/components/common/TabNavigation.svelte -->
<script>
    import { uploadStore } from '../../stores/uploadStore';
    import { slide } from 'svelte/transition';
    
    const tabs = [
      { id: 'single', icon: '🔗', label: 'Single URL', description: 'Convert a single webpage' },
      { id: 'parent', icon: '🗺️', label: 'Parent URL', description: 'Convert multiple linked pages' },
      { id: 'youtube', icon: '🎥', label: 'YouTube', description: 'Convert YouTube videos' }
    ];
  </script>
  
  <nav class="tabs-nav" role="tablist">
    <div class="tabs-container">
      {#each tabs as tab}
        <button
          class="tab-button"
          class:active={$uploadStore.activeTab === tab.id}
          on:click={() => uploadStore.setActiveTab(tab.id)}
          aria-selected={$uploadStore.activeTab === tab.id}
          role="tab"
          aria-controls="tab-content-{tab.id}"
          title={tab.description}
        >
          <span class="tab-icon" aria-hidden="true">{tab.icon}</span>
          <span class="tab-label">{tab.label}</span>
          {#if $uploadStore.activeTab === tab.id}
            <div class="active-indicator" transition:slide></div>
          {/if}
        </button>
      {/each}
    </div>
  </nav>
  
  <style>
    .tabs-nav {
      width: 100%;
      background: var(--color-surface);
      padding: var(--spacing-xs);
      border-radius: var(--rounded-lg);
      box-shadow: var(--shadow-sm);
    }
  
    .tabs-container {
      display: flex;
      gap: var(--spacing-xs);
    }
  
    .tab-button {
      flex: 1;
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: var(--spacing-xs);
      padding: var(--spacing-sm) var(--spacing-md);
      background: transparent;
      border: none;
      border-radius: var(--rounded-md);
      color: var(--color-text-secondary);
      font-size: var(--font-size-sm);
      font-weight: var(--font-weight-medium);
      cursor: pointer;
      transition: all var(--transition-duration-normal);
      overflow: hidden;
    }
  
    .tab-button:hover:not(.active) {
      background: var(--color-background);
      color: var(--color-text);
    }
  
    .tab-button.active {
      color: var(--color-prime);
      background: var(--color-background);
    }
  
    .tab-icon {
      font-size: 1.2em;
    }
  
    .active-indicator {
      position: absolute;
      bottom: 0;
      left: 0;
      width: 100%;
      height: 2px;
      background: var(--color-prime);
      border-radius: var(--rounded-full);
    }
  
    @media (max-width: 640px) {
      .tabs-container {
        flex-direction: column;
      }
  
      .tab-button {
        justify-content: flex-start;
        padding: var(--spacing-sm);
      }
    }
  
    /* High Contrast Mode */
    @media (prefers-contrast: high) {
      .tab-button {
        border: 1px solid currentColor;
      }
      
      .tab-button.active {
        border-width: 2px;
      }
    }
  
    /* Reduced Motion */
    @media (prefers-reduced-motion: reduce) {
      .tab-button {
        transition: none;
      }
    }
  </style>