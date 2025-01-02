// services/converter/web/htmlConverter.js

import TurndownService from 'turndown';
import * as cheerio from 'cheerio'; // Corrected import
import path from 'path';

/**
 * Converts an HTML string or buffer to Markdown format, extracting images.
 * @param {Buffer|string} input - The HTML content as a buffer or string.
 * @param {string} originalName - Original filename for context.
 * @param {string} [apiKey] - API key if needed.
 * @returns {Promise<{ content: string, images: Array }>} - Converted content and images.
 */
export async function convertHtmlToMarkdown(input, originalName, apiKey) {
  try {
    // Convert buffer to string if necessary
    const htmlContent = Buffer.isBuffer(input) ? input.toString('utf-8') : input;

    // Initialize TurndownService
    const turndownService = new TurndownService({
      headingStyle: 'atx',
      codeBlockStyle: 'fenced',
      emDelimiter: '_',
      strongDelimiter: '**'
    });

    // Add custom rules if needed
    turndownService.addRule('strikethrough', {
      filter: ['del', 's', 'strike'],
      replacement: function (content) {
        return '~~' + content + '~~';
      }
    });

    // Load HTML into Cheerio for parsing
    const $ = cheerio.load(htmlContent);

    // Extract images
    const images = [];
    $('img').each((index, img) => {
      const src = $(img).attr('src');
      const alt = $(img).attr('alt') || `Image ${index + 1}`;
      if (src) {
        // Handle base64 images or external URLs
        if (src.startsWith('data:')) {
          const matches = src.match(/^data:(image\/[a-zA-Z]+);base64,(.+)$/);
          if (matches) {
            const imageType = matches[1].split('/')[1];
            const imageData = matches[2];
            const imageName = `image-${index + 1}.${imageType}`;
            images.push({
              name: imageName,
              data: imageData,
              type: `image/${imageType}`,
              path: `attachments/${path.basename(originalName, path.extname(originalName))}/${imageName}`
            });

            // Replace src with new path
            $(img).attr(
              'src',
              `attachments/${path.basename(originalName, path.extname(originalName))}/${imageName}`
            );
          }
        } else {
          // For external URLs, you might want to download and include them
          // This implementation assumes images are to be handled externally
          images.push({
            name: path.basename(src),
            data: '', // Placeholder if you plan to download images
            type: '', // Placeholder for image type
            path: src // External path
          });
        }
      }
    });

    // Get modified HTML with updated image paths
    const modifiedHtml = $.html();

    // Convert HTML to Markdown
    let markdownContent = turndownService.turndown(modifiedHtml);

    // Add metadata
    const metadataMarkdown =
      `# ${path.basename(originalName, path.extname(originalName))}\n\n` +
      `**Converted on:** ${new Date().toISOString()}\n\n`;

    // Combine metadata and content
    const fullMarkdown = metadataMarkdown + markdownContent;

    return {
      content: fullMarkdown,
      images: images
    };
  } catch (error) {
    console.error('Error converting HTML to Markdown:', error);
    throw error;
  }
}
