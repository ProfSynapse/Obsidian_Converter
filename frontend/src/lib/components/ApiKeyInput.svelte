<!-- src/lib/components/ApiKeyInput.svelte -->
<script>
  import { createEventDispatcher, onDestroy } from 'svelte';
  import { slide } from 'svelte/transition';
  import { apiKey } from '$lib/stores/apiKey.js';
  import Container from './common/Container.svelte';

  let apiKeyValue = '';
  let showApiKey = false;
  let errorMessage = '';

  const dispatch = createEventDispatcher();

  // Subscribe to the apiKey store so we can stay in sync
  const unsubscribe = apiKey.subscribe(value => {
    // If the store changes from somewhere else, reflect that
    apiKeyValue = value || '';
  });

  onDestroy(() => {
    // Clean up subscription when this component is destroyed
    unsubscribe();
  });

  /**
   * Basic validation example. Adjust to your own needs.
   * For instance, you may want to check length, prefix, etc.
   */
  function validateApiKey(key) {
    if (!key || typeof key !== 'string') {
      throw new Error('API key is required');
    }
    const trimmed = key.trim();
    if (trimmed.length < 8) {
      throw new Error('API key must be at least 8 characters long');
    }
    if (!trimmed.startsWith('sk-')) {
      throw new Error('API key must start with "sk-"');
    }
    return trimmed;
  }

  function handleInput(event) {
    apiKeyValue = event.target.value;
    errorMessage = '';
  }

  function handleSubmit() {
    try {
      const validated = validateApiKey(apiKeyValue);
      apiKey.set(validated);           // Store the validated key in memory
      errorMessage = '';
      dispatch('apiKeySet', { success: true });
      // Optionally clear the input field after setting:
      // apiKeyValue = '';
    } catch (err) {
      errorMessage = err.message;
      dispatch('apiKeySet', { success: false, error: err.message });
    }
  }

  function toggleShowApiKey() {
    showApiKey = !showApiKey;
  }

  function handleClear() {
    apiKey.set('');       // Clear the store
    apiKeyValue = '';     // Clear local input
    errorMessage = '';    // Reset error
    dispatch('apiKeySet', { success: false, error: 'API key cleared' });
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
          placeholder="Enter your API Key"
          bind:value={apiKeyValue}
          on:input={handleInput}
          on:keypress={(e) => e.key === 'Enter' && handleSubmit()}
          aria-describedby="api-key-error"
        />
      {:else}
        <input
          type="password"
          class="api-key-input"
          placeholder="Enter your API Key"
          bind:value={apiKeyValue}
          on:input={handleInput}
          on:keypress={(e) => e.key === 'Enter' && handleSubmit()}
          aria-describedby="api-key-error"
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

      <!-- Submit Button -->
      <button
        class="submit-button"
        on:click={handleSubmit}
        disabled={!apiKeyValue.trim()}
        title="Submit API Key"
      >
        <span class="icon">✔️</span>
      </button>

      <!-- Clear Button (only if there's something to clear) -->
      {#if apiKeyValue}
        <button
          class="clear-button"
          on:click={handleClear}
          title="Clear API Key"
        >
          ✖️
        </button>
      {/if}
    </div>

    <!-- Error Message -->
    {#if errorMessage}
      <div id="api-key-error" class="error-message" role="alert">
        {errorMessage}
      </div>
    {/if}

    <div class="api-key-indicator">
      This key won’t persist on refresh. You can remove it anytime.
    </div>
  </div>
</div>

<style>
  .api-key-wrapper {
    width: 100%;
    max-width: 800px; /* Increased from 600px */
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

  .toggle-button,
  .submit-button,
  .clear-button {
    background: none;
    border: none;
    cursor: pointer;
    padding: var(--spacing-sm);
    font-size: var(--font-size-lg);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .submit-button {
    background: var(--color-prime);
    color: var(--color-text-on-dark);
    border-radius: var(--rounded-md);
    width: 36px;
    height: 36px;
    margin-left: var(--spacing-xs);
  }
  .submit-button:hover:not(:disabled) {
    background: var(--color-second);
    transform: scale(1.05);
  }
  .submit-button:disabled {
    background: var(--color-disabled);
    cursor: not-allowed;
    transform: none;
  }

  .clear-button {
    margin-left: var(--spacing-xs);
    font-size: var(--font-size-md);
    color: var(--color-error);
  }
  .clear-button:hover {
    transform: scale(1.1);
  }

  .error-message {
    color: var(--color-error);
    font-size: var (--font-size-sm);
    margin-top: var(--spacing-xs);
    padding: var(--spacing-2xs) var(--spacing-sm);
    background: var(--color-error-light);
    border-radius: var(--rounded-md);
  }

  .api-key-indicator {
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
  }

  @media (prefers-reduced-motion: reduce) {
    .submit-button:hover:not(:disabled),
    .clear-button:hover {      transform: none;    }  }</style>