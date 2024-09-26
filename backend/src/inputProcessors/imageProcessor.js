// backend/src/inputProcessors/imageProcessor.js

import sharp from 'sharp';
import { logger } from '../utils/logger.js';

/**
 * Processes image input
 * @param {Buffer} buffer - The file buffer
 * @returns {Object} Processed image data including metadata and OCR results
 */
export async function imageProcessor(buffer) {
  try {
    const metadata = await sharp(buffer).metadata();
    const ocrResult = await performOCR(buffer);

    const result = {
      metadata: {
        format: metadata.format,
        width: metadata.width,
        height: metadata.height,
        space: metadata.space,
        channels: metadata.channels,
        depth: metadata.depth,
        density: metadata.density,
        hasAlpha: metadata.hasAlpha,
        hasProfile: metadata.hasProfile,
        isProgressive: metadata.isProgressive,
      },
      ocrText: ocrResult,
    };

    logger.info('Image file processed successfully');
    return result;
  } catch (error) {
    logger.error(`Error processing image file: ${error.message}`);
    throw new Error('Failed to process image file');
  }
}