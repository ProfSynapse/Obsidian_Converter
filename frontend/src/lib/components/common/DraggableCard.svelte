<!-- src/lib/components/common/DraggableCard.svelte -->
<script>
    import { createEventDispatcher } from 'svelte';
    import { cubicInOut } from 'svelte/easing';
  
    const dispatch = createEventDispatcher();
  
    // Props
    export let draggable = true;
    export let dragging = false;
    export let dragOverState = null; // 'above' | 'below' | null
    export let animate = true;
  
    // Internal state
    let element;
    let dragStartY;
    let originalHeight;
    let originalTransform;
  
    /**
     * Handles the start of drag operation
     */
    function handleDragStart(event) {
      if (!draggable) return;
  
      dragStartY = event.clientY;
      originalHeight = element.offsetHeight;
      originalTransform = window.getComputedStyle(element).transform;
  
      // Set dragged element styles
      element.style.opacity = '0.7';
      element.style.zIndex = '1000';
  
      dispatch('dragstart', {
        event,
        element,
        height: originalHeight
      });
    }
  
    /**
     * Handles the drag over state
     */
    function handleDragOver(event) {
      event.preventDefault();
      if (!draggable) return;
  
      const rect = element.getBoundingClientRect();
      const middleY = rect.top + rect.height / 2;
      const newDragOverState = event.clientY < middleY ? 'above' : 'below';
  
      dispatch('dragover', {
        event,
        element,
        position: newDragOverState
      });
    }
  
    /**
     * Handles the end of drag operation
     */
    function handleDragEnd(event) {
      if (!draggable) return;
  
      // Reset styles
      element.style.opacity = '';
      element.style.transform = originalTransform;
      element.style.zIndex = '';
  
      dispatch('dragend', {
        event,
        element
      });
    }
  
    /**
     * Handles when element is dropped
     */
    function handleDrop(event) {
      event.preventDefault();
      if (!draggable) return;
  
      dispatch('drop', {
        event,
        element
      });
    }
  </script>
  
  <div
    bind:this={element}
    class="draggable-card"
    class:is-draggable={draggable}
    class:is-dragging={dragging}
    class:is-drag-over-above={dragOverState === 'above'}
    class:is-drag-over-below={dragOverState === 'below'}
    class:no-animations={!animate}
    draggable={draggable}
    on:dragstart={handleDragStart}
    on:dragover={handleDragOver}
    on:dragend={handleDragEnd}
    on:drop={handleDrop}
  >
    <slot />
  </div>
  
  <style>
    .draggable-card {
      position: relative;
      transition: transform 0.2s ease, opacity 0.2s ease;
    }
  
    .draggable-card.is-draggable {
      cursor: move;
    }
  
    .draggable-card.is-dragging {
      opacity: 0.7;
      transform: scale(1.02);
    }
  
    .draggable-card.is-drag-over-above::before,
    .draggable-card.is-drag-over-below::after {
      content: '';
      position: absolute;
      left: 0;
      right: 0;
      height: 2px;
      background: var(--color-prime);
      border-radius: var(--rounded-full);
      animation: glow 1.5s ease-in-out infinite;
    }
  
    .draggable-card.is-drag-over-above::before {
      top: -1px;
    }
  
    .draggable-card.is-drag-over-below::after {
      bottom: -1px;
    }
  
    .draggable-card.no-animations,
    .draggable-card.no-animations::before,
    .draggable-card.no-animations::after {
      transition: none;
      animation: none;
    }
  
    @keyframes glow {
      0%, 100% { box-shadow: 0 0 2px var(--color-prime); }
      50% { box-shadow: 0 0 8px var(--color-prime); }
    }
  
    /* Accessibility */
    @media (prefers-reduced-motion: reduce) {
      .draggable-card {
        transition: none;
      }
  
      .draggable-card.is-drag-over-above::before,
      .draggable-card.is-drag-over-below::after {
        animation: none;
      }
    }
  </style>