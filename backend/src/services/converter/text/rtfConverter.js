// services/converter/text/rtfConverter.js

import rtfModule from '@iarna/rtf-to-html'; // CommonJS module
import TurndownService from 'turndown';
import path from 'path';

/**
 * Converts an RTF buffer to Markdown format.
 * @param {Buffer} input - The RTF file buffer.
 * @param {string} originalName - Original filename for context.
 * @param {string} [apiKey] - API key if needed.
 * @returns {Promise<{ content: string, images: Array }>} - Converted content and images.
 * @throws Will throw an error if the conversion fails.
 */
export async function convertRtfToMarkdown(input, originalName, apiKey) {
  try {
    // Destructure the rtfToHTML function from the imported CommonJS module
    const { rtfToHTML } = rtfModule;

    // Convert RTF to HTML using the rtfToHTML function
    const html = await new Promise((resolve, reject) => {
      rtfToHTML(input, (err, htmlOutput) => {
        if (err) {
          reject(err);
        } else {
          resolve(htmlOutput);
        }
      });
    });

    // Initialize TurndownService for HTML to Markdown conversion
    const turndownService = new TurndownService();

    // Convert the HTML content to Markdown
    const markdown = turndownService.turndown(html);

    // Add some basic metadata
    const metadataMarkdown = `# ${path.basename(originalName, path.extname(originalName))}\n\n` +
                             `**Converted on:** ${new Date().toISOString()}\n\n`;

    return {
      content: metadataMarkdown + markdown,
      images: [] // No image extraction
    };
  } catch (error) {
    console.error('Error converting RTF to Markdown:', error);
    throw error;
  }
}
