// src/lib/utils/conversionManager.js

import { get } from 'svelte/store';
import { files } from '$lib/stores/files.js';
import { apiKey } from '$lib/stores/apiKey.js';
import { conversionStatus } from '$lib/stores/conversionStatus.js';
import client, { ConversionError } from '$lib/api/client.js';
import FileSaver from 'file-saver';

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
      type: item.type || 'document',
      options: {
        includeImages: true,
        includeMeta: true,
        convertLinks: true
      }
    };

    // Handle URL and Parent URL types
    if (item.url || item.name.startsWith('http://') || item.name.startsWith('https://')) {
      const url = item.url || item.name;
      return {
        ...baseItem,
        type: item.type === 'parent' ? 'parent' : 'url',  // Set correct type for parent URLs
        url: url, 
        content: url // Required for API compatibility
      };
    }

    // Handle File type
    if (item.file instanceof File) {
      const base64Content = await readFileAsBase64(item.file);
      return {
        ...baseItem,
        type: 'file',
        content: base64Content,
        file: item.file 
      };
    }

    throw ConversionError.validation(`Unsupported item type or missing content: ${item.name}`);
  } catch (error) {
    console.error(`Error preparing ${item.name}:`, error);
    throw error instanceof ConversionError ? error : ConversionError.validation(error.message);
  }
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

    console.log('Starting conversion:', { itemCount, items });

    // Process items with progress tracking
    const results = await client.processItems(items, currentApiKey, {
        useBatch: itemCount > 1,
        onProgress: (progress) => {
            console.log(`Conversion progress: ${progress}%`);
            conversionStatus.setProgress(progress);
        },
        onItemComplete: (itemId, success, error) => {
            console.log(`Item ${itemId} completed:`, { success, error });
            const status = success ? 'completed' : 'error';
            files.updateFile(itemId, {
                status,
                error: error?.message || null
            });
        }
    });

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