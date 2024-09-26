// backend/src/outputFormatters/csvFormatter.js

import { stringify } from 'csv-stringify/sync';
import { logger } from '../utils/logger.js';

/**
 * Formats the given data as CSV
 * @param {Array} data - The data to be formatted (array of objects)
 * @returns {string} CSV formatted string
 */
export function csvFormatter(data) {
  try {
    if (!Array.isArray(data)) {
      throw new Error('Input must be an array of objects');
    }
    const csvString = stringify(data, { header: true });
    logger.info('Data successfully formatted to CSV');
    return csvString;
  } catch (error) {
    logger.error(`Error formatting data to CSV: ${error.message}`);
    throw new Error('Failed to format data as CSV');
  }
}