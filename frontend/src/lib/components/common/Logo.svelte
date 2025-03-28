<script>
  export let size = 'medium'; // tiny, small, medium, large, extra-large
  export let showText = true;
  export let className = '';
</script>

<div class="logo {size} {className}">
  <div class="logo-icon">
    <img src="/logo.png" alt="codex.md Logo" />
  </div>
  {#if showText}
    <div class="logo-text">
      <span class="logo-text-codex">codex</span><span class="logo-text-md">.md</span>
    </div>
  {/if}
</div>

<style>
  .logo {
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
    transition: transform 0.3s ease;
  }
  
  .logo:hover {
    transform: scale(1.05);
  }
  
  .logo-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1));
    transition: filter 0.3s ease;
  }
  
  .logo:hover .logo-icon {
    filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.15));
  }
  
  .logo-icon img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    max-width: 100%;
  }
  
  .logo-text {
    font-weight: 700;
    display: flex;
    align-items: center;
    position: relative;
    transition: transform 0.3s ease;
  }
  
  .logo:hover .logo-text {
    transform: translateY(-1px);
  }
  
  .logo-text-codex,
  .logo-text-md {
    background: linear-gradient(90deg, 
      var(--color-prime) 0%, 
      var(--color-prime) 100%, 
      var(--color-fourth) 100%
    );
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
    transition: background 0.3s ease;
  }
  
  .logo-text-md {
    background: linear-gradient(90deg, 
      var(--color-fourth) 0%, 
      var(--color-fourth) 100%
    );
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
  }
  
  /* Sizes */
  .tiny .logo-icon {
    width: 48px;
    height: 48px;
  }
  
  .tiny .logo-text {
    font-size: var(--font-size-base);
  }
  
  .small .logo-icon {
    width: 56px;
    height: 56px;
  }
  
  .small .logo-text {
    font-size: var(--font-size-lg);
  }
  
  .medium .logo-icon {
    width: 64px;
    height: 64px;
  }
  
  .medium .logo-text {
    font-size: var(--font-size-xl);
  }
  
  .large .logo-icon {
    width: 72px;
    height: 72px;
  }
  
  .large .logo-text {
    font-size: var(--font-size-2xl);
  }
  
  .extra-large .logo-icon {
    width: 84px;
    height: 84px;
  }
  
  .extra-large .logo-text {
    font-size: var(--font-size-3xl);
  }
  
  @media (max-width: 640px) {
    .medium .logo-icon {
      width: 52px;
      height: 52px;
    }
    
    .medium .logo-text {
      font-size: var(--font-size-lg);
    }
    
    .large .logo-icon {
      width: 60px;
      height: 60px;
    }
    
    .large .logo-text {
      font-size: var(--font-size-xl);
    }
    
    .extra-large .logo-icon {
      width: 72px;
      height: 72px;
    }
    
    .extra-large .logo-text {
      font-size: var(--font-size-2xl);
    }
  }
</style>
