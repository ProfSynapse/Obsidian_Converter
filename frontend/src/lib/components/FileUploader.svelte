<!-- src/lib/components/FileUploader.svelte -->
<script>
  import { createEventDispatcher } from 'svelte';
  import { files } from '$lib/stores/files.js';
  import { uploadStore } from '$lib/stores/uploadStore.js';
  import { fade } from 'svelte/transition';
  
  // Import common components
  import Container from './common/Container.svelte';
  import TabNavigation from './common/TabNavigation.svelte';
  import UrlInput from './common/UrlInput.svelte';
  import DropZone from './common/DropZone.svelte';
  import ErrorMessage from './common/ErrorMessage.svelte';
  import FileList from './file/FileList.svelte';

  const dispatch = createEventDispatcher();

  // File type configuration
  const SUPPORTED_FILES = {
    documents: ['txt', 'rtf', 'pdf', 'docx', 'odt', 'epub'],
    data: ['csv', 'json', 'yaml', 'yml', 'xlsx', 'pptx'],
    web: ['html', 'htm', 'xml'],
    multimedia: ['mp3', 'wav', 'ogg', 'mp4', 'mov', 'avi', 'webm', 'youtube']
  };

  const SUPPORTED_EXTENSIONS = Object.values(SUPPORTED_FILES).flat();

  // Reactive variable to track file list visibility
  $: showFileList = $files.length > 0;

  /**
   * Shows feedback messages to the user with auto-dismiss
   * @param {string} message - The message to display
   * @param {string} type - Type of message ('success' or 'error')
   */
   function showFeedback(message, type = 'info') {
    uploadStore.setMessage(message, type);
    const timeout = setTimeout(() => uploadStore.clearMessage(), 5000);
    return () => clearTimeout(timeout);
  }

  /**
   * Validates file before adding
   * @param {File} file - The file to validate
   * @returns {boolean} - Whether the file is valid
   */
  function validateFile(file) {
    const extension = file.name.split('.').pop().toLowerCase();
    return SUPPORTED_EXTENSIONS.includes(extension);
  }

  /**
   * Determines the file type category based on extension
   * @param {string} extension - The file extension
   * @returns {string} The file type category
   */
  function getFileType(extension) {
    for (const [category, extensions] of Object.entries(SUPPORTED_FILES)) {
      if (extensions.includes(extension)) {
        return category;
      }
    }
    return 'others';
  }

  /**
   * Adds files to the store after validation
   * @param {File[]} newFiles - Array of File objects to add
   */
  function handleFilesAdded(newFiles) {
    const addedFiles = [];

    newFiles.forEach(file => {
      if (validateFile(file)) {
        const extension = file.name.split('.').pop().toLowerCase();
        const newFile = {
          id: crypto.randomUUID(),
          name: file.name,
          file: file,
          type: getFileType(extension),
          status: 'Ready',
          progress: 0,
          selected: false
        };
        
        try {
          const result = files.addFile(newFile);
          if (result.success) {
            addedFiles.push(newFile);
            showFeedback(`Added: ${file.name}`, 'success');
          } else {
            showFeedback(result.message, 'error');
          }
        } catch (error) {
          console.error('Error adding file:', error);
          showFeedback(`Failed to add ${file.name}: ${error.message}`, 'error');
        }
      } else {
        showFeedback(`Unsupported file type: ${file.name}`, 'error');
      }
    });

    if (addedFiles.length > 0) {
      dispatch('filesAdded', { files: addedFiles });
    }
  }

  /**
   * Extracts YouTube Video ID from URL
   * @param {string} url - The YouTube URL
   * @returns {string} The video ID or 'unknown'
   */
  function extractYouTubeVideoId(url) {
    const regex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([^\s&]+)/;
    const match = url.match(regex);
    return match ? match[1] : 'unknown';
  }

  /**
 * Handles URL submission from UrlInput component
 * @param {CustomEvent} event - Event containing URL data
 */
async function handleUrlSubmit(event) {
    try {
        let { url, type = 'url' } = event.detail;

        // Create a unique ID for the file
        const id = crypto.randomUUID();

        const newFile = {
            id,
            url: url,
            name: type === 'youtube' ? extractYouTubeVideoId(url) : new URL(url).hostname,
            type: type,
            status: 'ready',
            progress: 0,
            selected: false
        };

        const result = files.addFile(newFile);
        
        if (result.success) {
            showFeedback(`${type.toUpperCase()} added successfully`, 'success');
        } else {
            showFeedback(result.message, 'error');
        }

    } catch (error) {
        console.error('Error adding URL:', error);
        showFeedback(error.message, 'error');
    }
}

  /**
   * Handles file removal event from FileList
   * @param {CustomEvent} event - The removal event
   */
  function handleFileRemove(event) {
    const { detail } = event;
    const id = detail?.id;

    if (!id) {
      console.error('No file ID provided for removal');
      return;
    }

    try {
      const result = files.removeFile(id);
      if (result.success) {
        showFeedback('File removed successfully', 'success');
        dispatch('fileRemoved', { id });
      } else {
        showFeedback(result.message || 'Failed to remove file', 'error');
      }
    } catch (error) {
      console.error('Error removing file:', error);
      showFeedback('Failed to remove file', 'error');
    }
  }
</script>

<div class="file-uploader" in:fade={{ duration: 200 }}>
  <!-- URL Input Section -->
  <Container 
    title="Add from URL" 
    subtitle="Convert web content or YouTube videos">
    <div class="upload-section">
      <TabNavigation />
      <UrlInput 
          on:submitUrl={handleUrlSubmit}
          on:submitYoutube={(event) => handleUrlSubmit({
              detail: { 
                  url: event.detail.url, 
                  type: 'youtube' 
              }
          })}
      />
    </div>
  </Container>

  <!-- File Upload Section -->
  <Container 
    title="Upload Files" 
    subtitle="Drag and drop files or click to select">
    <DropZone
      acceptedTypes={SUPPORTED_EXTENSIONS}
      on:filesDropped={(event) => handleFilesAdded(event.detail.files)}
      on:filesSelected={(event) => handleFilesAdded(event.detail.files)}
    />

    {#if $uploadStore.errorMessage}
      <div class="error-container" transition:fade>
        <ErrorMessage message={$uploadStore.errorMessage} />
      </div>
    {/if}
  </Container>

  <!-- File List Section -->
  {#if showFileList}
    <Container 
      title="Items to Convert"
      subtitle="Files ready for processing">
      <FileList
        files={$files} 
        on:remove={handleFileRemove}
      />
    </Container>
  {/if}
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