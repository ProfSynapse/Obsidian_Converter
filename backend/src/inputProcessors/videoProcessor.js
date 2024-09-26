// backend/src/inputProcessors/videoProcessor.js

import { transcribeVideo } from '../services/transcriber.js';
import { logger } from '../utils/logger.js';

/**
 * Processes video input
 * @param {Buffer} buffer - The file buffer
 * @returns {string} Transcribed text content
 */
export async function videoProcessor(buffer) {
  try {
    const transcription = await transcribeVideo(buffer);
    logger.info('Video file processed successfully');
    return transcription;
  } catch (error) {
    logger.error(`Error processing video file: ${error.message}`);
    throw new Error('Failed to process video file');
  }
}