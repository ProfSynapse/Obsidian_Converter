// backend/src/utils/pdfUtils.js

import fs from 'fs/promises';
import pdfParse from 'pdf-parse';
import logger from './logger.js';

/**
 * @file pdfUtils.js
 * @description Utilities for handling PDF files.
 */

/**
 * Extracts text from a PDF file.
 * @param {string} filePath - The path to the PDF file.
 * @returns {Promise<string>} The extracted text.
 */
export async function extractTextFromPDF(filePath) {
  try {
    const dataBuffer = await fs.readFile(filePath);
    const data = await pdfParse(dataBuffer);
    logger.info(`Extracted text from PDF: ${filePath}`);
    return data.text;
  } catch (error) {
    logger.error(`Error extracting text from PDF: ${error.message}`);
    throw new Error('PDF text extraction failed');
  }
}
