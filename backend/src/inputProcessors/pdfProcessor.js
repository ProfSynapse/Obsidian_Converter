// backend/src/inputProcessors/pdfProcessor.js

import pdf from 'pdf-parse';
import { logger } from '../utils/logger.js';

/**
 * Processes PDF input
 * @param {Buffer} buffer - The file buffer
 * @returns {string} Processed text content
 */
export async function pdfProcessor(buffer) {
  try {
    const data = await pdf(buffer);
    logger.info('PDF file processed successfully');
    return data.text;
  } catch (error) {
    logger.error(`Error processing PDF file: ${error.message}`);
    throw new Error('Failed to process PDF file');
  }
}