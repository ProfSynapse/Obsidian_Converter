<!-- src/lib/components/FileUploader.svelte -->
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
   * @type {Object.<string, string[]>}
   */
  const SUPPORTED_FILES = {
    documents: ['txt', 'rtf', 'pdf', 'docx', 'odt', 'epub'],
    data: ['csv', 'json', 'yaml', 'yml', 'xlsx', 'pptx'],
    web: ['html', 'htm', 'xml'],
    multimedia: ['mp3', 'wav', 'ogg', 'mp4', 'mov', 'avi', 'webm', 'youtube']
  };

  // Flatten supported extensions for validation
  const SUPPORTED_EXTENSIONS = Object.values(SUPPORTED_FILES).flat();

  // Reactive declarations
  $: showFileList = $files.length > 0;
  $: needsApiKey = $files.some(file => requiresApiKey(file));

  /**
   * Shows feedback message with auto-dismiss
   * @param {string} message - Message to display
   * @param {'info' | 'error' | 'success'} type - Message type
   * @returns {number} Timeout ID
   */
  function showFeedback(message, type = 'info') {
    uploadStore.setMessage(message, type);
    return setTimeout(() => uploadStore.clearMessage(), 5000);
  }

  /**
   * Validates a file against supported types
   * @param {File} file - File to validate
   * @returns {boolean} Whether file is valid
   */
  function validateFile(file) {
    console.log('Validating file:', file.name);
    const extension = file.name.split('.').pop().toLowerCase();
    return SUPPORTED_EXTENSIONS.includes(extension);
  }

  /**
   * Determines file category from extension
   * @param {string} extension - File extension
   * @returns {string} File category
   */
  function getFileType(extension) {
    for (const [category, extensions] of Object.entries(SUPPORTED_FILES)) {
      if (extensions.includes(extension)) return category;
    }
    return 'unknown';
  }

  /**
   * Handles adding new files to the store
   * @param {File[]} newFiles - Array of files to add
   */
  function handleFilesAdded(newFiles) {
    console.log('Adding files:', newFiles);
    
    newFiles.forEach(file => {
      // Validate file type
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
        type: getFileType(extension),
        status: 'Ready',
        progress: 0,
        selected: false,
        requiresApiKey: requiresKey
      };

      console.log('Created file object:', { ...newFile, requiresApiKey: requiresKey });

      const result = files.addFile(newFile);
      if (result.success) {
        showFeedback(`Added: ${file.name}`, 'success');
        dispatch('filesAdded', { files: [newFile] });
      } else {
        showFeedback(result.message, 'error');
      }
    });
  }

  /**
   * Extracts YouTube video ID from URL
   * @param {string} url - YouTube URL
   * @returns {string} Video ID or 'unknown'
   */
  function extractYouTubeVideoId(url) {
    const regex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([^\s&]+)/;
    const match = url.match(regex);
    return match ? match[1] : 'unknown';
  }

  /**
   * Handles URL submission (including YouTube)
   * @param {CustomEvent} event - Submit event
   */
  async function handleUrlSubmit(event) {
    const { url, type = 'url' } = event.detail;
    console.log('URL submitted:', { url, type });

    const newFile = {
      id: crypto.randomUUID(),
      url: url,
      name: type === 'youtube' ? extractYouTubeVideoId(url) : new URL(url).hostname,
      type: type,
      status: 'ready',
      progress: 0,
      selected: false,
      requiresApiKey: type === 'youtube'
    };

    const result = files.addFile(newFile);
    showFeedback(
      result.success ? `${type.toUpperCase()} added successfully` : result.message, 
      result.success ? 'success' : 'error'
    );
  }

  /**
   * Handles file upload from input or drop
   * @param {Event} event - Upload event
   */
  async function handleFileUpload(event) {
    const uploadedFiles = Array.from(event.target.files || []);
    console.log('Files uploaded:', uploadedFiles);

    // Check for API key requirement
    const needsKey = uploadedFiles.some(file => requiresApiKey(file));
    console.log('Upload requires API key:', needsKey);

    handleFilesAdded(uploadedFiles);

    // Handle API key requirement
    if (needsKey && !$apiKey) {
      console.log('API key required but not present');
      
      // Wait for DOM update before scrolling
      setTimeout(() => {
        const apiKeySection = document.querySelector('.api-key-input-section');
        if (apiKeySection) {
          apiKeySection.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'center' 
          });
          console.log('Scrolled to API key input section');
        } else {
          console.warn('API key section not found');
        }
      }, 300);
    }
  }
</script>

<div class="file-uploader" in:fade={{ duration: 200 }}>
  <!-- URL Input Section -->
  <Container 
    title="Add from URL" 
    subtitle="Convert web content or YouTube videos"
  >
    <div class="upload-section">
      <TabNavigation />
      <UrlInput 
        on:submitUrl={handleUrlSubmit}
        on:submitYoutube={(event) => handleUrlSubmit({
          detail: { url: event.detail.url, type: 'youtube' }
        })}
      />
    </div>
  </Container>

  <!-- File Upload Section -->
  <Container 
    title="Upload Files" 
    subtitle="Drag and drop files or click to select"
  >
    <DropZone 
      acceptedTypes={SUPPORTED_EXTENSIONS}
      on:filesDropped={(event) => handleFilesAdded(event.detail.files)}
      on:filesSelected={(event) => handleFilesAdded(event.detail.files)}
    />
    
    <!-- Error Display -->
    {#if $uploadStore.errorMessage}
      <div class="error-container" transition:fade>
        <ErrorMessage message={$uploadStore.errorMessage} />
      </div>
    {/if}

    <!-- File List -->
    {#if showFileList}
      <div class="file-list-wrapper">
        <FileList />
      </div>
    {/if}
  </Container>
</div>

<style>
  .file-uploader {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-lg);
    width: 100%;
    max-width: var(--content-width-md);
    margin: 0 auto;
    padding: 0 var(--spacing-md);
  }

  .upload-section {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md);
  }

  .error-container {
    margin-top: var(--spacing-md);
  }

  .file-list-wrapper {
    margin-top: var(--spacing-lg);
    padding-top: var(--spacing-md);
    border-top: 2px solid var(--color-border);
    background: var(--color-surface);
    border-radius: var(--rounded-lg);
  }

  /* Responsive Design */
  @media (max-width: 768px) {
    .file-uploader {
      gap: var(--spacing-md);
      padding: 0 var(--spacing-sm);
    }
  }

  @media (max-width: 640px) {
    .upload-section {
      gap: var(--spacing-sm);
    }
    .error-container {
      margin-top: var(--spacing-sm);
    }
  }

  /* High Contrast Mode */
  @media (prefers-contrast: high) {
    .file-uploader {
      gap: var(--spacing-xl);
    }
  }

  /* Reduced Motion */
  @media (prefers-reduced-motion: reduce) {
    .file-uploader {
      transition: none;
    }
  }
</style>