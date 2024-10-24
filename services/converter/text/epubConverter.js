// services/converter/text/epubConverter.js

import EPub from 'epub';
import TurndownService from 'turndown';
import { promisify } from 'util';
import tmp from 'tmp-promise';
import fs from 'fs/promises';
import path from 'path';

/**
 * Converts an EPUB buffer to Markdown format, extracting text and images.
 * @param {Buffer} input - The EPUB file buffer.
 * @param {string} originalName - Original filename for context.
 * @param {string} [apiKey] - API key if needed.
 * @returns {Promise<{ content: string, images: Array }>} - Converted content and images.
 */
export async function convertEpubToMarkdown(input, originalName, apiKey) {
  let tempFile;
  try {
    // Create a temporary file to store the EPUB buffer
    tempFile = await tmp.file({ postfix: '.epub' });
    const tempFilePath = tempFile.path;

    // Write buffer to the temporary file
    await fs.writeFile(tempFilePath, input);

    // Initialize EPub with the temporary file path
    const epub = new EPub(tempFilePath);
    const openEpub = promisify(epub.open.bind(epub));
    const getChapter = promisify(epub.getChapter.bind(epub));
    const getImage = promisify(epub.getImage.bind(epub));

    await openEpub();

    const turndownService = new TurndownService({
      headingStyle: 'atx',
      codeBlockStyle: 'fenced'
    });

    // Metadata
    let markdown = `# ${epub.metadata.title || 'Untitled EPUB'}\n\n`;
    markdown += `**Author:** ${epub.metadata.creator || 'Unknown'}\n\n`;
    if (epub.metadata.description) {
      markdown += `**Description:** ${epub.metadata.description}\n\n`;
    }
    markdown += `**Publication Date:** ${epub.metadata.date || 'Unknown'}\n\n`;

    // Table of Contents
    markdown += `## Table of Contents\n\n`;
    epub.flow.forEach((chapter, index) => {
      markdown += `${index + 1}. [${chapter.title}](#chapter-${index + 1})\n`;
    });
    markdown += '\n';

    // Process chapters
    const baseName = path.basename(originalName || 'untitled', path.extname(originalName || ''));
    const images = [];

    for (let i = 0; i < epub.flow.length; i++) {
      const chapter = epub.flow[i];
      const chapterContent = await getChapter(chapter.id);
      markdown += `## Chapter ${i + 1}: ${chapter.title}\n\n`;

      // Convert HTML to Markdown
      const markdownContent = turndownService.turndown(chapterContent);
      markdown += markdownContent + '\n\n';
    }

    // Extract images from the EPUB manifest
    const imagePromises = Object.values(epub.manifest)
      .filter(item => item.mediaType.startsWith('image/'))
      .map(async (item) => {
        const imageBuffer = await getImage(item.id);
        const imageName = path.basename(item.href);
        const imageData = imageBuffer.toString('base64');
        const imageType = item.mediaType;

        images.push({
          name: imageName,
          data: imageData,
          type: imageType,
          path: `attachments/${baseName}/${imageName}`
        });

        return {
          originalPath: item.href,
          newPath: `attachments/${baseName}/${imageName}`
        };
      });

    const imageMappings = await Promise.all(imagePromises);

    // Replace image sources in markdown with the new attachment paths
    imageMappings.forEach(mapping => {
      const originalHref = mapping.originalPath;
      const newPath = mapping.newPath;

      // EPUB image hrefs may have internal references, e.g., "../Images/image1.png"
      // Normalize the originalHref by removing directory paths
      const normalizedHref = path.basename(originalHref);

      // Replace all occurrences of the original image path with the new path
      const regex = new RegExp(`\\(.*${normalizedHref}\\)`, 'g');
      markdown = markdown.replace(regex, `(${newPath})`);
    });

    return {
      content: markdown,
      images: images
    };
  } catch (error) {
    console.error('Error converting EPUB to Markdown:', error);
    throw error;
  } finally {
    // Clean up the temporary file
    if (tempFile) {
      await tempFile.cleanup();
    }
  }
}
