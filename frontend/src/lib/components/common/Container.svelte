<!-- src/lib/components/common/Container.svelte -->
<script>
  export let title = ''; // Optional title prop
  export let subtitle = ''; // Optional subtitle prop
  export let noPadding = false; // Option to remove padding
  let className = ''; // Additional classes
  export { className as class };
  export let maxWidth = '600px'; // Default max-width
</script>

<div class="container {className}" style="max-width: {maxWidth};">
  {#if title}
    <div class="container-header">
      <h2 class="title">{title}</h2>
      {#if subtitle}
        <p class="subtitle">{subtitle}</p>
      {/if}
    </div>
  {/if}
  <div class="content" class:no-padding={noPadding}>
    <slot />
  </div>
</div>

<style>
  .container {
    background: var(--color-surface);
    border-radius: var(--rounded-lg);
    box-shadow: var(--shadow-sm);
    overflow: hidden;
    transition: transform var(--transition-duration-normal) var(--transition-timing-ease),
                box-shadow var(--transition-duration-normal) var(--transition-timing-ease);
    width: 100%;
  }

  .container:hover {
    box-shadow: var(--shadow-md);
    transform: translateY(-2px);
  }

  .container-header {
    padding: var(--spacing-md) var(--spacing-lg);
    border-bottom: 1px solid var(--color-border);
  }

  .title {
    font-size: var(--font-size-lg);
    font-weight: var(--font-weight-semibold);
    color: var(--color-text);
    margin: 0;
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
  }

  .subtitle {
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
    margin: var(--spacing-xs) 0 0;
  }

  .content {
    padding: var(--spacing-lg);
  }

  .content.no-padding {
    padding: 0;
  }

  /* Responsive adjustments */
  @media (max-width: 640px) {
    .container-header {
      padding: var(--spacing-sm) var(--spacing-md);
    }

    .content {
      padding: var(--spacing-md);
    }

    .title {
      font-size: var(--font-size-base);
    }
  }

  /* High contrast mode */
  @media (prefers-contrast: high) {
    .container {
      border: 2px solid currentColor;
    }
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .container {
      transition: none;
    }

    .container:hover {
      transform: none;
    }
  }
</style>
