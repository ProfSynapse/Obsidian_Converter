<!-- src/lib/components/ApiKeyInput.svelte -->
<script>
  import { onDestroy } from 'svelte';
  import { slide } from 'svelte/transition';
  import { apiKey } from '$lib/stores/apiKey.js';

  let apiKeyValue = '';
  let showApiKey = false;

  // Subscribe to the apiKey store so we can stay in sync
  const unsubscribe = apiKey.subscribe(value => {
    apiKeyValue = value || '';
  });

  onDestroy(() => {
    unsubscribe();
  });

  // Update store directly as user types
  function handleInput(event) {
    apiKeyValue = event.target.value;
    apiKey.set(apiKeyValue);
  }

  function toggleShowApiKey() {
    showApiKey = !showApiKey;
  }
</script>

<div class="api-key-wrapper">
  <div
    class="api-key-input-section"
    transition:slide={{ duration: 300 }}
  >
    <div class="input-container">
      <!-- Use separate input elements for text and password -->
      {#if showApiKey}
        <input
          type="text"
          class="api-key-input"
          placeholder="Enter your OpenAI API Key"
          bind:value={apiKeyValue}
          on:input={handleInput}
        />
      {:else}
        <input
          type="password"
          class="api-key-input"
          placeholder="Enter your OpenAI API Key"
          bind:value={apiKeyValue}
          on:input={handleInput}
        />
      {/if}

      <!-- Show / Hide API Key -->
      <button
        type="button"
        class="toggle-button"
        on:click={toggleShowApiKey}
        aria-label={showApiKey ? 'Hide API Key' : 'Show API Key'}
      >
        {showApiKey ? '👁️' : '🙈'}
      </button>
    </div>

    <div class="api-key-indicator">
      Required for audio/video transcription. Won't persist on refresh.
    </div>
  </div>
</div>

<style>
  .api-key-wrapper {
    width: 100%;
    max-width: 1000px; /* Matches FileUploader container width */
    margin: 0 auto;
  }

  .api-key-input-section {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
  }

  .input-container {
    width: 100%;
    display: flex;
    align-items: center;
    background: var(--color-surface);
    border: 2px solid var(--color-border);
    border-radius: var(--rounded-lg);
    padding: var(--spacing-sm); /* Slightly increased padding */
  }

  .input-container:focus-within {
    border-color: var(--color-prime);
    box-shadow: var(--shadow-sm);
  }

  .api-key-input {
    flex: 1;
    border: none;
    background: transparent;
    padding: var(--spacing-sm);
    font-size: var(--font-size-base);
    color: var(--color-text);
  }

  .api-key-input:focus {
    outline: none;
  }

  .toggle-button {
    background: none;
    border: none;
    cursor: pointer;
    padding: var(--spacing-sm);
    font-size: var(--font-size-lg);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .api-key-indicator {
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
  }

  @media (prefers-reduced-motion: reduce) {
    .submit-button:hover:not(:disabled),
    .clear-button:hover {      transform: none;    }  }</style>
