// backend/src/outputFormatters/codeFormats/iniFormatter.js

import ini from 'ini';
import { logger } from '../../utils/logger.js';

/**
 * Formats the given data as INI
 * @param {Object} data - The data to be formatted
 * @returns {string} INI formatted string
 */
export function iniFormatter(data) {
  try {
    const iniString = ini.stringify(data);
    logger.info('Data successfully formatted to INI');
    return iniString;
  } catch (error) {
    logger.error(`Error formatting data to INI: ${error.message}`);
    throw new Error('Failed to format data as INI');
  }
}