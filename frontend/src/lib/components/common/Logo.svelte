<script>
  export let size = 'large'; // small, medium, large
  export let showText = true;
  export let className = '';
</script>

<div class="logo {size} {className}">
  <div class="logo-icon">
    <img src="/logo.png" alt="mdCodex Logo" />
  </div>
  {#if showText}
    <div class="logo-text">
      <span class="logo-text-md">md</span><span class="logo-text-codex">Codex</span>
    </div>
  {/if}
</div>

<style>
  .logo {
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
  }
  
  .logo-icon {
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  .logo-icon img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }
  
  .logo-text {
    font-weight: 700;
    display: flex;
    align-items: center;
  }
  
  .logo-text-md {
    color: var(--color-prime);
  }
  
  .logo-text-codex {
    color: var(--color-text);
  }
  
  /* Sizes */
  .small .logo-icon {
    width: 20px;
    height: 20px;
  }
  
  .small .logo-text {
    font-size: var(--font-size-sm);
  }
  
  .medium .logo-icon {
    width: 28px;
    height: 28px;
  }
  
  .medium .logo-text {
    font-size: var(--font-size-lg);
  }
  
  .large .logo-icon {
    width: 36px;
    height: 36px;
  }
  
  .large .logo-text {
    font-size: var(--font-size-xl);
  }
  
  @media (max-width: 640px) {
    .medium .logo-icon {
      width: 24px;
      height: 24px;
    }
    
    .medium .logo-text {
      font-size: var(--font-size-base);
    }
    
    .large .logo-icon {
      width: 32px;
      height: 32px;
    }
    
    .large .logo-text {
      font-size: var(--font-size-lg);
    }
  }
</style>
