<!-- src/lib/components/ObsidianNoteConverter.svelte -->
<script>
  import FileUploader from './FileUploader.svelte';
  import ConversionStatus from './ConversionStatus.svelte';
  import ApiKeyInput from './ApiKeyInput.svelte';
  import ResultDisplay from './ResultDisplay.svelte';
  import { apiKey } from '$lib/stores/apiKey.js';
  import { conversionStatus } from '$lib/stores/conversionStatus.js';
  import { files } from '$lib/stores/files.js';
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

  // Debug logging for state changes
  $: {
    console.log('State Update:', {
      needsApiKey,
      hasApiKey: !!$apiKey,
      showApiKeyInput,
      canStartConversion,
      isComplete,
      hasError,
      filesCount: $files.length,
      conversionStatus: $conversionStatus.status
    });
  }

  /**
   * Handles starting the conversion process
   * Validates preconditions and manages conversion state
   */
  async function handleStartConversion() {
    console.log('handleStartConversion called');
    
    if (!canStartConversion) {
      console.log('Cannot start conversion:', {
        needsApiKey,
        hasApiKey: !!$apiKey,
        filesPresent: $files.length > 0,
        currentStatus: $conversionStatus.status
      });
      return;
    }
    
    try {
      console.log('Starting conversion process');
      conversionStatus.setStatus('converting');
      conversionStatus.setProgress(0);
      
      // Ensure conversion function is imported
      const convertedFile = await startConversion();
      
      if (convertedFile) {
        console.log('Conversion completed successfully');
        conversionStatus.setStatus('completed');
      }
    } catch (error) {
      console.error('Conversion error:', error);
      conversionStatus.setError(error.message);
      conversionStatus.setStatus('error');
    }
  }
</script>

<main class="converter-app">
  <div class="converter-sections">
    <!-- File Uploader Section -->
    <section 
      class="section upload-section" 
      class:is-active={!isComplete}
    >
      <FileUploader />
    </section>

    {#if $files.length > 0}
      <!-- API Key Input Section - Show when needed -->
      {#if needsApiKey}
        <section 
          class="section api-key-section" 
          transition:slide|local={{ duration: 300 }}
        >
          <ApiKeyInput />
        </section>
      {/if}

      <!-- Conversion Status Section -->
      <section 
        class="section status-section" 
        transition:slide|local
      >
        <ConversionStatus 
          on:startConversion={handleStartConversion}
        />
      </section>

      <!-- Results Section -->
      {#if isComplete}
        <section 
          class="section results-section" 
          transition:slide|local
        >
          <ResultDisplay />
        </section>
      {/if}
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
    gap: var(--spacing-xl);
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

  /* API Key Section Styles */
  .api-key-section {
    margin-bottom: var(--spacing-md);
    background: var(--color-surface);
    border-radius: var(--rounded-lg);
    padding: var(--spacing-md);
    border: 2px solid var(--color-border);
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