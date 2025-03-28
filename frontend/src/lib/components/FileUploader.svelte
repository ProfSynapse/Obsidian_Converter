<script>
  import { createEventDispatcher } from 'svelte';
  import { files } from '$lib/stores/files.js';
  import { uploadStore } from '$lib/stores/uploadStore.js';
  import { paymentStore } from '$lib/stores/payment.js';
  import { fade } from 'svelte/transition';
  import { apiKey } from '$lib/stores/apiKey.js';
  import { requiresApiKey, validateFileSize } from '$lib/utils/fileUtils.js';
  import electronClient from '$lib/api/electronClient.js';
  import Container from './common/Container.svelte';
  import TabNavigation from './common/TabNavigation.svelte';
  import UrlInput from './common/UrlInput.svelte';
  import DropZone from './common/DropZone.svelte';
  import ErrorMessage from './common/ErrorMessage.svelte';
  import FileList from './file/FileList.svelte';
  import PaymentInput from './common/PaymentInput.svelte';
  import ApiKeyInput from './ApiKeyInput.svelte';
  import NativeFileSelector from './file/NativeFileSelector.svelte';
  import FolderSelector from './file/FolderSelector.svelte';

  const dispatch = createEventDispatcher();

  const SUPPORTED_FILES = {
    documents: ['pdf', 'docx', 'pptx'],
    data: ['csv', 'xlsx'],
    audio: ['mp3', 'wav', 'm4a'],
    video: ['mp4', 'webm', 'avi']
  };

  const SUPPORTED_EXTENSIONS = Object.values(SUPPORTED_FILES).flat();

  // Check if we're running in Electron
  let isElectron = false;
  $: {
    isElectron = electronClient.isRunningInElectron();
  }

  $: showFileList = $files.length > 0;
  $: needsApiKey = $files.some(file => requiresApiKey(file));
  $: showPaymentPrompt = $paymentStore.showPaymentPrompt;

  function showFeedback(message, type = 'info') {
    if (type !== 'success') {
      uploadStore.setMessage(message, type);
      return setTimeout(() => uploadStore.clearMessage(), 5000);
    }
  }

  function handlePayment(event) {
    const { amount } = event.detail;
    paymentStore.setAmount(amount);
    paymentStore.setStatus('completed');
    paymentStore.hidePrompt();
    showFeedback(`✨ Thank you for your magical contribution of $${amount}!`, 'success');
    dispatch('startConversion');
  }

  function handlePaymentSkip() {
    paymentStore.setStatus('skipped');
    paymentStore.hidePrompt();
    dispatch('startConversion');
  }

  function validateFile(file) {
    // Handle file path (string) from Electron or File object from web
    const isFilePath = typeof file === 'string';
    const fileName = isFilePath ? file.split(/[/\\]/).pop() : file.name;
    const extension = fileName.split('.').pop().toLowerCase();
    
    if (!SUPPORTED_EXTENSIONS.includes(extension)) {
      return { valid: false, message: `Unsupported file type: ${fileName}` };
    }

    // Skip size validation for file paths (Electron will handle this)
    if (!isFilePath) {
      const sizeValidation = validateFileSize(file);
      if (!sizeValidation.valid) {
        return { valid: false, message: `${fileName}: ${sizeValidation.message}` };
      }
    }

    return { valid: true };
  }

  function getFileCategory(extension) {
    extension = extension.toLowerCase();
    
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

  function generateId() {
    try {
      return crypto.randomUUID();
    } catch (e) {
      return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
  }

  function handleFilesAdded(newFiles) {
    uploadStore.clearMessage();
    newFiles.forEach(file => {
      const validation = validateFile(file);
      if (!validation.valid) {
        showFeedback(validation.message, 'error');
        return;
      }

      // Handle file path (string) from Electron or File object from web
      const isFilePath = typeof file === 'string';
      const fileName = isFilePath ? file.split(/[/\\]/).pop() : file.name;
      const extension = fileName.split('.').pop().toLowerCase();
      const requiresKey = requiresApiKey(isFilePath ? { type: extension } : file);

      const newFile = {
        id: generateId(),
        name: fileName,
        file: file, // This will be either a File object or a file path string
        path: isFilePath ? file : null, // Store the full path if it's from Electron
        type: extension,
        status: 'Ready',
        progress: 0,
        selected: false,
        requiresApiKey: requiresKey,
        isNative: isFilePath // Flag to indicate if this is a native file path
      };

      const result = files.addFile(newFile);
      if (result.success) {
        dispatch('filesAdded', { files: [newFile] });
      } else {
        showFeedback(result.message, 'error');
      }
    });
  }

  /**
   * Handles files selected through the native file selector
   */
  function handleNativeFilesSelected(event) {
    const { paths } = event.detail;
    if (paths && paths.length > 0) {
      handleFilesAdded(paths);
    }
  }

  /**
   * Handles directory selected through the native file selector
   */
  function handleDirectorySelected(event) {
    const { path } = event.detail;
    if (path) {
      // For now, we just store the output directory
      // This will be used when saving conversion results
      localStorage.setItem('lastOutputDirectory', path);
      showFeedback(`Output directory set to: ${path}`, 'success');
    }
  }
  
  /**
   * Handles folder selected for input
   */
  function handleFolderSelected(event) {
    const { path, contents } = event.detail;
    if (path) {
      showFeedback(`Input folder selected: ${path}`, 'success');
      
      // If the folder has contents, we can process them
      if (contents && contents.length > 0) {
        // Filter for supported file types
        const supportedFiles = contents
          .filter(item => !item.isDirectory)
          .filter(item => SUPPORTED_EXTENSIONS.includes(item.type))
          .map(item => item.path);
        
        if (supportedFiles.length > 0) {
          handleFilesAdded(supportedFiles);
        } else {
          showFeedback('No supported files found in the selected folder', 'warning');
        }
      }
    }
  }
  
  /**
   * Handles file selected from folder browser
   */
  function handleFileSelectedFromFolder(event) {
    const { path } = event.detail;
    if (path) {
      handleFilesAdded([path]);
    }
  }

  function normalizeUrl(url) {
    try {
      const urlObj = new URL(url);
      const normalizedPath = urlObj.pathname.replace(/\/+$/, '').toLowerCase();
      urlObj.pathname = normalizedPath;
      return urlObj.href.toLowerCase();
    } catch (error) {
      console.error('URL normalization error:', error);
      return url.toLowerCase();
    }
  }

  async function handleUrlSubmit(event) {
    uploadStore.clearMessage();
    const { url, type = 'url' } = event.detail;
    
    if (!url) {
      showFeedback('Please enter a valid URL', 'error');
      return;
    }

    try {
      const normalizedUrl = normalizeUrl(url);
      const newUrl = new URL(normalizedUrl);
      
      const newFile = {
        id: generateId(),
        name: newUrl.hostname,
        url: normalizedUrl,
        type: type,
        status: 'Ready',
        progress: 0,
        selected: false,
        requiresApiKey: true
      };

      const result = files.addFile(newFile);
      if (result.success) {
        dispatch('filesAdded', { files: [newFile] });
      } else {
        showFeedback(result.message, 'error');
      }
    } catch (error) {
      showFeedback('Invalid URL format', 'error');
    }
  }

  async function handleFileUpload(event) {
    const uploadedFiles = Array.from(event.target.files || []);
    handleFilesAdded(uploadedFiles);

    const needsKey = uploadedFiles.some(file => requiresApiKey(file));
    if (needsKey && !$apiKey) {
      setTimeout(() => {
        const apiKeySection = document.querySelector('.api-key-input-section');
        apiKeySection?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 300);
    } else if (uploadedFiles.length > 0) {
      paymentStore.showPrompt();
    }
  }
</script>

<div class="file-uploader" in:fade={{ duration: 200 }}>
  <Container>
    <div class="uploader-content">
      <!-- URL Input Section -->
      <div class="section">
        <TabNavigation />
        <UrlInput 
          on:submitUrl={handleUrlSubmit}
        />
      </div>

      <div class="section-divider"></div>

      <!-- File Upload Section -->
      <div class="section">
        {#if isElectron}
          <div class="native-selectors">
            <div class="selector-row">
              <NativeFileSelector
                label="Select Files"
                acceptedTypes={SUPPORTED_EXTENSIONS}
                on:filesSelected={handleNativeFilesSelected}
                fullWidth={true}
              />
              <FolderSelector
                label="Select Folder"
                mode="input"
                showFileList={true}
                acceptedTypes={SUPPORTED_EXTENSIONS}
                on:folderSelected={handleFolderSelected}
                on:fileSelected={handleFileSelectedFromFolder}
                buttonVariant="secondary"
                fullWidth={true}
              />
            </div>
            <NativeFileSelector
              label="Select Output Directory"
              directoryMode={true}
              on:directorySelected={handleDirectorySelected}
              buttonVariant="secondary"
              fullWidth={true}
            />
          </div>
        {/if}
        
        <DropZone 
          acceptedTypes={SUPPORTED_EXTENSIONS}
          on:filesDropped={(event) => handleFilesAdded(event.detail.files)}
          on:filesSelected={(event) => handleFilesAdded(event.detail.files)}
        />
      </div>
      
      {#if $uploadStore.message}
        <div class="section">
          <ErrorMessage />
        </div>
      {/if}

      {#if showFileList}
        <div class="section">
          <FileList />
        </div>
      {/if}

      {#if needsApiKey}
        <div class="section">
          <ApiKeyInput />
        </div>
      {/if}

      <PaymentInput 
        showPayment={showPaymentPrompt}
        on:payment={handlePayment}
        on:skip={handlePaymentSkip}
      />
    </div>
  </Container>
</div>

<style>
  .file-uploader {
    width: 100%;
    max-width: 1000px;
    margin: 0 auto;
  }

  .uploader-content {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md);
  }

  .section {
    width: 100%;
  }

  .section-divider {
    width: 100%;
    height: 1px;
    background: linear-gradient(90deg, var(--color-prime), var(--color-second));
    opacity: 0.3;
  }

  .native-selectors {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md);
    margin-bottom: var(--spacing-md);
  }
  
  .selector-row {
    display: flex;
    gap: var(--spacing-md);
  }

  /* Mobile Adjustments */
  @media (max-width: 768px) {
    .uploader-content {
      gap: var(--spacing-sm);
    }
    
    .native-selectors {
      gap: var(--spacing-sm);
    }
    
    .selector-row {
      flex-direction: column;
      gap: var(--spacing-sm);
    }
  }

  @media (max-width: 640px) {
    .uploader-content {
      gap: var(--spacing-xs);
    }
    
    .native-selectors {
      gap: var(--spacing-xs);
    }
  }
</style>
