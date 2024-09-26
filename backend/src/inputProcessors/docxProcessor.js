// backend/src/inputProcessors/docxProcessor.js

import mammoth from 'mammoth';
import { logger } from '../utils/logger.js';

/**
 * Processes DOCX input
 * @param {Buffer} buffer - The file buffer
 * @returns {string} Processed text content
 */
export async function docxProcessor(buffer) {
  try {
    const result = await mammoth.extractRawText({ buffer });
    logger.info('DOCX file processed successfully');
    return result.value;
  } catch (error) {
    logger.error(`Error processing DOCX file: ${error.message}`);
    throw new Error('Failed to process DOCX file');
  }
}