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
 * Creates a structured ZIP file from multiple converted items
 * @param {Array<Object>} items - Array of conversion results
 * @returns {Promise<Buffer>} - The ZIP file buffer
 */
export async function createBatchZip(items) {
  const zip = new JSZip();
  const categories = new Map();

  // Add summary first
  const summary = generateSummary(items);
  zip.file('summary.md', summary);

  for (const item of items) {
    try {
      if (!item) continue; // Skip null/undefined items
      
      const { content, images = [], name, type = 'unknown' } = item;
      const category = item.category || getCategory(type);
      categories.set(category, true);

      // Get or create category folder
      const categoryFolder = zip.folder(category);
      if (!categoryFolder) continue;

      const baseName = path.basename(name, path.extname(name));

      // Handle web content specially
      if (category === 'web') {
        const siteFolder = categoryFolder.folder(baseName);
        if (siteFolder) {
          siteFolder.file('index.md', content);
          if (images?.length > 0) {
            const assetsFolder = siteFolder.folder('assets');
            for (const image of images) {
              if (image?.data && image?.name) {
                const imageBuffer = Buffer.from(image.data, 'base64');
                assetsFolder.file(image.name, imageBuffer);
              }
            }
          }
        }
      } else {
        // Other content types
        categoryFolder.file(`${baseName}.md`, content);
        
        // Handle attachments
        if (images?.length > 0) {
          const attachmentsFolder = zip.folder(`${category}/${baseName}_attachments`);
          for (const image of images) {
            if (image?.data && image?.name) {
              const imageBuffer = Buffer.from(image.data, 'base64');
              attachmentsFolder.file(image.name, imageBuffer);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error processing item for zip:', error);
    }
  }

  // Clean up empty folders recursively
  const cleanupFolders = (folder) => {
    if (!folder || !folder.files) return;
    
    folder.forEach((relativePath, file) => {
      if (file.dir && file.files && Object.keys(file.files).length === 0) {
        zip.remove(relativePath);
      }
    });
  };

  cleanupFolders(zip);

  return zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 }
  });
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
 * Processes audio transcription content for ZIP
 * @param {Object} item - The conversion result item
 * @param {JSZip} folder - The JSZip folder to add content to
 */
async function processAudioContent(item, folder) {
  console.log(`Processing audio content for: "${item.name}"`);
  
  // Create a transcriptions folder
  const transcriptFolder = folder.folder('transcriptions');
  
  // Create markdown file with transcription
  const safeFilename = sanitizeFilename(`${item.name}.md`);
  transcriptFolder.file(safeFilename, item.content);
  
  console.log(`Added transcription file: "${safeFilename}"`);
  
  // Add original audio if available
  if (item.originalContent) {
    const audioFolder = folder.folder('audio');
    const safeAudioName = sanitizeFilename(item.name);
    audioFolder.file(safeAudioName, item.originalContent, { binary: true });
    console.log(`Added original audio file: "${safeAudioName}"`);
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
  processAudioContent,
  generateSummary,
};
