<!-- src/routes/+layout.svelte -->
<script>
  import { onMount, onDestroy } from 'svelte';
  import socketService from '$lib/services/socket.js';
  import Navigation from '$lib/components/common/Navigation.svelte';
  import OfflineStatusBar from '$lib/components/OfflineStatusBar.svelte';
  import '$lib/styles/global.css';
  
  // Initialize socket connection when app starts
  socketService.connect();

  onMount(() => {
    document.documentElement.style.scrollBehavior = 'smooth';
  });

  // Clean up socket connection when app unmounts
  onDestroy(() => {
    socketService.disconnect();
  });
</script>

<svelte:head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <meta name="theme-color" content="#00a99d">
  <link 
    rel="preload" 
    href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&display=swap"
    as="style"
    on:load={e => {
      e.target.onload = null;
      e.target.rel = 'stylesheet';
    }}
  >
</svelte:head>

<div class="app-shell">
  <!-- Navigation -->
  <Navigation />
  
  <!-- Offline Status Bar -->
  <OfflineStatusBar />
  
  <!-- Main Content -->
  <main class="main animate-fade-in">
    <div class="content-area">
      <slot />
    </div>
  </main>
</div>

<style>
  /* App Shell */
  .app-shell {
    display: flex;
    flex-direction: column;
    min-height: 100vh;
    width: 100%;
    background: var(--color-surface);
    padding: var(--spacing-sm);
    box-sizing: border-box;
    align-items: center;
    gap: var(--spacing-sm);
  }

  /* Main Content Area */
  .main {
    flex: 1;
    position: relative;
    display: flex;
    justify-content: center;
    align-items: flex-start;
    width: 100%;
  }

  .content-area {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md);
    width: 100%;
    max-width: var(--content-width-lg);
    margin: 0 auto;
  }

  /* Responsive Adjustments */
  @media (min-width: 1440px) {
    .app-shell {
      padding: var(--spacing-md);
      gap: var(--spacing-md);
    }

    .content-area {
      gap: var(--spacing-lg);
    }
  }

  @media (max-width: 768px) {
    .app-shell {
      padding: var(--spacing-xs);
      gap: var(--spacing-xs);
    }

    .content-area {
      gap: var(--spacing-sm);
    }
  }

  @media (max-width: 640px) {
    .app-shell {
      padding: var(--spacing-2xs);
      gap: var(--spacing-2xs);
    }

    .content-area {
      gap: var(--spacing-xs);
    }
  }
</style>
