<!-- src/lib/components/ApiKeyInput.svelte -->
<script>
  import { createEventDispatcher } from 'svelte';
  import { slide } from 'svelte/transition';
  import { apiKey } from '$lib/stores/apiKey.js';

  let apiKeyValue = '';
  let showApiKey = false;
  let errorMessage = '';

  const dispatch = createEventDispatcher();

  function validateApiKey(key) {
    if (!key || typeof key !== 'string') {
      throw new Error('API key is required');
    }
    const trimmedKey = key.trim();
    if (trimmedKey.length < 8) {
      throw new Error('API key must be at least 8 characters long');
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(trimmedKey)) {
      throw new Error('API key contains invalid characters');
    }
    return trimmedKey;
  }

  function handleInput(event) {
    apiKeyValue = event.target.value;
    console.log('API Key Input Changed:', apiKeyValue);
    errorMessage = '';
  }

  function handleSubmit() {
    console.log('handleSubmit called with API Key:', apiKeyValue);
    try {
      const validatedKey = validateApiKey(apiKeyValue);
      if (!validatedKey.startsWith('sk-')) {
        throw new Error('API key must start with "sk-"');
      }
      apiKey.set(validatedKey);
      errorMessage = '';
      dispatch('apiKeySet', { success: true });
      apiKeyValue = ''; // Clear input after successful submission
    } catch (error) {
      console.error('API key validation error:', error);
      errorMessage = error.message;
      dispatch('apiKeySet', { success: false, error: error.message });
    }
  }

  function toggleShowApiKey() {
    showApiKey = !showApiKey;
    console.log('Toggled showApiKey:', showApiKey);
  }
</script>

<!-- 
  The visibility of ApiKeyInput is controlled by the parent component.
  Remove internal visibility logic to avoid conflicts.
-->

<div 
  class="api-key-input-section" 
  transition:slide={{ duration: 300 }}
  on:outroend={() => console.log('API key input section hidden')}
  on:introend={() => console.log('API key input section shown')}
>
  <div class="input-container">
    <input
      type="password"
      class="api-key-input"
      class:show-text={showApiKey}
      placeholder="Enter your API Key"
      bind:value={apiKeyValue}
      on:input={handleInput}
      on:keypress={(e) => e.key === 'Enter' && handleSubmit()}
      aria-describedby="api-key-error"
    />
    <button 
      type="button" 
      class="toggle-button"
      on:click={toggleShowApiKey}
      aria-label={showApiKey ? 'Hide API Key' : 'Show API Key'}
    >
      {showApiKey ? '👁️' : '🙈'}
    </button>
    <button
      class="submit-button"
      on:click={handleSubmit}
      disabled={!apiKeyValue.trim()}
      title="Submit API Key"
    >
      <span class="icon">✔️</span>
    </button>
  </div>

  {#if errorMessage}
    <div id="api-key-error" class="error-message" role="alert">
      {errorMessage}
    </div>
  {/if}

  <div class="api-key-indicator">
    Securely store your API key to access conversion services.
  </div>
</div>

<style>
  .api-key-input-section {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
    animation: slideDown 0.3s ease-out;
  }

  .input-container {
    display: flex;
    align-items: center;
    background: var(--color-surface);
    border: 2px solid var(--color-border);
    border-radius: var(--rounded-lg);
    padding: var(--spacing-xs);
    transition: all var(--transition-duration-normal);
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
    min-width: 0;
  }
  .api-key-input:focus {
    outline: none;
  }

  .api-key-input.show-text {
    -webkit-text-security: none;
  }

  .toggle-button {
    background: none;
    border: none;
    cursor: pointer;
    padding: var(--spacing-sm);
    font-size: var(--font-size-lg);
    margin-right: var(--spacing-sm);
  }

  .submit-button {
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--color-prime);
    color: var(--color-text-on-dark);
    border: none;
    border-radius: var(--rounded-md);
    width: 36px;
    height: 36px;
    cursor: pointer;
    transition: all var(--transition-duration-normal);
  }

  .submit-button:hover:not(:disabled) {
    transform: scale(1.05);
    background: var(--color-second);
  }

  .submit-button:disabled {
    background: var(--color-disabled);
    cursor: not-allowed;
  }

  .error-message {
    color: var(--color-error);
    font-size: var(--font-size-sm);
    margin-top: var (--spacing-xs);
    padding: var(--spacing-xs) var(--spacing-sm);
    background: var(--color-error-light);
    border-radius: var(--rounded-md);
  }

  .api-key-indicator {
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
    padding-left: var(--spacing-md);
  }

  @media (max-width: 640px) {
    .api-key-input {
      font-size: var(--font-size-sm);
    }
    .submit-button {
      width: 32px;
      height: 32px;
    }
  }

  @media (prefers-contrast: high) {
    .input-container {
      border: 2px solid currentColor;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .input-container,
    .submit-button {
      transition: none;
    }
    .submit-button:hover:not(:disabled) {
      transform: none;
    }
  }

  @media (prefers-color-scheme: dark) {
    .input-container {
      background: var(--color-background);
    }
    .api-key-input {
      color: var(--color-text-on-dark);
    }
  }

  @keyframes slideDown {
    from {
      opacity: 0;
      transform: translateY(-20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
</style>
