// src/lib/utils/conversionManager.js

import { get } from 'svelte/store';
import { files } from '$lib/stores/files.js';
import { apiKey } from '$lib/stores/apiKey.js';
import { conversionStatus } from '$lib/stores/conversionStatus.js';
import client, { ConversionError } from '$lib/api/client.js';
import FileSaver from 'file-saver';
import { CONFIG } from '$lib/config';  // Add this import

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
 * Prepares a single item for conversion
 */
async function prepareItem(item) {
  try {
    // Validate required properties
    if (!item.id || !item.name) {
      throw ConversionError.validation(`Item ${item.name} is missing required properties`);
    }

    const baseItem = {
      id: item.id,
      name: item.name,
      options: {
        includeImages: true,
        includeMeta: true,
        convertLinks: true
      }
    };

    // Handle URL types
    if (item.url || item.name.startsWith('http')) {
      const url = item.url || item.name;
      return {
        ...baseItem,
        type: item.type === 'parent' ? 'parent' : 'url',
        url: url,
        content: url
      };
    }

    // Handle File type with proper type detection
    if (item.file instanceof File) {
      const fileExt = item.name.split('.').pop().toLowerCase();
      const type = determineFileType(fileExt);
      
      return {
        ...baseItem,
        type,
        file: item.file
      };
    }

    throw ConversionError.validation(`Unsupported item type or missing content: ${item.name}`);
  } catch (error) {
    console.error(`Error preparing ${item.name}:`, error);
    throw error instanceof ConversionError ? error : ConversionError.validation(error.message);
  }
}

function determineFileType(extension) {
  const categories = CONFIG.FILES.CATEGORIES;
  
  if (categories.audio.includes(extension)) return 'audio';
  if (categories.video.includes(extension)) return 'video';
  if (categories.documents.includes(extension)) return 'document';
  if (categories.data.includes(extension)) return 'data';
  if (categories.web.includes(extension)) return 'web';
  
  return 'file';
}

/**
 * Prepares batch items for conversion
 */
function prepareBatchItems(items) {
  if (!Array.isArray(items) || items.length === 0) {
    throw ConversionError.validation('No items provided for conversion');
  }
  
  // Log items before processing
  console.log('Preparing batch items:', items);
  
  return Promise.all(items.map(async item => {
    const prepared = await prepareItem(item);
    console.log('Prepared item:', prepared); // Debug log
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

  conversionStatus.reset();
  conversionStatus.setStatus('converting');

  try {
    // Prepare items for conversion
    const items = await prepareBatchItems(currentFiles);
    const itemCount = items.length;

    // Configure endpoint mapping
    const getEndpoint = (item) => {
      if (item.type === 'audio') return '/multimedia/audio';
      if (item.type === 'video') return '/multimedia/video';
      if (item.type === 'url') return '/web/url';
      if (item.type === 'parent') return '/web/parent-url';
      return '/document/file';
    };

    console.log('Starting conversion:', { itemCount, items });

    // Process items with progress tracking
    const response = await client.processItems(items, currentApiKey, {
        useBatch: itemCount > 1,
        getEndpoint,
        onProgress: (progress) => {
            console.log(`Conversion progress: ${progress}%`);
            conversionStatus.setProgress(progress);
        },
        onItemComplete: (itemId, success, error) => {
            console.log(`Item ${itemId} completed:`, { success, error });
            files.updateFile(itemId, {
                status: success ? 'completed' : 'error',
                error: error?.message || null
            });
        }
    });

    // Handle ZIP blob response
    if (response instanceof Blob) {
        const filename = `conversion_${new Date().toISOString().replace(/[:.]/g, '-')}.zip`;
        FileSaver.saveAs(response, filename);
    }

    // Update status
    conversionStatus.setStatus('completed');
    showFeedback('Conversion completed successfully', 'success');

  } catch (error) {
    console.error('Conversion error:', error);

    const errorMessage = error instanceof ConversionError ? 
        error.message : 
        error.message || 'An unexpected error occurred during conversion';

    conversionStatus.setError(errorMessage);
    conversionStatus.setStatus('error');
    showFeedback(errorMessage, 'error');
  }
}

/**
 * Shows feedback message
 */
function showFeedback(message, type = 'info') {
  console.log(`${type.toUpperCase()}: ${message}`);
}