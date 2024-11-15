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

    // Extract file extension as fileType
    const fileType = path.extname(name).substring(1).toLowerCase();

    const result = {
      success: true,
      content: conversionResult.content,
      type,
      name: sanitizeFilename(name), // Ensure name is sanitized
      category: determineCategory(type, fileType),
      images: conversionResult.images || [],
    };

    // Include URL if type is 'url'
    if (type.toLowerCase() === 'url') {
      result.url = content; // Assuming 'content' is the URL string
    }

    return result;
  } catch (error) {
    console.error(`Conversion error for "${name}":`, error);
    // Return an error object instead of throwing to handle in createBatchZip
    return {
      success: false,
      error: error.message,
      type,
      name: sanitizeFilename(name),
    };
  }
}

/**
 * Creates a structured ZIP file from multiple converted items
 * @param {Array<Object>} items - Array of conversion results
 * @returns {Promise<Buffer>} - The ZIP file buffer
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
      if (!item.type) {
        throw new Error(`Item "${item.name}" is missing the 'type' property.`);
      }

      console.log(`Processing item: "${item.name}" of type: "${item.type}"`);

      if (!item.success) {
        // Handle failed conversions
        console.log(`Adding error file for: "${item.name}"`);
        topLevelFolders.errors.file(
          `${sanitizeFilename(item.name || 'unknown')}_error.md`,
          `# Conversion Error\n\n**Error:** ${item.error}\n**Time:** ${new Date().toISOString()}`
        );
        continue;
      }

      // Determine the category
      const category = item.category || determineCategory(item.type);
      console.log(`Determined category: "${category}" for item: "${item.name}"`);

      if (!topLevelFolders[category]) {
        // Create category folder if it doesn't exist
        topLevelFolders[category] = zip.folder(category);
        console.log(`Created new category folder: "${category}"`);
      }

      const categoryFolder = topLevelFolders[category];

      // Add content to the appropriate folder
      switch (item.type.toLowerCase()) {
        case 'file':
          await processFileContent(item, categoryFolder);
          break;
        case 'url':
          await processUrlContent(item, categoryFolder);
          break;
        case 'parenturl':
          await processParentUrlContent(item, categoryFolder);
          break;
        case 'youtube':
          await processYoutubeContent(item, categoryFolder);
          break;
        default:
          console.warn(
            `Unknown type "${item.type}" for item "${item.name}". Adding as a text file.`
          );
          await processFileContent(item, categoryFolder);
      }
    } catch (error) {
      console.error(`Error processing item "${item.name}":`, error);
      // Add to errors folder
      topLevelFolders.errors.file(
        `${sanitizeFilename(item.name || 'unknown')}_processing_error.md`,
        `# ZIP Processing Error\n\n**Error:** ${error.message}\n**Item:** ${
          item.name
        }\n**Time:** ${new Date().toISOString()}`
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
 * Processes file content for ZIP
 * @param {Object} item - The conversion result item
 * @param {JSZip} folder - The JSZip folder to add content to
 */
async function processFileContent(item, folder) {
  console.log(`Processing file content for: "${item.name}"`);
  folder.file(`${sanitizeFilename(item.name)}.md`, item.content);
  console.log(`Added file: "${sanitizeFilename(item.name)}.md"`);

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
// routes/utils/zipProcessor.js

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
