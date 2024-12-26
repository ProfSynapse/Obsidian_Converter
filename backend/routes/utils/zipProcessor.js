// routes/utils/zipProcessor.js

import JSZip from 'jszip';
import sanitizeFilename from 'sanitize-filename';
import path from 'path';
import { determineCategory } from './categoryDetector.js';
import { textConverterFactory } from '../../services/converter/textConverterFactory.js';

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

    console.log(`Conversion successful for ${name}, content length: ${conversionResult.content.length}`);

    const fileType = path.extname(name).substring(1).toLowerCase();

    const result = {
      success: true,
      content: conversionResult.content,
      type,
      name: sanitizeFilename(name),
      category: determineCategory(type, fileType),
      images: conversionResult.images || [],
      originalContent: content // Preserve original content for debugging
    };

    if (type.toLowerCase() === 'url') {
      result.url = content;
    }

    return result;
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

/**
 * Creates a structured ZIP file from multiple converted items
 * @param {Array<Object>} items - Array of conversion results
 * @returns {Promise<Buffer>} - The ZIP file buffer
 */
export async function createBatchZip(items) {
  console.log('Starting ZIP creation with items:', 
    items.map(item => ({
      name: item.name,
      type: item.type,
      success: item.success,
      contentLength: item.content?.length,
      imageCount: item.images?.length
    }))
  );

  const zip = new JSZip();
  const categories = new Map();

  for (const item of items) {
    try {
      if (!item.content) {
        console.warn(`Skipping item ${item.name}: No content`);
        continue;
      }

      console.log('Processing item:', {
        name: item.name,
        type: item.type,
        success: item.success,
        hasContent: !!item.content
      });

      const category = item.category || 'others';
      console.log(`Determined category: "${category}" for item: "${item.name}"`);

      // Get or create category folder
      let categoryFolder = categories.get(category);
      if (!categoryFolder) {
        categoryFolder = zip.folder(category);
        categories.set(category, categoryFolder);
        console.log(`Created new category folder: "${category}"`);
      }

      // Process based on type
      switch (item.type.toLowerCase()) {
        case 'url':
        case 'parenturl':
          await processUrlContent(item, categoryFolder);
          break;
        case 'youtube':
          await processYoutubeContent(item, categoryFolder);
          break;
        case 'pdf':
        case 'docx':
        case 'txt':
        case 'rtf':
        case 'odt':
        case 'epub':
          console.log(`Processing document type: ${item.type}`);
          await processFileContent(item, categoryFolder);
          break;
        default:
          console.log(`Processing generic content type: ${item.type}`);
          await processFileContent(item, categoryFolder);
      }
    } catch (error) {
      console.error(`Error processing item ${item.name}:`, error);
    }
  }

  // Add summary
  console.log('Adding summary.md to ZIP');
  zip.file('summary.md', generateSummary(items));

  console.log('ZIP creation completed');
  return zip.generateAsync({ type: 'nodebuffer' });
}

/**
 * Processes file content for ZIP
 * @param {Object} item - The conversion result item
 * @param {JSZip} folder - The JSZip folder to add content to
 */
async function processFileContent(item, folder) {
  console.log(`Processing ${item.type} file content for: "${item.name}" with content length: ${item.content.length}`);
  
  // Strip .pdf extension if present and add .md
  const fileName = item.name.replace(/\.pdf$/, '') + '.md';
  folder.file(fileName, item.content);
  console.log(`Added file: "${fileName}" with content length: ${item.content.length}`);
  
  if (item.images?.length) {
    await processImages(item, folder);
  }
}

/**
 * Processes URL content for ZIP
 * @param {Object} item - The conversion result item
 * @param {JSZip} folder - The JSZip folder to add content to
 */
async function processUrlContent(item, folder) {
  if (!item.url) {
    throw new Error(`Missing 'url' property for item "${item.name}"`);
  }

  console.log(`Processing URL content for: "${item.name}"`);
  const siteName = sanitizeFilename(new URL(item.url).hostname);
  const siteFolder = folder.folder(siteName);
  console.log(`Created site folder: "${siteName}"`);

  // Modify markdown content to reference local assets
  let modifiedContent = item.content;
  if (item.images?.length) {
    for (const image of item.images) {
      if (image.url && image.name) {
        const safeImageName = sanitizeFilename(path.basename(image.name));
        const localPath = `assets/${safeImageName}`;
        // Replace all occurrences of the original image URL with the local path
        const escapedUrl = escapeRegExp(image.url);
        const regex = new RegExp(escapedUrl, 'g');
        modifiedContent = modifiedContent.replace(regex, localPath);
      }
    }
  }

  // Add index.md with modified content
  siteFolder.file('index.md', modifiedContent);
  console.log(`Added index.md to "${siteName}"`);

  // Handle images and update content paths
  if (item.images?.length) {
    const assetsFolder = siteFolder.folder('assets');
    console.log(
      `Adding ${item.images.length} image(s) to assets for "${siteName}"`
    );
    for (const image of item.images) {
      try {
        if (!image.data || !image.name) {
          console.warn(
            `Incomplete image data for "${image.name}" in "${item.name}". Skipping.`
          );
          continue;
        }

        // Decode base64 image data
        const buffer = Buffer.from(image.data, 'base64');
        const safeImageName = sanitizeFilename(path.basename(image.name));

        assetsFolder.file(safeImageName, buffer, { binary: true });
        console.log(`Added image: "${safeImageName}"`);
      } catch (imgError) {
        console.error(
          `Error processing image "${image.name}" for "${item.name}":`,
          imgError
        );
      }
    }
  }
}

/**
 * Processes YouTube content for ZIP
 * @param {Object} item - The conversion result item
 * @param {JSZip} folder - The JSZip folder to add content to
 */
async function processYoutubeContent(item, folder) {
  console.log(`Processing YouTube content for: "${item.name}"`);
  const safeFilename = sanitizeFilename(`${item.name}.md`);
  folder.file(`${safeFilename}`, item.content);
  console.log(`Added Markdown file: "${safeFilename}"`);

  if (item.images?.length) {
    const assetsFolder = folder.folder('assets');
    console.log(
      `Adding ${item.images.length} image(s) to assets for "${item.name}"`
    );
    for (const image of item.images) {
      if (image.data && image.name) {
        const safeImageName = sanitizeFilename(path.basename(image.name));
        const buffer = Buffer.from(image.data, 'base64'); // Decode base64
        assetsFolder.file(safeImageName, buffer, { binary: true });
        console.log(`Added image: "${safeImageName}"`);
      }
    }
  }
}

/**
 * Processes Parent URL content for ZIP
 * @param {Object} item - The conversion result item
 * @param {JSZip} folder - The JSZip folder to add content to
 */
async function processParentUrlContent(item, folder) {
  if (!item.url) {
    throw new Error(`Missing 'url' property for item "${item.name}"`);
  }

  console.log(`Processing Parent URL content for: "${item.name}"`);
  const siteName = sanitizeFilename(new URL(item.url).hostname);
  const siteFolder = folder.folder(siteName);
  console.log(`Created site folder: "${siteName}"`);

  // Add index.md
  siteFolder.file('index.md', item.content);
  console.log(`Added index.md to "${siteName}"`);

  // Add additional pages if any
  if (item.files && Array.isArray(item.files)) {
    for (const file of item.files) {
      const fileName = sanitizeFilename(path.basename(file.name));
      siteFolder.file(`${fileName}.md`, file.content);
      console.log(`Added page file: "${fileName}.md" to "${siteName}"`);
    }
  }

  // Handle images
  if (item.images?.length) {
    const assetsFolder = siteFolder.folder('assets');
    console.log(
      `Adding ${item.images.length} image(s) to assets for "${siteName}"`
    );
    for (const image of item.images) {
      if (image.data && image.name) {
        const safeImageName = sanitizeFilename(path.basename(image.name));
        const buffer = Buffer.from(image.data, 'base64'); // Decode base64
        assetsFolder.file(safeImageName, buffer, { binary: true });
        console.log(`Added image: "${safeImageName}" to "${siteName}/assets"`);
      }
    }
  }
}

/**
 * Generates a summary markdown file for the batch conversion
 * @param {Array<Object>} items - Array of conversion results
 * @returns {string} - The summary markdown content
 */
function generateSummary(items) {
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

// Export functions for use in other modules
export {
  processFileContent,
  processUrlContent,
  processYoutubeContent,
  processParentUrlContent,
  generateSummary,
};
