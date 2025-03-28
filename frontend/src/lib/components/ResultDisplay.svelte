<script>
  import { createEventDispatcher } from 'svelte';
  import { fade } from 'svelte/transition';
  import Button from './common/Button.svelte';
  import Container from './common/Container.svelte';
  import ProgressBar from './common/ProgressBar.svelte';
  import { conversionStatus, currentFile } from '$lib/stores/conversionStatus.js';
  import { conversionResult } from '$lib/stores/conversionResult.js';
  import { triggerDownload } from '$lib/utils/conversionManager.js';
  import electronClient from '$lib/api/electron';
  import fileSystemOperations from '$lib/api/electron/fileSystem.js';

  const dispatch = createEventDispatcher();

  // Check if we're running in Electron
  let isElectron = false;
  $: {
    isElectron = electronClient.isRunningInElectron();
  }

  // Reactive declarations for status
  $: isConverting = $conversionStatus.status === 'converting';
  $: isCompleted = $conversionStatus.status === 'completed';
  $: hasError = $conversionStatus.error !== null;
  
  // Format current file name for display
  $: currentFileName = $currentFile ? 
    ($currentFile.length > 30 ? 
      $currentFile.substring(0, 27) + '...' : 
      $currentFile) : 
    '';

  // Get status message
  $: statusMessage = getStatusMessage($conversionStatus.status, $conversionStatus.error);

  // Check if we have a native file path result
  $: hasNativeResult = $conversionResult && $conversionResult.isNative && $conversionResult.outputPath;

  function getStatusMessage(status, error) {
    switch(status) {
      case 'converting':
        return '🔄 Converting your files...';
      case 'completed':
        return '✨ Conversion completed!';
      case 'error':
        return `❌ ${error || 'An error occurred during conversion'}`;
      case 'cancelled':
        return '⚠️ Conversion cancelled';
      default:
        return '⏳ Preparing conversion...';
    }
  }

  /**
   * Opens the file in the default application
   */
  async function openFile() {
    if (!isElectron || !$conversionResult?.outputPath) return;
    
    try {
      await fileSystemOperations.openFile($conversionResult.outputPath);
    } catch (error) {
      console.error('Error opening file:', error);
    }
  }
  
  /**
   * Shows the file in the file explorer
   */
  async function showInFolder() {
    if (!isElectron || !$conversionResult?.outputPath) return;
    
    try {
      await fileSystemOperations.showItemInFolder($conversionResult.outputPath);
    } catch (error) {
      console.error('Error showing file in folder:', error);
    }
  }
  
  /**
   * Copies the file path to the clipboard
   */
  function copyPath() {
    if (!$conversionResult?.outputPath) return;
    
    try {
      navigator.clipboard.writeText($conversionResult.outputPath);
    } catch (error) {
      console.error('Error copying path:', error);
    }
  }
</script>

<Container>
  <div class="conversion-status" transition:fade>
    {#if isConverting || isCompleted || hasError}
      <div class="status-message">
        <p class="message">{statusMessage}</p>
        {#if currentFileName && isConverting}
          <p class="current-file">Processing: {currentFileName}</p>
        {/if}
      </div>

      <div class="progress-section">
        <div class="progress-container">
          <ProgressBar 
            value={$conversionStatus.progress} 
            color={hasError ? 'var(--color-error)' : 'var(--color-prime)'}
            height="8px"
          />
          <span class="progress-text">
            {$conversionStatus.progress.toFixed(0)}%
          </span>
        </div>
      </div>

      {#if isCompleted}
        <div class="button-container">
          {#if $conversionResult}
            {#if isElectron && hasNativeResult}
              <!-- Electron-specific buttons for native file system -->
              <Button 
                variant="primary"
                size="large"
                on:click={openFile}
              >
                Open File
              </Button>
              <Button 
                variant="secondary"
                size="large"
                on:click={showInFolder}
              >
                Show in Folder
              </Button>
            {:else}
              <!-- Web download button -->
              <Button 
                variant="primary"
                size="large"
                on:click={() => triggerDownload()}
              >
                Download Files
              </Button>
            {/if}
          {/if}
          <Button 
            variant={$conversionResult ? "secondary" : "primary"}
            size="large"
            on:click={() => window.location.reload()}
          >
            Convert More Files
          </Button>
        </div>
        
        {#if isElectron && hasNativeResult}
          <div class="path-display">
            <span class="path-label">Output:</span>
            <span class="path-value">{$conversionResult.outputPath}</span>
            <button 
              class="copy-button" 
              on:click={copyPath}
              title="Copy path to clipboard"
            >
              📋
            </button>
          </div>
        {/if}
      {:else if hasError}
        <div class="button-container">
          <Button 
            variant="primary"
            size="large"
            fullWidth
            on:click={() => window.location.reload()}
          >
            Try Again
          </Button>
        </div>
      {/if}
    {:else}
      <div class="button-container">
        <Button
          variant="primary"
          size="large"
          fullWidth
          on:click={() => dispatch('startConversion')}
        >
          Start Conversion
        </Button>
      </div>
    {/if}
  </div>
</Container>

<style>
  .conversion-status {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md);
    padding: var(--spacing-md) 0;
  }

  .status-message {
    text-align: center;
    position: relative;
  }

  .message {
    font-size: var(--font-size-lg);
    font-weight: var(--font-weight-medium);
    color: var(--color-text);
    margin: 0;
    margin-bottom: var(--spacing-sm);
  }

  .current-file {
    font-size: var(--font-size-base);
    color: var(--color-text-secondary);
    margin: 0;
    padding: var(--spacing-xs) var(--spacing-sm);
    border-radius: var(--rounded-md);
    position: relative;
    background: transparent;
  }

  .current-file::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    border-radius: var(--rounded-md);
    padding: 2px;
    background: linear-gradient(135deg, var(--color-prime), var(--color-second));
    -webkit-mask: 
        linear-gradient(#fff 0 0) content-box, 
        linear-gradient(#fff 0 0);
    -webkit-mask-composite: xor;
    mask-composite: exclude;
    pointer-events: none;
    opacity: 0.3;
  }

  .progress-section {
    width: 100%;
    max-width: 600px;
    margin: 0 auto;
    padding: var(--spacing-md);
    border-radius: var(--rounded-lg);
    position: relative;
    background: transparent;
  }

  .progress-section::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    border-radius: var(--rounded-lg);
    padding: 2px;
    background: linear-gradient(135deg, var(--color-prime), var(--color-second));
    -webkit-mask: 
        linear-gradient(#fff 0 0) content-box, 
        linear-gradient(#fff 0 0);
    -webkit-mask-composite: xor;
    mask-composite: exclude;
    pointer-events: none;
    opacity: 0.2;
  }

  .progress-container {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
    align-items: center;
    position: relative;
    z-index: 1;
  }

  .progress-text {
    font-size: var(--font-size-base);
    color: var(--color-text-secondary);
    font-weight: var(--font-weight-medium);
  }

  .button-container {
    width: 100%;
    display: flex;
    gap: var(--spacing-md);
    justify-content: center;
    padding: var(--spacing-sm) 0;
    position: relative;
    z-index: 1;
  }

  .path-display {
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
    padding: var(--spacing-sm);
    background-color: var(--color-bg-alt);
    border-radius: var(--rounded-md);
    margin-top: var(--spacing-sm);
  }

  .path-label {
    font-weight: var(--font-weight-medium);
    color: var(--color-text-secondary);
  }

  .path-value {
    flex-grow: 1;
    font-family: var(--font-mono);
    font-size: var(--font-size-sm);
    color: var(--color-text);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .copy-button {
    background: none;
    border: none;
    cursor: pointer;
    padding: 0;
    font-size: var(--font-size-base);
    opacity: 0.7;
    transition: opacity var(--transition-duration-fast) ease;
  }

  .copy-button:hover {
    opacity: 1;
  }

  /* High Contrast Mode */
  @media (prefers-contrast: high) {
    .current-file::before,
    .progress-section::before {
      padding: 3px;
      opacity: 1;
    }
  }

  /* Mobile Adjustments */
  @media (max-width: 640px) {
    .conversion-status {
      gap: var(--spacing-sm);
      padding: var(--spacing-sm) 0;
    }

    .message {
      font-size: var(--font-size-base);
    }

    .current-file {
      font-size: var(--font-size-sm);
    }

    .button-container {
      flex-direction: column;
    }
  }
</style>
