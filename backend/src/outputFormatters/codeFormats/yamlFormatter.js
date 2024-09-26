// backend/src/outputFormatters/codeFormats/yamlFormatter.js

import yaml from 'js-yaml';
import { logger } from '../../utils/logger.js';

/**
 * Formats the given data as YAML
 * @param {Object} data - The data to be formatted
 * @returns {string} YAML formatted string
 */
export function yamlFormatter(data) {
  try {
    const yamlString = yaml.dump(data);
    logger.info('Data successfully formatted to YAML');
    return yamlString;
  } catch (error) {
    logger.error(`Error formatting data to YAML: ${error.message}`);
    throw new Error('Failed to format data as YAML');
  }
}