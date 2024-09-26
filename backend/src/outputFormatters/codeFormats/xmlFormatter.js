// backend/src/outputFormatters/codeFormats/xmlFormatter.js

import { create } from 'xmlbuilder2';
import { logger } from '../../utils/logger.js';

/**
 * Formats the given data as XML
 * @param {Object} data - The data to be formatted
 * @returns {string} XML formatted string
 */
export function xmlFormatter(data) {
  try {
    const xml = create({ version: '1.0' }).ele(data).end({ prettyPrint: true });
    logger.info('Data successfully formatted to XML');
    return xml;
  } catch (error) {
    logger.error(`Error formatting data to XML: ${error.message}`);
    throw new Error('Failed to format data as XML');
  }
}