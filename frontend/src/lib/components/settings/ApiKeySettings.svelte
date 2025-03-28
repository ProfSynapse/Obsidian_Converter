<!-- src/lib/components/settings/ApiKeySettings.svelte -->
<script>
  import { onMount } from 'svelte';
  import { writable } from 'svelte/store';
  import { slide } from 'svelte/transition';
  
  // Local state
  let apiKey = '';
  let saving = false;
  let validating = false;
  let error = '';
  let keyStatus = writable({ exists: false, valid: false });
  let showApiKey = false;
  
  // Check if API key exists on mount
  onMount(async () => {
    try {
      const result = await window.electronAPI.checkApiKeyExists('openai');
      keyStatus.set({ exists: result.exists, valid: true });
    } catch (err) {
      console.error('Error checking API key:', err);
    }
  });
  
  // Save API key
  async function saveApiKey() {
    if (!apiKey) return;
    
    saving = true;
    validating = true;
    error = '';
    
    try {
      // Validate key format
      if (!apiKey.startsWith('sk-')) {
        throw new Error('Invalid API key format. Key should start with "sk-"');
      }
      
      // Validate with API
      const validation = await window.electronAPI.validateApiKey(apiKey);
      validating = false;
      
      if (!validation.valid) {
        throw new Error(validation.error || 'API key validation failed');
      }
      
      // Save key
      const result = await window.electronAPI.saveApiKey(apiKey);
      if (!result.success) {
        throw new Error(result.error || 'Failed to save API key');
      }
      
      // Update status
      keyStatus.set({ exists: true, valid: true });
      apiKey = ''; // Clear input
    } catch (e) {
      error = e.message;
    } finally {
      saving = false;
      validating = false;
    }
  }
  
  // Delete API key
  async function deleteApiKey() {
    try {
      await window.electronAPI.deleteApiKey('openai');
      keyStatus.set({ exists: false, valid: false });
    } catch (e) {
      error = e.message;
    }
  }
  
  // Toggle API key visibility
  function toggleShowApiKey() {
    showApiKey = !showApiKey;
  }
</script>

<div class="api-key-settings">
  <h2>OpenAI API Key</h2>
  
  {#if $keyStatus.exists}
    <div class="key-status success">
      <span>✓ API key is configured and securely stored</span>
      <button on:click={deleteApiKey} class="delete-btn">Remove Key</button>
    </div>
    <p class="info">
      Your API key is stored securely on your device using machine-specific encryption.
      It is only used for transcription services and is never transmitted to our servers.
    </p>
  {:else}
    <div class="input-container">
      <!-- Use separate input elements for text and password -->
      {#if showApiKey}
        <input
          type="text"
          class="api-key-input"
          placeholder="Enter your OpenAI API Key (sk-...)"
          bind:value={apiKey}
          class:error={!!error}
        />
      {:else}
        <input
          type="password"
          class="api-key-input"
          placeholder="Enter your OpenAI API Key (sk-...)"
          bind:value={apiKey}
          class:error={!!error}
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
      
      <button
        on:click={saveApiKey}
        disabled={saving || !apiKey}
        class="save-btn"
      >
        {#if validating}
          Validating...
        {:else if saving}
          Saving...
        {:else}
          Save API Key
        {/if}
      </button>
    </div>
    
    {#if error}
      <p class="error-message" transition:slide={{ duration: 200 }}>{error}</p>
    {/if}
    
    <div class="info-box">
      <h3>How to get an OpenAI API key:</h3>
      <ol>
        <li>Go to <a href="https://platform.openai.com/account/api-keys" target="_blank" rel="noopener noreferrer">OpenAI API Keys</a></li>
        <li>Sign in or create an account</li>
        <li>Create a new secret key</li>
        <li>Copy and paste it here</li>
      </ol>
      <p class="note">Your API key is stored securely on your device and is only used for transcription services.</p>
    </div>
  {/if}
</div>

<style>
  .api-key-settings {
    padding: 1.5rem;
    border-radius: 8px;
    background: var(--color-surface);
    margin-bottom: 1.5rem;
    border: 1px solid var(--color-border);
  }
  
  h2 {
    margin-top: 0;
    margin-bottom: 1rem;
    color: var(--color-text);
  }
  
  .input-container {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 1rem;
    width: 100%;
  }
  
  .api-key-input {
    flex: 1;
    padding: 0.75rem;
    border: 1px solid var(--color-border);
    border-radius: 4px;
    font-size: 1rem;
    background: var(--color-background);
    color: var(--color-text);
  }
  
  .api-key-input.error {
    border-color: var(--color-error);
  }
  
  button {
    padding: 0.75rem 1rem;
    border: none;
    border-radius: 4px;
    font-weight: 500;
    cursor: pointer;
  }
  
  button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  
  .save-btn {
    background: var(--color-prime);
    color: white;
    min-width: 120px;
  }
  
  .delete-btn {
    background: var(--color-error);
    color: white;
    font-size: 0.875rem;
    padding: 0.5rem 0.75rem;
  }
  
  .toggle-button {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    padding: 0.75rem;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  .key-status {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem;
    border-radius: 4px;
    margin-bottom: 1rem;
  }
  
  .success {
    background: var(--color-success-bg);
    color: var(--color-success);
  }
  
  .error-message {
    color: var(--color-error);
    font-size: 0.875rem;
    margin-top: 0.5rem;
    margin-bottom: 1rem;
  }
  
  .info-box {
    background: var(--color-info-bg);
    border-radius: 4px;
    padding: 1rem;
    font-size: 0.875rem;
    margin-top: 1rem;
  }
  
  .info-box h3 {
    margin-top: 0;
    font-size: 1rem;
    color: var(--color-text);
  }
  
  .info-box ol {
    padding-left: 1.5rem;
    margin: 0.5rem 0;
  }
  
  .info-box li {
    margin-bottom: 0.5rem;
  }
  
  .info-box a {
    color: var(--color-prime);
    text-decoration: none;
  }
  
  .info-box a:hover {
    text-decoration: underline;
  }
  
  .note {
    font-style: italic;
    margin-top: 1rem;
    color: var(--color-text-secondary);
  }
  
  .info {
    font-size: 0.875rem;
    color: var(--color-text-secondary);
    margin-top: 0;
  }
  
  @media (prefers-reduced-motion: reduce) {
    .save-btn:hover:not(:disabled),
    .delete-btn:hover {
      transform: none;
    }
  }
</style>
