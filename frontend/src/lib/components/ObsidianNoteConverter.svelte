<!-- src/lib/components/ObsidianNoteConverter.svelte -->
<script>
  import FileUploader from './FileUploader.svelte';
  import ResultDisplay from './ResultDisplay.svelte';
  import ApiKeyInput from './ApiKeyInput.svelte';
  import Instructions from './Instructions.svelte';
  import { apiKey } from '$lib/stores/apiKey.js';
  import { conversionStatus } from '$lib/stores/conversionStatus.js';
  import { files } from '$lib/stores/files.js';
  import { startConversion } from '$lib/utils/conversionManager.js';
  import { slide } from 'svelte/transition';
  import { requiresApiKey } from '$lib/utils/fileUtils.js';

  // State management for API key visibility
  let lastNeedsApiKey = false; // Track previous state for debugging
  let needsApiKey = false; // Initialize needsApiKey

  // Reactive declarations for file state
  $: {
    const currentNeedsApiKey = $files.some(file => {
      const requires = requiresApiKey(file);
      console.log(`Checking API key requirement for ${file.name}:`, requires);
      return requires;
    });

    // Log state changes
    if (currentNeedsApiKey !== lastNeedsApiKey) {
      console.log('API key requirement changed:', {
        from: lastNeedsApiKey,
        to: currentNeedsApiKey,
        fileCount: $files.length
      });
      lastNeedsApiKey = currentNeedsApiKey;
    }
    
    needsApiKey = currentNeedsApiKey;
  }

  // Reactive declarations for conversion state
  $: showApiKeyInput = needsApiKey && !$apiKey;
  $: canStartConversion = (!needsApiKey || !!$apiKey) && $files.length > 0 && $conversionStatus.status !== 'converting';
  $: isComplete = $conversionStatus.status === 'completed';
  $: hasError = $conversionStatus.status === 'error';
  $: isConverting = $conversionStatus.status === 'converting';
  $: showUploader = !isConverting && !isComplete;

  // Debug logging for state changes
  $: {
    console.log('State Update:', {
      needsApiKey,
      hasApiKey: !!$apiKey,
      showApiKeyInput,
      canStartConversion,
      isComplete,
      hasError,
      isConverting,
      showUploader,
      filesCount: $files.length,
      conversionStatus: $conversionStatus.status
    });
  }

  /**
   * Handles starting the conversion process
   * Validates preconditions and manages conversion state
   */
  async function handleStartConversion() {
    console.log('ObsidianNoteConverter: handleStartConversion called', {
      filesCount: $files.length,
      conversionStatus: $conversionStatus.status,
      needsApiKey,
      hasApiKey: !!$apiKey
    });
    
    if (!canStartConversion) {
      console.log('ObsidianNoteConverter: Cannot start conversion - conditions not met', {
        needsApiKey,
        hasApiKey: !!$apiKey,
        filesPresent: $files.length > 0,
        currentStatus: $conversionStatus.status
      });
      return;
    }
    
    try {
      console.log('ObsidianNoteConverter: Starting conversion process');
      await startConversion();
      console.log('ObsidianNoteConverter: Conversion started successfully');
    } catch (error) {
      console.error('ObsidianNoteConverter: Conversion error:', error);
      conversionStatus.setError(error.message);
      conversionStatus.setStatus('error');
    }
  }
</script>

<main class="converter-app">
  <div class="converter-sections">
    <!-- Instructions Section -->
    <section class="section instructions-section">
      <Instructions />
    </section>

    <!-- Only show FileUploader when not converting and not complete -->
    {#if showUploader}
      <section 
        class="section upload-section" 
        class:is-active={!isComplete}
        transition:slide|local
      >
        <FileUploader />
      </section>
    {/if}

    {#if $files.length > 0}
      <section 
        class="section results-section" 
        transition:slide|local
      >
        <ResultDisplay 
          on:startConversion={handleStartConversion}
          on:convertMore={() => window.location.reload()}
        />
      </section>
    {/if}
  </div>
</main>

<style>
  .converter-app {
    max-width: var(--content-width-lg);
    margin: 0 auto;
    padding: var(--spacing-xl) var(--spacing-lg);
    display: flex;
    flex-direction: column;
    gap: var(--spacing-2xl);
  }

  .converter-sections {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md); /* Reduced from xl */
  }

  .section {
    opacity: 0.95;
    transition: all var(--transition-duration-normal) var(--transition-timing-ease);
  }

  .section:hover {
    opacity: 1;
  }

  .section.is-active {
    transform: scale(1.01);
  }

  .instructions-section {
    margin-bottom: var(--spacing-sm); /* Reduced from xl */
  }

  /* Responsive Design */
  @media (max-width: 768px) {
    .converter-app {
      padding: var(--spacing-lg) var(--spacing-md);
      gap: var(--spacing-xl);
    }

    .converter-sections {
      gap: var(--spacing-lg);
    }
  }

  @media (max-width: 640px) {
    .converter-app {
      padding: var(--spacing-md);
    }
  }

  /* High Contrast Mode */
  @media (prefers-contrast: high) {
    .converter-app {
      background-color: var(--color-background-high-contrast);
    }
    
    .section {
      border: 2px solid currentColor;
    }
  }

  /* Reduced Motion */
  @media (prefers-reduced-motion: reduce) {
    .section,
    .converter-app {
      transition: none;
      transform: none;
    }
  }
</style>