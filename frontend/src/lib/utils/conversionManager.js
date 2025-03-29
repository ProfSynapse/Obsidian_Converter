/**
 * Conversion Manager
 * 
 * Manages the file conversion process, supporting both web and Electron environments.
 * In web mode, it uses HTTP requests and browser APIs.
 * In Electron mode, it uses IPC communication and native file system.
 * 
 * Related files:
 * - frontend/src/lib/api/client.js: HTTP API client
 * - frontend/src/lib/api/electron: Electron IPC client modules
 * - frontend/src/lib/stores/conversionResult.js: Stores conversion results
 * - frontend/src/lib/components/ResultDisplay.svelte: Displays conversion results
 */

import { get } from 'svelte/store';
import { files } from '$lib/stores/files.js';
import { apiKey } from '$lib/stores/apiKey.js';
import { conversionStatus } from '$lib/stores/conversionStatus.js';
import client from '$lib/api/client.js';
import electronClient, { fileSystemOperations } from '$lib/api/electron';
import FileSaver from 'file-saver';
import { CONFIG } from '$lib/config'; 
import { conversionResult } from '$lib/stores/conversionResult.js';
import { validateAndNormalizeItem } from '$lib/api/electron';

// Check if we're running in Electron
const isElectron = typeof window !== 'undefined' && 
  window.electronAPI !== undefined;

/**
 * Utility function to read a file as base64
 */
function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = error => reject(error);
  });
}

/**
 * Saves a File object to a temporary file in Electron
 * @param {File} file - The File object to save
 * @returns {Promise<string>} - Path to the temporary file
 */
async function saveTempFile(file) {
  if (!isElectron || !window.electronAPI) {
    throw new Error('Cannot save temporary file: Not running in Electron environment');
  }
  
  // Create a unique filename based on the original filename
  const fileExt = file.name.split('.').pop().toLowerCase();
  const tempFileName = `temp_${Date.now()}_${file.name}`;
  
  // Use a default temp directory
  const tempDir = 'temp';
  
  // Create the temp directory if it doesn't exist
  await fileSystemOperations.createDirectory(tempDir);
  
  // Full path to the temporary file
  const tempFilePath = `${tempDir}/${tempFileName}`;
  
  // Read the file as base64 - this is more efficient for binary data over IPC
  const base64Data = await readFileAsBase64(file);
  
  // Write the file to disk using base64 encoding
  const writeResult = await fileSystemOperations.writeFile(tempFilePath, base64Data);
  
  if (!writeResult.success) {
    throw new Error(`Failed to write temporary file: ${writeResult.error}`);
  }
  
  console.log(`Temporary file saved to: ${tempFilePath}`);
  return tempFilePath;
}

/**
 * Cleans up a temporary file
 * @param {string} filePath - Path to the temporary file
 */
async function cleanupTempFile(filePath) {
  if (!isElectron || !window.electronAPI) {
    return;
  }
  
  try {
    await fileSystemOperations.deleteItem(filePath, false);
    console.log(`Temporary file deleted: ${filePath}`);
  } catch (error) {
    console.warn(`Failed to delete temporary file: ${filePath}`, error);
  }
}

/**
 * Prepares batch items for conversion
 */
function prepareBatchItems(items) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('No items provided for conversion');
  }
  
  return Promise.all(items.map(async item => {
    const prepared = isElectron ? validateAndNormalizeItem(item) : item;
    // Add metadata about whether this item should be batched
    prepared.shouldBatch = prepared.type !== 'document';
    return prepared;
  }));
}

/**
 * Starts the conversion process
 */
export async function startConversion() {
  const currentFiles = get(files);
  const currentApiKey = get(apiKey);

  if (currentFiles.length === 0) {
    const error = new Error('No files available for conversion.');
    conversionStatus.setError(error.message);
    conversionStatus.setStatus('error');
    console.error(error);
    return;
  }

  conversionStatus.setStatus('initializing');
  conversionStatus.setProgress(0);

  try {
    // Prepare items for conversion
    const items = await prepareBatchItems(currentFiles);
    const itemCount = items.length;

    // Handle conversion based on environment
    if (isElectron) {
      // First prompt for output directory
      conversionStatus.setStatus('selecting_output');
      const outputResult = await electronClient.selectOutputDirectory();
      
      if (!outputResult.success) {
        // User cancelled directory selection
        conversionStatus.setStatus('cancelled');
        showFeedback('Conversion cancelled: No output directory selected', 'info');
        return;
      }
      
      // Proceed with conversion using the selected directory
      await handleElectronConversion(items, currentApiKey, outputResult.path);
    } else {
      await handleWebConversion(items, currentApiKey);
    }

    // Update status
    conversionStatus.setStatus('processing');
    showFeedback('✨ Processing started! You will be notified when the conversion is complete.', 'success');

  } catch (error) {
    console.error('Conversion error:', error);

    conversionStatus.setError(error.message || 'An unexpected error occurred during conversion');
    conversionStatus.setStatus('error');
    showFeedback(error.message || 'An unexpected error occurred during conversion', 'error');
  }
}

/**
 * Handles conversion in Electron environment
 * @private
 * @param {Array} items - Items to convert
 * @param {string} apiKey - API key for services that require it
 * @param {string} outputDir - Directory to save conversion results
 */
async function handleElectronConversion(items, apiKey, outputDir) {
  // Update status
  conversionStatus.setStatus('converting');
  conversionStatus.setProgress(0);
  
  try {
    // Create options object with outputDir and createSubdirectory: false
    const options = {
      outputDir,
      createSubdirectory: false, // Save directly to the selected directory without creating subdirectories
      // Add API key if available
      ...(apiKey ? { apiKey } : {})
    };
    
    console.log('Conversion options:', {
      outputDir,
      createSubdirectory: false,
      hasApiKey: !!apiKey
    });
    
    // For single file conversion
    if (items.length === 1) {
      const item = items[0];
      
      // Set current file in status
      conversionStatus.setCurrentFile(item.name);
      
      // Handle different item types
      let result;
      if (item.isNative && item.path) {
        // Convert native file path with output directory
        result = await electronClient.convertFile(item.path, {
          ...item.options,
          ...options
        }, (progress) => {
          conversionStatus.setProgress(progress);
        });
      } else if (item.type === 'url') {
        // Convert URL with output directory
        result = await electronClient.convertUrl(item.url, {
          ...item.options,
          ...options
        }, (progress) => {
          conversionStatus.setProgress(progress);
        });
      } else if (item.type === 'parent') {
        // Convert parent URL (website) with output directory
        result = await electronClient.convertParentUrl(item.url, {
          ...item.options,
          ...options
        }, (progress) => {
          conversionStatus.setProgress(progress);
        });
      } else if (item.type === 'youtube') {
        // Convert YouTube URL with output directory
        result = await electronClient.convertYoutube(item.url, {
          ...item.options,
          ...options
        }, (progress) => {
          conversionStatus.setProgress(progress);
        });
      } else if (item.file instanceof File) {
        // Convert File object by saving to a temporary file first
        conversionStatus.setStatus('preparing');
        conversionStatus.setProgress(10);
        
        // Save the file to a temporary location
        const tempFilePath = await saveTempFile(item.file);
        
        try {
          // Convert the temporary file
          result = await electronClient.convertFile(tempFilePath, {
            ...item.options,
            ...options,
            isTemporary: true // Flag to indicate this is a temporary file
          }, (progress) => {
            // Scale progress from 20-90% to account for temp file operations
            conversionStatus.setProgress(20 + (progress * 0.7));
          });
          
          conversionStatus.setProgress(90);
        } finally {
          // Clean up the temporary file regardless of success/failure
          await cleanupTempFile(tempFilePath);
          conversionStatus.setProgress(95);
        }
      }
      
      // Update status and store result
      if (result && result.outputPath) {
        conversionStatus.setStatus('completed');
        conversionStatus.setProgress(100);
        
        // Store the result
        conversionResult.setNativeResult(result.outputPath, [item]);
        
        // Update file status
        files.updateFile(item.id, {
          status: 'completed',
          outputPath: result.outputPath
        });
      } else {
        throw new Error('Conversion failed: No output path returned');
      }
    } 
    // For batch conversion
    else {
      // Convert batch of files with output directory
      const result = await electronClient.convertBatch(
        items.map(item => item.isNative ? item.path : item.file),
        { 
          batchName: `Batch_${new Date().toISOString().replace(/:/g, '-')}`,
          ...options
        },
        (progress) => {
          conversionStatus.setProgress(progress);
        },
        (itemId, success, error) => {
          files.updateFile(itemId, {
            status: success ? 'completed' : 'error',
            error: error?.message || null
          });
        }
      );
      
      // Update status and store result
      if (result && result.outputPath) {
        conversionStatus.setStatus('completed');
        conversionStatus.setProgress(100);
        
        // Store the result
        conversionResult.setNativeResult(result.outputPath, items);
        
        // Update all file statuses
        items.forEach(item => {
          files.updateFile(item.id, {
            status: 'completed'
          });
        });
      } else {
        throw new Error('Batch conversion failed: No output path returned');
      }
    }
  } catch (error) {
    console.error('Electron conversion error:', error);
    conversionStatus.setError(error.message);
    conversionStatus.setStatus('error');
    throw error;
  }
}

/**
 * Handles conversion in web environment by using Electron's IPC
 * @private
 */
async function handleWebConversion(items, apiKey) {
  try {
    // Use electronClient's file selection
    conversionStatus.setStatus('selecting_output');
    const outputResult = await electronClient.selectOutputDirectory();
    
    if (!outputResult.success) {
      conversionStatus.setStatus('cancelled');
      showFeedback('Conversion cancelled: No output directory selected', 'info');
      return;
    }
    
    // Use Electron's conversion functionality even in web mode
    await handleElectronConversion(items, apiKey, outputResult.path);
  } catch (error) {
    console.error('Web conversion error:', error);
    conversionStatus.setError(error.message);
    conversionStatus.setStatus('error');
    throw error;
  }
}

/**
 * Triggers the download of the converted files or opens the file in Electron
 */
export function triggerDownload() {
  const result = get(conversionResult);
  if (!result) {
    console.error('No conversion result available');
    return;
  }

  // Handle Electron environment
  if (isElectron && result.outputPath) {
    // The file is already saved to the file system
    // Opening is handled by the ResultDisplay component
    console.log('File already saved to:', result.outputPath);
    return;
  }

  // Handle web environment
  if (result.blob) {
    const { blob, contentType, items } = result;
    let filename;

    // For single markdown files, use original filename with .md extension
    if (contentType === 'text/markdown') {
      const originalName = items[0]?.name;
      filename = originalName ? 
        originalName.replace(/\.[^/.]+$/, '.md') : 
        `document_${new Date().toISOString().replace(/[:.]/g, '-')}.md`;
    } else {
      // For zip files (multiple files or complex conversions)
      filename = `conversion_${new Date().toISOString().replace(/[:.]/g, '-')}.zip`;
    }
    
    FileSaver.saveAs(blob, filename);
  } else {
    console.error('No blob available for download');
  }
  
  // Only clear files store after successful download
  const clearResult = files.clearFiles();
  if (!clearResult.success) {
    console.warn('Failed to clear files store:', clearResult.message);
  }
}

/**
 * Cancels the ongoing conversion process
 */
export function cancelConversion() {
  if (isElectron) {
    electronClient.cancelRequests();
  } else {
    client.cancelRequests();
  }

  conversionStatus.setStatus('cancelled');
  
  files.update(items => 
    items.map(item => 
      item.status === 'converting' 
        ? { ...item, status: 'cancelled' } 
        : item
    )
  );
}

/**
 * Shows feedback message
 */
function showFeedback(message, type = 'info') {
  console.log(`${type.toUpperCase()}: ${message}`);
}
