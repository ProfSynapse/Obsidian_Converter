<script>
  import FileUploader from './FileUploader.svelte';
  import Instructions from './Instructions.svelte';
  import ProfessorSynapseAd from './ProfessorSynapseAd.svelte';
  import PaymentInput from './common/PaymentInput.svelte';
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

let mode = 'upload'; // 'upload', 'payment', 'converting', or 'converted'

function handleStartConversion() {
  mode = 'payment';
  scrollToTop();
  // Clear any previous conversion result
  conversionResult.clearResult();
}

function handlePaymentComplete() {
  mode = 'converting';
  scrollToTop();
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
      <Instructions />
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
    {:else if mode === 'payment'}
      <PaymentInput 
        showPayment={true}
        on:payment={handlePaymentComplete}
        on:skip={handlePaymentComplete}
      />
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
