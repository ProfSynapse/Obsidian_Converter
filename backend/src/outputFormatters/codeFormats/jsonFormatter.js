// backend/src/outputFormatters/codeFormats/jsonFormatter.js

import { logger } from '../../utils/logger.js';

/**
 * Formats the given data as JSON
 * @param {Object} data - The data to be formatted
 * @returns {string} JSON formatted string
 */
export function jsonFormatter(data) {
  try {
    const jsonString = JSON.stringify(data, null, 2);
    logger.info('Data successfully formatted to JSON');
    return jsonString;
  } catch (error) {
    logger.error(`Error formatting data to JSON: ${error.message}`);
    throw new Error('Failed to format data as JSON');
  }
}