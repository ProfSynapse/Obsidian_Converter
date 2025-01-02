// services/converter/text/txtConverter.js

import path from 'path';

/**
 * Converts a TXT buffer to Markdown format.
 * @param {Buffer} input - The TXT file buffer.
 * @param {string} originalName - Original filename for context.
 * @param {string} [apiKey] - API key if needed.
 * @returns {Promise<{ content: string, images: Array }>} - Converted content and images.
 * @throws Will throw an error if the conversion fails.
 */
export async function convertTxtToMarkdown(input, originalName, apiKey) {
  try {
    // Convert buffer to string
    const content = input.toString('utf-8');

    // Split content into lines
    const lines = content.split(/\r?\n/);

    // Process each line
    const markdownLines = lines.map(line => {
      // Escape Markdown syntax characters
      const escapedLine = line.replace(/([\\`*_{}[\]()#+\-.!])/g, '\\$1');
      
      // Ensure line breaks are preserved in Markdown
      return escapedLine + '  ';
    });

    // Join lines back together
    const markdownContent = markdownLines.join('\n');

    // Add some basic metadata
    const metadataMarkdown = `# ${path.basename(originalName, path.extname(originalName))}\n\n` +
                             `**Converted on:** ${new Date().toISOString()}\n\n`;

    return {
      content: metadataMarkdown + markdownContent,
      images: [] // No image extraction
    };
  } catch (error) {
    console.error('Error converting TXT to Markdown:', error);
    throw error;
  }
}
