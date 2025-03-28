<script>
  import FileUploader from './FileUploader.svelte';
  import ProfessorSynapseAd from './ProfessorSynapseAd.svelte';
  import Button from './common/Button.svelte';
import { files } from '$lib/stores/files.js';
import { startConversion, triggerDownload } from '$lib/utils/conversionManager.js';
import { conversionResult } from '$lib/stores/conversionResult.js';
import { showAd } from '$lib/stores/adStore.js';
import { conversionStatus } from '$lib/stores/conversionStatus.js';
import ResultDisplay from './ResultDisplay.svelte';

// Function to smoothly scroll to top of page
function scrollToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

let mode = 'upload'; // 'upload', 'converting', or 'converted'

function handleStartConversion() {
  mode = 'converting';
  scrollToTop();
  // Clear any previous conversion result
  conversionResult.clearResult();
  showAd();
  startConversion().then(() => {
    if ($conversionStatus.status === 'completed') {
      // Attempt auto-download
      setTimeout(() => {
        if ($conversionResult) {
          triggerDownload();
        }
      }, 500); // Small delay to ensure UI is ready
      mode = 'converted';
    }
  });
}
</script>

<div class="app-container">
  <div class="converter-app">
    {#if mode === 'upload'}
      <div class="welcome-message">
        <h1>Convert to Markdown for Obsidian</h1>
        <p>Upload files or enter a URL to convert your content to Markdown format optimized for Obsidian.</p>
        <p class="help-link">Need help? Check out our <a href="/help">detailed instructions</a>.</p>
      </div>
      <FileUploader />
      {#if $files.length > 0}
        <div class="button-container">
          <Button
            variant="primary"
            size="large"
            fullWidth
            on:click={handleStartConversion}
          >
            Start Conversion
          </Button>
        </div>
      {/if}
    {:else if mode === 'converting'}
      <ResultDisplay />
    {:else if mode === 'converted'}
      <ProfessorSynapseAd />
      <div class="button-container">
        <Button 
          variant="primary"
          size="large"
          fullWidth
          on:click={() => {
            scrollToTop();
            window.location.reload();
          }}
        >
          Convert More Files
        </Button>
      </div>
    {/if}
  </div>
</div>

<style>
  .app-container {
    width: 100%;
    min-height: 100vh;
    display: flex;
    justify-content: center;
    padding: var(--spacing-sm);
  }
  
  .welcome-message {
    text-align: center;
    margin-bottom: var(--spacing-md);
    padding: var(--spacing-md);
    background: rgba(var(--color-prime-rgb), 0.05);
    border-radius: var(--rounded-md);
  }
  
  .welcome-message h1 {
    font-size: var(--font-size-xl);
    font-weight: 700;
    margin-bottom: var(--spacing-sm);
    color: var(--color-text);
  }
  
  .welcome-message p {
    font-size: var(--font-size-base);
    line-height: 1.6;
    color: var(--color-text);
    margin-bottom: var(--spacing-xs);
  }
  
  .welcome-message .help-link {
    font-size: var(--font-size-sm);
    margin-top: var(--spacing-sm);
  }
  
  .welcome-message a {
    color: var(--color-prime);
    text-decoration: none;
    border-bottom: 1px solid var(--color-prime);
    transition: all 0.2s ease;
  }
  
  .welcome-message a:hover {
    color: var(--color-second);
    border-color: var(--color-second);
  }

  .converter-app {
    width: 100%;
    max-width: 1000px;
    display: flex;
    flex-direction: column;
    gap: var(--spacing-2xs);
  }

  .button-container {
    width: 100%;
    display: flex;
    justify-content: center;
    padding: var(--spacing-2xs) 0;
  }

  @media (max-width: 768px) {
    .app-container {
      padding: var(--spacing-xs);
    }

    .converter-app {
      gap: var(--spacing-2xs);
    }

    .button-container {
      padding: var(--spacing-2xs) 0;
    }
  }

  @media (max-width: 640px) {
    .app-container {
      padding: var(--spacing-2xs);
    }
  }
</style>
