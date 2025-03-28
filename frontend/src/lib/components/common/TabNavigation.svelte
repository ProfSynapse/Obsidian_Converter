<!-- src/lib/components/common/TabNavigation.svelte -->
<script>
    import { uploadStore } from '../../stores/uploadStore';
    import { fade } from 'svelte/transition';
    
    const tabs = [
      { id: 'single', icon: '🔗', label: 'Single URL', description: 'Convert a single webpage' },
      { id: 'parent', icon: '🗺️', label: 'Parent URL', description: 'Convert multiple linked pages' }
      // { id: 'youtube', icon: '🎥', label: 'YouTube', description: 'Convert YouTube videos' }
    ];
</script>

<div class="tabs-nav" role="tablist">
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
        <div class="tab-content" in:fade={{ duration: 200 }}>
          <span class="tab-icon" aria-hidden="true">{tab.icon}</span>
          <span class="tab-label">{tab.label}</span>
        </div>
      </button>
    {/each}
    </div>
</div>

<style>
    .tabs-nav {
      width: 100%;
      background: transparent;
      padding: var(--spacing-xs);
      margin-bottom: var(--spacing-md);
    }
  
    .tabs-container {
      display: flex;
      gap: var(--spacing-sm);
      position: relative;
      z-index: 1;
      padding: var(--spacing-2xs);
    }
  
    .tab-button {
      flex: 1;
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: var(--spacing-sm);
      background: transparent;
      border: none;
      border-radius: var(--rounded-lg);
      color: var(--color-text-secondary);
      font-size: var(--font-size-base);
      font-weight: var(--font-weight-medium);
      cursor: pointer;
      transition: all var(--transition-duration-normal);
      overflow: hidden;
    }

    .tab-button::before {
      content: "";
      position: absolute;
      inset: 0;
      background: linear-gradient(135deg, var(--color-prime), var(--color-second));
      opacity: 0;
      transition: opacity var(--transition-duration-normal);
      border-radius: var(--rounded-lg);
    }

    .tab-button:hover:not(.active)::before {
      opacity: 0.05;
    }

    .tab-button.active::before {
      opacity: 0.1;
    }

    .tab-content {
      display: flex;
      align-items: center;
      gap: var(--spacing-xs);
      position: relative;
      z-index: 1;
    }
  
    .tab-icon {
      font-size: 1.2em;
      transition: transform var(--transition-duration-normal);
    }

    .tab-label {
      font-weight: var(--font-weight-medium);
      transition: color var(--transition-duration-normal);
    }

    .tab-button:hover .tab-icon,
    .tab-button.active .tab-icon {
      transform: scale(1.1);
    }

    .tab-button.active .tab-label {
      color: var(--color-text);
    }
  
    @media (max-width: 640px) {
      .tabs-container {
        flex-direction: column;
        padding: var(--spacing-2xs);
        gap: var(--spacing-xs);
      }
  
      .tab-button {
        padding: var(--spacing-xs) var(--spacing-sm);
      }

      .tab-content {
        justify-content: flex-start;
      }

      .tab-icon {
        font-size: 1.1em;
      }
    }
  
    /* High Contrast Mode */
    @media (prefers-contrast: high) {
      .tab-button.active::before {
        opacity: 0.3;
      }
    }
  
    /* Reduced Motion */
    @media (prefers-reduced-motion: reduce) {
      .tab-button,
      .tab-icon,
      .tab-label {
        transition: none;
      }

      .tab-button:hover .tab-icon,
      .tab-button.active .tab-icon {
        transform: none;
      }
    }
</style>
