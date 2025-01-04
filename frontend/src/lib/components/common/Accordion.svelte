<script>
  import { slide } from 'svelte/transition';
  
  export let title = '';
  export let open = false;
  export let icon = '▶';
  export let expandedIcon = '▼';
  
  function toggle() {
    open = !open;
  }
</script>

<div class="accordion">
  <button 
    class="accordion-header" 
    on:click={toggle}
    aria-expanded={open}
  >
    <span class="icon" aria-hidden="true">
      {open ? expandedIcon : icon}
    </span>
    <span class="title">{title}</span>
  </button>
  
  {#if open}
    <div 
      class="accordion-content"
      transition:slide={{ duration: 200 }}
    >
      <slot></slot>
    </div>
  {/if}
</div>

<style>
  .accordion {
    width: 100%;
    border: 1px solid var(--color-border);
    border-radius: var(--rounded-lg);
    /* Removed margin-bottom: var(--spacing-sm); */
    background: var(--color-surface);
  }

  .accordion-header {
    width: 100%;
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    padding: var(--spacing-lg);
    background: none;
    border: none;
    cursor: pointer;
    font-size: var(--font-size-base);
    color: var(--color-text);
    text-align: left;
  }

  .accordion-header:hover {
    background: var(--color-hover);
  }

  .icon {
    font-size: 0.8em;
    transition: transform 0.2s ease;
  }

  .title {
    font-weight: 700;
    font-size: var(--font-size-xl);
    letter-spacing: -0.01em;
  }

  .accordion-content {
    padding: var(--spacing-lg) var(--spacing-xl);
    border-top: 1px solid var(--color-border);
    background: var(--color-surface-alt, #fafafa);
  }

  /* High Contrast Mode */
  @media (prefers-contrast: high) {
    .accordion {
      border-width: 2px;
    }
    
    .accordion-header {
      outline: 2px solid currentColor;
    }
  }

  /* Reduced Motion */
  @media (prefers-reduced-motion: reduce) {
    .icon {
      transition: none;
    }
  }
</style>
