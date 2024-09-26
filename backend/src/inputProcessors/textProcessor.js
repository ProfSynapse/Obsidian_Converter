// backend/src/inputProcessors/textProcessor.js

import { logger } from '../utils/logger.js';

/**
 * Processes plain text input
 * @param {Buffer} buffer - The file buffer
 * @returns {string} Processed text content
 */
export async function textProcessor(buffer) {
  try {
    const text = buffer.toString('utf-8');
    logger.info('Text file processed successfully');
    return text;
  } catch (error) {
    logger.error(`Error processing text file: ${error.message}`);
    throw new Error('Failed to process text file');
  }
}