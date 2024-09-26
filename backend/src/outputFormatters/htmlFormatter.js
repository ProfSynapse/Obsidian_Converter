// backend/src/outputFormatters/htmlFormatter.js

import { logger } from '../utils/logger.js';

/**
 * Formats the given data as HTML
 * @param {Object} data - The data to be formatted
 * @returns {string} HTML formatted string
 */
export function htmlFormatter(data) {
  try {
    let html = '<html><body>';

    // Helper function to convert object to HTML
    const objectToHtml = (obj) => {
      let htmlContent = '<ul>';
      for (const [key, value] of Object.entries(obj)) {
        htmlContent += `<li><strong>${key}:</strong> `;
        if (typeof value === 'object' && value !== null) {
          htmlContent += objectToHtml(value);
        } else {
          htmlContent += `${value}`;
        }
        htmlContent += '</li>';
      }
      htmlContent += '</ul>';
      return htmlContent;
    };

    html += objectToHtml(data);
    html += '</body></html>';
    
    logger.info('Data successfully formatted to HTML');
    return html;
  } catch (error) {
    logger.error(`Error formatting data to HTML: ${error.message}`);
    throw new Error('Failed to format data as HTML');
  }
}