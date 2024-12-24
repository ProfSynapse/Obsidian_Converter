<!-- src/lib/components/common/ErrorMessage.svelte -->
<script>
  import { fly } from 'svelte/transition';
  import { uploadStore } from '$lib/stores/uploadStore';
</script>

{#if $uploadStore.message}
  <div 
    class="message {$uploadStore.messageType}" 
    role="alert" 
    in:fly={{ y: 10, duration: 200 }}
  >
    <span class="icon">
      {#if $uploadStore.messageType === 'error'}
        ⚠️
      {:else if $uploadStore.messageType === 'success'}
        ✅
      {:else}
        ℹ️
      {/if}
    </span>
    <span>{$uploadStore.message}</span>
  </div>
{/if}

<style>
  .message {
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
    padding: var(--spacing-sm) var(--spacing-md);
    border-radius: var(--rounded-md);
    font-size: var(--font-size-sm);
  }

  .error {
    background: var(--color-error-light);
    color: var(--color-error);
  }

  .success {
    background: var(--color-success-light);
    color: var(--color-success);
  }

  .info {
    background: var(--color-info-light);
    color: var(--color-info);
  }
</style>