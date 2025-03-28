<!-- src/routes/settings/+page.svelte -->
<script>
  import ApiKeySettings from '$lib/components/settings/ApiKeySettings.svelte';
</script>

<div class="settings-container">
  <h1>Settings</h1>
  
  <section class="settings-section">
    <h2>API Keys</h2>
    <p class="section-description">
      Configure API keys for external services used by mdCode.
    </p>
    
    <ApiKeySettings />
  </section>
  
  <section class="settings-section">
    <h2>Application Settings</h2>
    <p class="section-description">
      Configure general application settings and preferences.
    </p>
    
    <!-- Additional settings will be added here in future phases -->
    <div class="coming-soon">
      <p>Additional settings coming soon</p>
    </div>
  </section>
</div>

<style>
  .settings-container {
    max-width: 800px;
    margin: 0 auto;
    padding: 2rem;
  }
  
  h1 {
    font-size: 2rem;
    margin-bottom: 2rem;
    color: var(--color-text);
  }
  
  .settings-section {
    margin-bottom: 3rem;
    background: var(--color-surface);
    border-radius: 8px;
    padding: 1.5rem;
    border: 1px solid var(--color-border);
  }
  
  h2 {
    font-size: 1.5rem;
    margin-top: 0;
    margin-bottom: 0.5rem;
    color: var(--color-text);
  }
  
  .section-description {
    color: var(--color-text-secondary);
    margin-bottom: 1.5rem;
  }
  
  .coming-soon {
    padding: 1.5rem;
    background: var(--color-background);
    border-radius: 4px;
    text-align: center;
    color: var(--color-text-secondary);
    font-style: italic;
  }
</style>
