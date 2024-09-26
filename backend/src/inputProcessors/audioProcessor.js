// backend/src/inputProcessors/audioProcessor.js

import { transcribeAudio } from '../services/transcriber.js';
import { logger } from '../utils/logger.js';

/**
 * Processes audio input
 * @param {Buffer} buffer - The file buffer
 * @returns {string} Transcribed text content
 */
export async function audioProcessor(buffer) {
  try {
    const transcription = await transcribeAudio(buffer);
    logger.info('Audio file processed successfully');
    return transcription;
  } catch (error) {
    logger.error(`Error processing audio file: ${error.message}`);
    throw new Error('Failed to process audio file');
  }
}