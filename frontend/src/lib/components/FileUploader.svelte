<script>
  import { createEventDispatcher } from 'svelte';
  import { files } from '$lib/stores/files.js';
  import { uploadStore } from '$lib/stores/uploadStore.js';
  import { fade } from 'svelte/transition';
  import { apiKey } from '$lib/stores/apiKey.js';
  import { requiresApiKey } from '$lib/utils/fileUtils.js';
  import Container from './common/Container.svelte';
  import TabNavigation from './common/TabNavigation.svelte';
  import UrlInput from './common/UrlInput.svelte';
  import DropZone from './common/DropZone.svelte';
  import ErrorMessage from './common/ErrorMessage.svelte';
  import FileList from './file/FileList.svelte';

  const dispatch = createEventDispatcher();

  /**
   * Configuration object for supported file types
   * (Here we break out audio vs video explicitly)
   */
  const SUPPORTED_FILES = {
    documents: ['txt', 'pdf', 'docx', 'pptx'],
    data: ['csv', 'xlsx'],
    audio: ['mp3', 'wav', 'm4a'],
    video: ['mp4', 'webm', 'avi', 'youtube']
  };

  // Flatten
  const SUPPORTED_EXTENSIONS = Object.values(SUPPORTED_FILES).flat();

  // Reactive
  $: showFileList = $files.length > 0;
  $: needsApiKey = $files.some(file => requiresApiKey(file));

  function showFeedback(message, type = 'info') {
    uploadStore.setMessage(message, type);
    return setTimeout(() => uploadStore.clearMessage(), 5000);
  }

  function validateFile(file) {
    const extension = file.name.split('.').pop().toLowerCase();
    return SUPPORTED_EXTENSIONS.includes(extension);
  }

  function getFileCategory(extension) {
    // Ensure lowercase comparison
    extension = extension.toLowerCase();
    
    // Special handling for spreadsheet files
    if (['csv', 'xlsx', 'xls'].includes(extension)) {
      return 'data';
    }

    for (const [category, extensions] of Object.entries(SUPPORTED_FILES)) {
      if (extensions.includes(extension)) {
        return category;
      }
    }
    return 'unknown';
  }

  function handleFilesAdded(newFiles) {
    newFiles.forEach(file => {
      if (!validateFile(file)) {
        showFeedback(`Unsupported file type: ${file.name}`, 'error');
        return;
      }

      const extension = file.name.split('.').pop().toLowerCase();
      const requiresKey = requiresApiKey(file);

      const newFile = {
        id: crypto.randomUUID(),
        name: file.name,
        file: file,
        type: extension,  // Changed: Use the extension directly instead of category
        status: 'Ready',
        progress: 0,
        selected: false,
        requiresApiKey: requiresKey
      };

      const result = files.addFile(newFile);
      if (result.success) {
        showFeedback(`Added: ${file.name}`, 'success');
        dispatch('filesAdded', { files: [newFile] });
      } else {
        showFeedback(result.message, 'error');
      }
    });
  }

  async function handleUrlSubmit(event) {
    const { url, type = 'url' } = event.detail;
    // ...
  }

  async function handleFileUpload(event) {
    const uploadedFiles = Array.from(event.target.files || []);
    handleFilesAdded(uploadedFiles);

    // If API key needed but missing, scroll to input...
    const needsKey = uploadedFiles.some(file => requiresApiKey(file));
    if (needsKey && !$apiKey) {
      setTimeout(() => {
        const apiKeySection = document.querySelector('.api-key-input-section');
        apiKeySection?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 300);
    }
  }
</script>

<div class="file-uploader" in:fade={{ duration: 200 }}>
  <!-- Single Container for all upload options -->
  <Container title="Add Files" subtitle="Upload files or convert from URL">
    <!-- URL Input Section -->
    <div class="section url-section">
      <TabNavigation />
      <UrlInput 
        on:submitUrl={handleUrlSubmit}
        on:submitYoutube={(e) => handleUrlSubmit({ detail: { url: e.detail.url, type: 'youtube' } })}
      />
    </div>

    <div class="section-divider"></div>

    <!-- File Upload Section -->
    <div class="section upload-section">
      <DropZone 
        acceptedTypes={SUPPORTED_EXTENSIONS}
        on:filesDropped={(event) => handleFilesAdded(event.detail.files)}
        on:filesSelected={(event) => handleFilesAdded(event.detail.files)}
      />
    </div>
    
    {#if $uploadStore.errorMessage}
      <div class="error-container" transition:fade>
        <ErrorMessage message={$uploadStore.errorMessage} />
      </div>
    {/if}

    {#if showFileList}
      <div class="file-list-wrapper">
        <FileList />
      </div>
    {/if}
  </Container>
</div>

<style>
  .file-uploader {
    width: 100%;
    max-width: 800px;
    margin: 0 auto;
  }

  .section {
    width: 100%;
    padding: var(--spacing-md);
  }

  .url-section {
    background: var(--color-background);
    border-radius: var(--rounded-lg);
  }

  .section-divider {
    width: 100%;
    height: 1px;
    background: var(--color-border);
    margin: var(--spacing-lg) 0;
    opacity: 0.5;
  }

  .upload-section {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-lg);
  }

  .error-container {
    margin-top: var(--spacing-md);
  }

  .file-list-wrapper {
    margin-top: var(--spacing-lg);
  }

  /* Responsive adjustments */
  @media (max-width: 768px) {
    .section {
      padding: var(--spacing-sm);
    }

    .section-divider {
      margin: var(--spacing-md) 0;
    }
  }
</style>
