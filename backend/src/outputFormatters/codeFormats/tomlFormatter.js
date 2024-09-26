// backend/src/outputFormatters/codeFormats/tomlFormatter.js

import toml from '@iarna/toml';
import { logger } from '../../utils/logger.js';

/**
 * Formats the given data as TOML
 * @param {Object} data - The data to be formatted
 * @returns {string} TOML formatted string
 */
export function tomlFormatter(data) {
  try {
    const tomlString = toml.stringify(data);
    logger.info('Data successfully formatted to TOML');
    return tomlString;
  } catch (error) {
    logger.error(`Error formatting data to TOML: ${error.message}`);
    throw new Error('Failed to format data as TOML');
  }
}