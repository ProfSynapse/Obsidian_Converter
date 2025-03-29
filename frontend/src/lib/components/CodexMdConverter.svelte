<script>
  import { onMount } from 'svelte';
  import ChatBubble from './common/ChatBubble.svelte';
  import FileUploader from './FileUploader.svelte';
  import Button from './common/Button.svelte';
  import Container from './common/Container.svelte';
  import { files } from '$lib/stores/files.js';
  import { startConversion, triggerDownload } from '$lib/utils/conversionManager.js';
  import { conversionResult } from '$lib/stores/conversionResult.js';
  import { conversionStatus } from '$lib/stores/conversionStatus.js';
  import ResultDisplay from './ResultDisplay.svelte';

  let mode = 'upload';
  let visibleMessages = [];
  const allMessages = [
    {
      type: 'received',
      name: 'Professor Synapse',
      avatar: '🧙🏾‍♂️',
      text: 'Let me introduce you to <strong class="brand-name">codex<span class="brand-ext">.md</span></strong>, a powerful tool that transforms your digital content into Markdown format. It\'s perfect for building your personal knowledge base!'
    },
    {
      type: 'received',
      name: 'codex.md',
      avatar: '📖',
      text: `
        <p>Hi there! I can help you convert your content in several ways:</p>
        <ul class="feature-list">
          <li><strong>Drag and drop</strong> your files below or <strong>click</strong> to browse</li>
          <li><strong>Convert web content</strong> by adding a URL (single page or entire website)</li>
        </ul>
        <p>Check the <a href="/help" class="help-link">Help page</a> for detailed instructions.</p>
      `
    }
  ];

  // Function to smoothly scroll to top of page
  function scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // Subscribe to conversion status changes
  $: if ($conversionStatus.status === 'completed') {
    mode = 'converted';
    // Attempt auto-download
    setTimeout(() => {
      if ($conversionResult) {
        triggerDownload();
      }
    }, 500);
  }

  function handleStartConversion() {
    mode = 'converting';
    scrollToTop();
    conversionResult.clearResult();
    startConversion();
  }

  function handleConvertMore() {
    scrollToTop();
    window.location.reload();
  }

  // Animate messages appearance
  onMount(() => {
    let delay = 500;
    const animateMessages = async () => {
      for (const message of allMessages) {
        await new Promise(resolve => setTimeout(resolve, delay));
        visibleMessages = [...visibleMessages, message];
        delay = 800; // Subsequent messages appear faster
      }
    };
    animateMessages();
  });
</script>

<div class="app-container">
  <div class="converter-app">
    {#if mode === 'upload'}
      <div class="chat-container">
        {#each visibleMessages as message, index (index)}
          <ChatBubble
            avatar={message.avatar}
            name={message.name}
            message={message.text}
            delay={index * 300}
            avatarPosition={message.name === 'codex.md' ? 'right' : 'left'}
            showName={false}
          />
        {/each}
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
      <ResultDisplay on:startConversion={handleStartConversion} />
    {:else if mode === 'converted'}
      <ResultDisplay on:startConversion={handleStartConversion} />
      <Container class="resources-container">
        <!-- Resources section content remains unchanged -->
      </Container>
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
    background-color: var(--color-background);
  }

  .converter-app {
    width: 100%;
    max-width: 1000px;
    display: flex;
    flex-direction: column;
    gap: var(--spacing-2xs);
  }

  .chat-container {
    margin-bottom: var(--spacing-lg);
    max-width: 800px;
    margin-left: auto;
    margin-right: auto;
    padding: 0 var(--spacing-sm);
  }

  :global(.brand-name) {
    background: linear-gradient(90deg,
      var(--color-prime) 0%,
      var(--color-prime) 100%
    );
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
  }

  :global(.brand-ext) {
    background: linear-gradient(90deg,
      var(--color-fourth) 0%,
      var(--color-fourth) 100%
    );
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
  }


  :global(.help-link) {
    color: var(--color-prime);
    text-decoration: none;
    font-weight: var(--font-weight-medium);
    border-bottom: 1px solid var(--color-prime);
    transition: all 0.2s ease;
    padding: 0 2px;
  }

  :global(.help-link:hover) {
    color: var(--color-fourth);
    border-color: var(--color-fourth);
    background: rgba(var(--color-fourth-rgb), 0.05);
    border-radius: 3px;
  }

  .button-container {
    width: 100%;
    display: flex;
    justify-content: center;
    padding: var(--spacing-2xs) 0;
    margin-top: var(--spacing-md);
  }

  @media (max-width: 640px) {
    .app-container {
      padding: var(--spacing-2xs);
    }
  }
</style>
