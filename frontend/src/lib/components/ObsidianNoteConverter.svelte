<!-- src/lib/components/ObsidianNoteConverter.svelte -->

<script>
  import FileUploader from './FileUploader.svelte';
  import FileList from './file/FileList.svelte';
  import ConversionStatus from './ConversionStatus.svelte';
  import ApiKeyInput from './ApiKeyInput.svelte';
  import ResultDisplay from './ResultDisplay.svelte';
  import { files } from '$lib/stores/files.js';
  import { apiKey } from '$lib/stores/apiKey.js';
  import { conversionStatus } from '$lib/stores/conversionStatus.js';
  import { get, derived } from 'svelte/store';
  import { slide } from 'svelte/transition';
  import { requiresApiKey } from '$lib/utils/fileUtils.js';

  // Reactive variables to determine API key necessity and conversion capability
  $: needsApiKey = $files.some(file => requiresApiKey(file));
  $: canStartConversion = (!needsApiKey || !!$apiKey) && $files.length > 0 && $conversionStatus.status !== 'converting';
  $: isComplete = $conversionStatus.status === 'completed';
  $: hasError = $conversionStatus.status === 'error';
</script>

<main class="converter-app">
  <header class="app-header">
    <h1 class="app-title">
      <span class="icon">📝</span>
      Obsidian Note Converter
    </h1>
    <p class="app-description">
      Convert your documents to Obsidian-compatible Markdown notes
    </p>
  </header>

  <div class="converter-sections">
    <!-- File Uploader Section -->
    <section 
      class="section upload-section"
      class:is-active={!isComplete}
      transition:slide|local
    >
      <FileUploader />
    </section>

    <!-- File List and API Key Input Section -->
    {#if $files.length > 0}
      <section 
        class="section file-list-section"
        transition:slide|local
      >

        {#if needsApiKey && !$apiKey}
          <ApiKeyInput />
        {/if}
      </section>
    {/if}

    <!-- Conversion Status Section -->
    {#if $files.length > 0}
      <section 
        class="section status-section"
        transition:slide|local
      >
        <ConversionStatus 
          apiKeyRequired={needsApiKey}
          canStartConversion={canStartConversion}
        />
      </section>
    {/if}

    <!-- Results Section -->
    {#if isComplete}
      <section 
        class="section results-section"
        transition:slide|local
      >
        <ResultDisplay />
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

  .app-header {
    text-align: center;
    margin-bottom: var(--spacing-2xl);
  }

  .app-title {
    font-size: var(--font-size-3xl);
    color: var(--color-text-on-dark);
    margin: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-sm);
  }

  .app-description {
    color: var(--color-text-on-dark);
    font-size: var(--font-size-lg);
    margin: var(--spacing-sm) 0 0;
    opacity: 0.9;
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

  /* Responsive Design */
  @media (max-width: 768px) {
    .converter-app {
      padding: var(--spacing-lg) var(--spacing-md);
      gap: var(--spacing-xl);
    }

    .app-title {
      font-size: var(--font-size-2xl);
    }

    .app-description {
      font-size: var(--font-size-base);
    }

    .converter-sections {
      gap: var(--spacing-lg);
    }
  }

  @media (max-width: 640px) {
    .converter-app {
      padding: var(--spacing-md);
    }

    .app-header {
      margin-bottom: var(--spacing-xl);
    }
  }

  /* High Contrast Mode */
  @media (prefers-contrast: high) {
    .converter-app {
      background-color: var(--color-background-high-contrast);
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
