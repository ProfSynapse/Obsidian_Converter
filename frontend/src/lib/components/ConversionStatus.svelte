<!-- src/lib/components/ConversionStatus.svelte -->

<script>
  import { onDestroy } from 'svelte';
  import { fade, fly, slide } from 'svelte/transition';
  import { conversionStatus } from '$lib/stores/conversionStatus.js';
  import { startConversion } from '$lib/utils/conversionManager.js';
  import Container from './common/Container.svelte';
  import { apiKey } from '$lib/stores';

  // Declare props
  export let apiKeyRequired;
  export let canStartConversion;

  // Component state
  let status = 'ready';
  let progress = 0;
  let error = null;
  let currentFile = null;
  let currentIcon = '🔄'; // Default icon

  // Subscribe to conversionStatus store
  const unsubscribe = conversionStatus.subscribe(value => {
    status = value.status;
    progress = value.progress;
    error = value.error;
    currentFile = value.currentFile;

    // Update currentIcon based on status
    switch (status) {
      case 'converting':
        currentIcon = '🕐';
        break;
      case 'completed':
        currentIcon = '✨';
        break;
      case 'error':
        currentIcon = '⚠️';
        break;
      case 'stopped':
        currentIcon = '🛑';
        break;
      default:
        currentIcon = '🔄';
    }
  });

  onDestroy(() => {
    unsubscribe();
  });

  /**
   * Shows feedback message
   */
  function showFeedback(message, type = 'info') {
    // Implement a method to show feedback to the user
    // For simplicity, using console.log. Replace with a toast or alert as needed.
    console.log(`${type.toUpperCase()}: ${message}`);
  }
</script>

<!-- Component Markup -->
<Container class="conversion-container">
  <div 
    class="conversion-controls"
    class:is-converting={status === 'converting'}
  >
    <!-- Convert Button -->
    <div class="button-wrapper">
      <button
        class="convert-button"
        class:loading={status === 'converting'}
        disabled={!canStartConversion}
        on:click={startConversion}
        aria-label="Start file conversion"
      >
        <span class="button-content">
          <span class="icon" class:rotating={status === 'converting'}>
            {currentIcon}
          </span>
          <span>
            {#if status === 'converting'}
              Converting...
            {:else}
              Start Conversion
            {/if}
          </span>
        </span>
      </button>
    </div>
  </div>

  <!-- Status Display -->
  <div class="status-section" in:fade={{ duration: 200 }}>
    {#if status !== 'ready'}
      <div 
        class="status-info {status}"
        in:fly={{ y: 20, duration: 300 }}
      >
        <span class="icon" class:rotating={status === 'converting'}>
          {currentIcon}
        </span>
        <span class="status-text">
          {#if status === 'converting'}
            Converting {#if currentFile}
              file {currentFile}
            {/if}
          {:else if status === 'completed'}
            Conversion Completed!
          {:else if status === 'error'}
            Error: {error}
          {:else if status === 'stopped'}
            Conversion Stopped
          {/if}
        </span>
      </div>

      <!-- Progress Bar -->
      {#if status === 'converting' || status === 'completed'}
        <div 
          class="progress-container"
          in:fly={{ y: 20, duration: 300, delay: 100 }}
        >
          <div class="progress-bar">
            <div 
              class="progress-fill"
              style="width: {progress}%"
            >
              <div class="progress-glow"></div>
            </div>
          </div>
          <span class="progress-text">{Math.round(progress)}%</span>
        </div>
      {/if}
    {/if}
  </div>

  <!-- API Key Warning -->
  {#if apiKeyRequired && !$apiKey}
    <div 
      class="api-key-warning" 
      role="alert"
      in:fly={{ y: 20, duration: 300 }}
    >
      <span class="icon">⚠️</span>
      <span>API key required for media file conversion</span>
    </div>
  {/if}
</Container>

<style>
  .conversion-controls {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md);
    align-items: center;
    width: 100%;
    padding: var(--spacing-md);
  }

  .status-section {
    width: 100%;
    max-width: 600px;
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
  }

  /* Status Info Styles */
  .status-info {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    font-size: var(--font-size-lg);
    font-weight: var(--font-weight-medium);
    padding: var(--spacing-sm) var(--spacing-md);
    border-radius: var(--rounded-lg);
    background: var(--color-background);
    box-shadow: var(--shadow-sm);
  }

  .status-info.converting { color: var(--color-prime); }
  .status-info.completed { color: var(--color-success); }
  .status-info.error { color: var(--color-error); }
  .status-info.stopped { color: var(--color-warning); }

  .progress-container {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    width: 100%;
  }

  .progress-bar {
    flex: 1;
    height: 8px;
    background: var(--color-background-secondary);
    border-radius: var(--rounded-full);
    overflow: hidden;
    position: relative;
  }

  .progress-fill {
    height: 100%;
    background: linear-gradient(
      90deg,
      var(--color-prime) 0%,
      var(--color-second) 100%
    );
    border-radius: var(--rounded-full);
    transition: width 0.3s ease;
    position: relative;
  }

  .progress-glow {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(
      90deg,
      transparent 0%,
      rgba(255, 255, 255, 0.2) 50%,
      transparent 100%
    );
    animation: shine 1.5s linear infinite;
  }

  .progress-text {
    min-width: 4em;
    text-align: right;
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
  }

  .button-wrapper {
    width: 100%;
    max-width: 300px;
    margin-top: var(--spacing-md);
  }

  .convert-button {
    width: 100%;
    padding: var(--spacing-md) var(--spacing-lg);
    background: var(--gradient-primary);
    border: none;
    border-radius: var(--rounded-lg);
    color: var(--color-text-on-dark);
    font-size: var(--font-size-lg);
    font-weight: var(--font-weight-medium);
    cursor: pointer;
    transition: all 0.3s ease;
    position: relative;
    overflow: hidden;
  }

  .convert-button:not(:disabled):hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow-lg);
  }

  .convert-button:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }

  .button-content {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-sm);
  }

  .rotating {
    animation: rotate 1s linear infinite;
  }

  @keyframes rotate {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  @keyframes shine {
    from { transform: translateX(-100%); }
    to { transform: translateX(100%); }
  }

  /* Responsive Design */
  @media (max-width: 768px) {
    .button-wrapper {
      max-width: 100%;
    }

    .status-info {
      font-size: var(--font-size-base);
    }
  }

  /* High Contrast Mode */
  @media (prefers-contrast: high) {
    .convert-button,
    .status-info {
      border: 2px solid currentColor;
    }
  }

  /* Reduced Motion */
  @media (prefers-reduced-motion: reduce) {
    .rotating,
    .progress-glow {
      animation: none;
    }

    .convert-button:hover {
      transform: none;
    }
  }
</style>
