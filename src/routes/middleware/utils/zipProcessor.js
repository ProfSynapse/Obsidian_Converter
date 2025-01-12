// routes/utils/zipProcessor.js

import JSZip from 'jszip';
import sanitizeFilename from 'sanitize-filename';
import path from 'path';
import { determineCategory } from '../../../utils/fileTypeUtils.js';
import { textConverterFactory } from '../../../services/converter/textConverterFactory.js';  // Fix path with correct number of directory levels

/**
 * Escapes RegExp special characters in a string.
 * @param {string} string - The string to escape.
 * @returns {string} - The escaped string.
 */
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Handles the conversion of a single item.
 * @param {string} type - The type of content (e.g., 'youtube', 'file', etc.)
 * @param {string|Buffer|Object} content - The content to convert
 * @param {string} name - The name of the item
 * @param {string} apiKey - The API key for authenticated services
 * @returns {Promise<Object>} - The result of the conversion
 */
export async function handleConversion(type, content, name, apiKey) {
  try {
    const conversionResult = await textConverterFactory.convertToMarkdown(
      type,
      content,
      name,
      apiKey
    );

    if (!conversionResult.content) {
      throw new Error('Conversion produced no content');
    }

    const fileType = path.extname(name).substring(1).toLowerCase();
    // Use category from content or determine it using the utility
    const category = content.category || determineCategory(type, fileType);

    return {
      success: true,
      content: conversionResult.content,
      type,
      name: sanitizeFilename(name),
      category,
      images: conversionResult.images || [],
      originalContent: content // Preserve original content for debugging
    };

  } catch (error) {
    console.error(`Conversion error for "${name}":`, error);
    return {
      success: false,
      error: error.message,
      type,
      name: sanitizeFilename(name),
      content: `# Conversion Error\n\nFailed to convert ${name}\nError: ${error.message}` // Add error content
    };
  }
}

const CATEGORIES = {
  multimedia: ['audio', 'video', 'mp3', 'mp4', 'wav', 'ogg', 'webm'],
  web: ['url', 'parenturl', 'youtube', 'html', 'htm'],
  text: ['txt', 'rtf', 'pdf', 'docx', 'odt', 'epub', 'pptx'],
  data: ['csv', 'json', 'yaml', 'yml', 'xlsx']
};

function getCategory(type) {
  return Object.entries(CATEGORIES).find(([_, types]) => 
    types.includes(type.toLowerCase())
  )?.[0] || 'other';
}

/**
 * Creates a structured ZIP file from multiple converted items with memory optimization
 * @param {Array<Object>} items - Array of conversion results
 * @returns {Promise<Buffer>} - The ZIP file buffer
 */
export async function createBatchZip(items) {
  console.log('📦 Starting ZIP creation:', {
    itemCount: items.length,
    memory: process.memoryUsage()
  });

  const zip = new JSZip();
  const categories = new Map();

  // Add summary first
  const summary = generateSummary(items);
  zip.file('summary.md', summary);

  // Track memory usage
  const initialMemory = process.memoryUsage().heapUsed;
  let currentBatch = [];
  let batchSize = 0;
  const MAX_BATCH_SIZE = 50 * 1024 * 1024; // 50MB batch size

  // Process items in batches to manage memory
  for (const item of items) {
    try {
      if (!item) continue;

      const itemSize = calculateItemSize(item);
      if (batchSize + itemSize > MAX_BATCH_SIZE) {
        // Process current batch
        console.log('💾 Processing batch:', {
          items: currentBatch.length,
          batchSize: Math.round(batchSize / 1024 / 1024) + 'MB',
          memory: process.memoryUsage()
        });

        await processBatch(zip, currentBatch, categories);
        currentBatch = [];
        batchSize = 0;

        // Force garbage collection if available
        if (global.gc) {
          console.log('🧹 Running garbage collection');
          global.gc();
        }
      }

      currentBatch.push(item);
      batchSize += itemSize;
    } catch (error) {
      console.error('Error processing item for zip:', error);
    }
  }

  // Process remaining items
  if (currentBatch.length > 0) {
    console.log('💾 Processing final batch:', {
      items: currentBatch.length,
      batchSize: Math.round(batchSize / 1024 / 1024) + 'MB',
      memory: process.memoryUsage()
    });
    await processBatch(zip, currentBatch, categories);
  }

  // Clean up empty folders recursively
  cleanupFolders(zip);

  console.log('📦 Generating ZIP file:', {
    categories: Array.from(categories.keys()),
    memory: process.memoryUsage(),
    memoryChange: Math.round((process.memoryUsage().heapUsed - initialMemory) / 1024 / 1024) + 'MB'
  });

  // Generate ZIP with streaming support
  return zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 },
    streamFiles: true
  });
}

/**
 * Calculate approximate size of an item for batching
 * @param {Object} item - The item to calculate size for
 * @returns {number} - Approximate size in bytes
 */
function calculateItemSize(item) {
  let size = 0;
  if (item.content) {
    size += item.content.length;
  }
  if (item.images) {
    size += item.images.reduce((total, img) => total + (img.data ? img.data.length : 0), 0);
  }
  return size;
}

/**
 * Process a batch of items
 * @param {JSZip} zip - The ZIP object
 * @param {Array} batch - Batch of items to process
 * @param {Map} categories - Categories map
 */
async function processBatch(zip, batch, categories) {
  for (const item of batch) {
    const { content, images = [], name, type = 'unknown' } = item;
    const category = item.category || getCategory(type);
    categories.set(category, true);

    const categoryFolder = zip.folder(category);
    if (!categoryFolder) continue;

    const baseName = path.basename(name, path.extname(name));

    try {
      if (category === 'web') {
        await processWebContent(categoryFolder, baseName, content, images);
      } else {
        await processRegularContent(categoryFolder, category, baseName, content, images);
      }
    } catch (error) {
      console.error(`Error processing item ${name}:`, error);
    }
  }
}

/**
 * Process web content
 * @param {JSZip} categoryFolder - The category folder
 * @param {string} baseName - Base name for the content
 * @param {string} content - The content
 * @param {Array} images - Array of images
 */
async function processWebContent(categoryFolder, baseName, content, images) {
  const siteFolder = categoryFolder.folder(baseName);
  if (siteFolder) {
    siteFolder.file('index.md', content);
    if (images?.length > 0) {
      const assetsFolder = siteFolder.folder('assets');
      for (const image of images) {
        if (image?.data && image?.name) {
          try {
            const imageBuffer = Buffer.from(image.data, 'base64');
            assetsFolder.file(image.name, imageBuffer);
          } catch (error) {
            console.error(`Error processing image ${image.name}:`, error);
          }
        }
      }
    }
  }
}

/**
 * Process regular content
 * @param {JSZip} categoryFolder - The category folder
 * @param {string} category - Category name
 * @param {string} baseName - Base name for the content
 * @param {string} content - The content
 * @param {Array} images - Array of images
 */
async function processRegularContent(categoryFolder, category, baseName, content, images) {
  categoryFolder.file(`${baseName}.md`, content);
  
  if (images?.length > 0) {
    const attachmentsFolder = categoryFolder.folder(`${baseName}_attachments`);
    for (const image of images) {
      if (image?.data && image?.name) {
        try {
          const imageBuffer = Buffer.from(image.data, 'base64');
          attachmentsFolder.file(image.name, imageBuffer);
        } catch (error) {
          console.error(`Error processing attachment ${image.name}:`, error);
        }
      }
    }
  }
}

/**
 * Clean up empty folders
 * @param {JSZip} zip - The ZIP object
 */
function cleanupFolders(zip) {
  if (!zip || !zip.files) return;
  
  zip.forEach((relativePath, file) => {
    if (file.dir && file.files && Object.keys(file.files).length === 0) {
      zip.remove(relativePath);
    }
  });
}
