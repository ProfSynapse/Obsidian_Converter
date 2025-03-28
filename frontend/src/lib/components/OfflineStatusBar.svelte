<!--
  OfflineStatusBar.svelte
  Displays the current online status and provides offline functionality controls.
  
  This component shows the current network status, API connectivity,
  and provides controls for managing offline operations.
  
  Related files:
  - lib/stores/offlineStore.js: Offline state management
  - lib/services/api.js: API client with offline support
-->

<script>
  import { onMount, onDestroy } from 'svelte';
  import { fade, slide } from 'svelte/transition';
  import { offlineStore } from '$lib/stores/offlineStore';
  
  // Local state
  let expanded = false;
  let queuedOperations = [];
  let showQueuedOperations = false;
  
  // Handle offline events
  function handleOfflineEvent(event) {
    const { type, online, status, operation } = event.data;
    
    if (type === 'status-change') {
      offlineStore.setOnlineStatus(online);
    } else if (type === 'api-status') {
      offlineStore.setApiStatus(status);
    } else if (type === 'operation-complete' || type === 'operation-failed') {
      // Refresh queued operations
      loadQueuedOperations();
    }
  }
  
  // Load queued operations
  async function loadQueuedOperations() {
    try {
      const operations = await window.electronAPI.getQueuedOperations();
      queuedOperations = operations;
    } catch (error) {
      console.error('Failed to load queued operations:', error);
    }
  }
  
  // Clear cache
  async function clearCache() {
    try {
      await window.electronAPI.clearCache();
      alert('Cache cleared successfully');
    } catch (error) {
      console.error('Failed to clear cache:', error);
      alert(`Failed to clear cache: ${error.message}`);
    }
  }
  
  // Toggle expanded state
  function toggleExpanded() {
    expanded = !expanded;
    if (expanded) {
      loadQueuedOperations();
    }
  }
  
  // Toggle queued operations visibility
  function toggleQueuedOperations() {
    showQueuedOperations = !showQueuedOperations;
    if (showQueuedOperations) {
      loadQueuedOperations();
    }
  }
  
  // Format timestamp
  function formatTime(timestamp) {
    return new Date(timestamp).toLocaleTimeString();
  }
  
  // Setup on mount
  onMount(async () => {
    // Get initial status
    try {
      const status = await window.electronAPI.getOfflineStatus();
      offlineStore.setOnlineStatus(status.online);
      offlineStore.setApiStatus(status.apiStatus);
    } catch (error) {
      console.error('Failed to get offline status:', error);
    }
    
    // Listen for offline events
    window.electronAPI.onOfflineEvent(handleOfflineEvent);
  });
  
  // Cleanup on destroy
  onDestroy(() => {
    // Remove event listener (if possible in Electron context)
    // This depends on how the preload script handles event removal
  });
</script>

<div class="offline-status-bar" class:expanded>
  <div class="status-indicator" on:click={toggleExpanded}>
    <div class="status-icon" class:online={$offlineStore.online}>
      {#if $offlineStore.online}
        <span class="icon">🟢</span>
      {:else}
        <span class="icon">🔴</span>
      {/if}
    </div>
    <div class="status-text">
      {$offlineStore.online ? 'Online' : 'Offline'}
    </div>
    <div class="expand-icon">
      {expanded ? '▲' : '▼'}
    </div>
  </div>
  
  {#if expanded}
    <div class="expanded-content" transition:slide={{ duration: 300 }}>
      <div class="api-status">
        <h4>API Status</h4>
        <ul>
          {#each Object.entries($offlineStore.apiStatus) as [api, status]}
            <li>
              <span class="api-name">{api}:</span>
              <span class="api-status-indicator" class:online={status}>
                {status ? '🟢 Connected' : '🔴 Disconnected'}
              </span>
            </li>
          {/each}
        </ul>
      </div>
      
      <div class="offline-controls">
        <button on:click={toggleQueuedOperations} class="control-button">
          {showQueuedOperations ? 'Hide' : 'Show'} Queued Operations ({queuedOperations.length})
        </button>
        <button on:click={clearCache} class="control-button">
          Clear Cache
        </button>
      </div>
      
      {#if showQueuedOperations}
        <div class="queued-operations" transition:fade={{ duration: 200 }}>
          <h4>Queued Operations</h4>
          {#if queuedOperations.length === 0}
            <p class="empty-message">No operations in queue</p>
          {:else}
            <ul>
              {#each queuedOperations as operation}
                <li>
                  <div class="operation-type">{operation.type}</div>
                  <div class="operation-time">{formatTime(operation.timestamp)}</div>
                </li>
              {/each}
            </ul>
          {/if}
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .offline-status-bar {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    background-color: #f5f5f5;
    border-top: 1px solid #ddd;
    z-index: 1000;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
  }
  
  .status-indicator {
    display: flex;
    align-items: center;
    padding: 8px 16px;
    cursor: pointer;
    user-select: none;
  }
  
  .status-icon {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    margin-right: 8px;
    background-color: #ff3e3e;
  }
  
  .status-icon.online {
    background-color: #4caf50;
  }
  
  .icon {
    font-size: 12px;
  }
  
  .status-text {
    flex-grow: 1;
    font-size: 14px;
    font-weight: 500;
  }
  
  .expand-icon {
    font-size: 12px;
    color: #666;
  }
  
  .expanded-content {
    padding: 16px;
    border-top: 1px solid #ddd;
    background-color: #fff;
  }
  
  .api-status h4, .queued-operations h4 {
    margin-top: 0;
    margin-bottom: 8px;
    font-size: 14px;
    font-weight: 600;
    color: #333;
  }
  
  .api-status ul, .queued-operations ul {
    list-style: none;
    padding: 0;
    margin: 0;
  }
  
  .api-status li, .queued-operations li {
    display: flex;
    padding: 4px 0;
    font-size: 13px;
  }
  
  .api-name {
    width: 100px;
    font-weight: 500;
  }
  
  .api-status-indicator {
    color: #ff3e3e;
  }
  
  .api-status-indicator.online {
    color: #4caf50;
  }
  
  .offline-controls {
    display: flex;
    gap: 8px;
    margin: 16px 0;
  }
  
  .control-button {
    padding: 6px 12px;
    background-color: #f0f0f0;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 13px;
    cursor: pointer;
  }
  
  .control-button:hover {
    background-color: #e0e0e0;
  }
  
  .queued-operations {
    margin-top: 16px;
  }
  
  .empty-message {
    font-size: 13px;
    color: #666;
    font-style: italic;
  }
  
  .operation-type {
    flex-grow: 1;
    font-weight: 500;
  }
  
  .operation-time {
    color: #666;
    font-size: 12px;
  }
</style>
