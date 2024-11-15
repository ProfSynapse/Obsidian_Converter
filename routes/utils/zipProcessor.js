// routes/convert/utils/zipProcessor.js

import JSZip from 'jszip';
import sanitizeFilename from 'sanitize-filename';
import path from 'path';
import { determineCategory } from './categoryDetector.js';
import { textConverterFactory } from '../../services/converter/textConverterFactory.js';

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
      type, content, name, apiKey
    );

    if (!conversionResult.content) {
      throw new Error('Conversion produced no content');
    }

    return {
      success: true,
      content: conversionResult.content,
      type,
      name,
      category: determineCategory(type),
      ...conversionResult
    };
  } catch (error) {
    console.error(`Conversion error for ${name}:`, error);
    throw error;
  }
}
  
  

/**
 * Creates a structured ZIP file from multiple converted items
 */
export async function createBatchZip(items) {
  console.log('Starting ZIP creation with items:', items);
  const zip = new JSZip();

  // Initialize top-level folder references
  const topLevelFolders = {
    data: zip.folder('data'),
    multimedia: zip.folder('multimedia'),
    text: zip.folder('text'),
    web: zip.folder('web'),
    errors: zip.folder('errors'), // Ensure errors folder exists
  };

  // Process each converted item
  for (const item of items) {
    try {
      // Check if 'type' exists
      if (!item.type) {
        throw new Error(`Item "${item.name}" is missing the 'type' property.`);
      }

      console.log(`Processing item: ${item.name} of type: ${item.type}`);

      if (!item.success) {
        // Handle failed conversions
        console.log(`Adding error file for: ${item.name}`);
        topLevelFolders.errors.file(
          `${sanitizeFilename(item.name || 'unknown')}_error.md`,
          `# Conversion Error\n\n**Error:** ${item.error}\n**Time:** ${new Date().toISOString()}`
        );
        continue;
      }

      // Determine the category
      const category = item.category || determineCategory(item.type, item.fileType);
      console.log(`Determined category: ${category} for item: ${item.name}`);

      if (category === 'others') {
        // Optionally, handle or skip items with 'others' category
        console.warn(`Skipping item with 'others' category: ${item.name}`);
        continue;
      }

      const topLevelFolder = topLevelFolders[category];
      console.log(`Adding content to category folder: ${category}`);

      switch (item.type.toLowerCase()) {
        case 'file':
          await processFileContent(item, topLevelFolder);
          break;
        case 'url':
          await processUrlContent(item, topLevelFolder);
          break;
        case 'parenturl':
          await processParentUrlContent(item, topLevelFolder);
          break;
        case 'youtube':
          await processYoutubeContent(item, topLevelFolder);
          break;
        default:
          console.warn(`Unknown type: ${item.type}`);
      }
    } catch (error) {
      console.error(`Error processing item in ZIP: ${error.message}`);
      // Optionally, add to errors folder
      topLevelFolders.errors.file(
        `${sanitizeFilename(item.name || 'unknown')}_zip_error.md`,
        `# ZIP Processing Error\n\n**Error:** ${error.message}\n**Item:** ${item.name}\n**Time:** ${new Date().toISOString()}`
      );
    }
  }

  // Add conversion summary if any successful items exist
  if (items.some((item) => item.success)) {
    console.log('Adding summary.md to ZIP');
    zip.file('summary.md', generateSummary(items));
  }

  const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
  console.log('ZIP creation completed');

  return zipBuffer;
}

/**
 * Processes YouTube content for ZIP
 */
export async function processYoutubeContent(item, folder) {
  console.log(`Processing YouTube content for: ${item.name}`);
  // Add main Markdown file
  const safeFilename = sanitizeFilename(`${item.name}.md`);
  folder.file(safeFilename, item.content);
  console.log(`Added Markdown file: ${safeFilename}`);

  // If the converter includes images or other assets, add them here
  if (item.images?.length) {
    const assetsFolder = folder.folder('assets');
    console.log(`Adding ${item.images.length} images to assets`);
    for (const image of item.images) {
      if (image.data && image.name) {
        const safeImageName = sanitizeFilename(path.basename(image.name));
        assetsFolder.file(safeImageName, image.data, { base64: true });
        console.log(`Added image: ${safeImageName}`);
      }
    }
  }
}

/**
 * Generates a summary markdown file for the batch conversion
 */
export function generateSummary(items) {
  console.log('Generating conversion summary');
  const successful = items.filter((i) => i.success);
  const failed = items.filter((i) => !i.success);

  return [
    '# Conversion Summary',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    '## Statistics',
    `- Total Items: ${items.length}`,
    `- Successful: ${successful.length}`,
    `- Failed: ${failed.length}`,
    '',
    '## Successful Conversions',
    ...successful.map(
      (item) =>
        `- **${item.name}** (${item.type})${
          item.images?.length ? ` - ${item.images.length} image(s)` : ''
        }`
    ),
    '',
    failed.length
      ? [
          '## Failed Conversions',
          ...failed.map((item) => `- **${item.name}**: ${item.error}`),
        ].join('\n')
      : '',
  ]
    .filter(Boolean)
    .join('\n');
}

/**
 * Processes file content for ZIP
 */
async function processFileContent(item, folder) {
  console.log(`Processing file content for: ${item.name}`);
  // Add main content
  folder.file(sanitizeFilename(item.name), item.content);
  console.log(`Added file: ${sanitizeFilename(item.name)}`);

  // Add images if present
  if (item.images?.length) {
    // Ensure assets folder is created only once per category
    const assetsFolder = folder.folder('assets');
    console.log(`Adding ${item.images.length} images to assets`);
    for (const image of item.images) {
      if (image.data && image.name) {
        // Use only the base filename to prevent double nesting
        const safeImageName = sanitizeFilename(path.basename(image.name));
        assetsFolder.file(safeImageName, image.data, { base64: true });
        console.log(`Added image: ${safeImageName}`);
      }
    }
  }
}

/**
 * Processes URL content for ZIP
 */
async function processUrlContent(item, folder) {
  if (!item.content) {
      throw new Error(`Missing content for ${item.name}`);
  }

  const urlToUse = item.originalUrl || `https://${item.name}`;
  const siteName = sanitizeFilename(new URL(urlToUse).hostname);
  const siteFolder = folder.folder(siteName);
  const assetsFolder = siteFolder.folder('assets');

  // Add content
  siteFolder.file('index.md', item.content);

  // Handle images
  if (item.images?.length) {
      for (const image of item.images) {
          if (image.data) {
              const safeImageName = sanitizeFilename(image.name);
              assetsFolder.file(safeImageName, image.data, { base64: true });
              
              // Update image references in content
              item.content = item.content.replace(
                  new RegExp(image.url, 'g'),
                  `assets/${safeImageName}`
              );
          }
      }
  }
}

/**
 * Processes Parent URL content for ZIP
 */
async function processParentUrlContent(item, folder) {
  console.log(`Processing Parent URL content for: ${item.name}`);
  const siteName = sanitizeFilename(new URL(item.url).hostname);

  // Create a folder for the website under the 'web' top-level folder
  const siteFolder = folder.folder(siteName);
  console.log(`Created site folder: ${siteName}`);

  // Add index.md
  siteFolder.file('index.md', item.content);
  console.log(`Added index.md to ${siteName}`);

  // Add page files directly under the site folder without 'pages/' prefix
  if (item.files) {
    for (const file of item.files) {
      const fileName = sanitizeFilename(path.basename(file.name));
      siteFolder.file(fileName, file.content);
      console.log(`Added page file: ${fileName} to ${siteName}`);
    }
  }

  // Add images to assets folder if present
  if (item.images?.length) {
    const assetsFolder = siteFolder.folder('assets');
    console.log(`Adding ${item.images.length} images to assets in ${siteName}`);
    for (const image of item.images) {
      if (image.data && image.name) {
        const safeImageName = sanitizeFilename(path.basename(image.name));
        assetsFolder.file(safeImageName, image.data, { base64: true });
        console.log(`Added image: ${safeImageName} to ${siteName}/assets`);
      }
    }
  }
}
