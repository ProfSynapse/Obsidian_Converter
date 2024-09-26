// backend/src/outputFormatters/markdownFormatter.js

import { logger } from '../utils/logger.js';

/**
 * Formats the given data as Markdown
 * @param {Object} data - The data to be formatted
 * @returns {string} Markdown formatted string
 */
export function markdownFormatter(data) {
  try {
    let markdown = '';

    // Helper function to convert object to markdown
    const objectToMarkdown = (obj, depth = 0) => {
      let md = '';
      for (const [key, value] of Object.entries(obj)) {
        const prefix = '#'.repeat(depth + 1) + ' ';
        if (typeof value === 'object' && value !== null) {
          md += `${prefix}${key}\n\n${objectToMarkdown(value, depth + 1)}\n`;
        } else {
          md += `${prefix}${key}\n\n${value}\n\n`;
        }
      }
      return md;
    };

    markdown = objectToMarkdown(data);
    
    logger.info('Data successfully formatted to Markdown');
    return markdown.trim();
  } catch (error) {
    logger.error(`Error formatting data to Markdown: ${error.message}`);
    throw new Error('Failed to format data as Markdown');
  }
}