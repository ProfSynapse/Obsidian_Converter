// backend/src/services/transcriber.js

import fs from 'fs';
import OpenAI from 'openai';
import path from 'path';
import { dirname } from 'path';
import { writeFile } from 'fs/promises';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import { fileURLToPath } from 'url';
import tmp from 'tmp';
import { loadPromptsConfig } from '../utils/promptLoader.js';
import logger from '../utils/logger.js';

// Ensure tmp creates files synchronously and handles cleanup
tmp.setGracefulCleanup();

// Setup __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirnamePath = dirname(__filename);

// Configure ffmpeg
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

// Initialize OpenAI with API key
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Transcribes an audio file using OpenAI's Whisper API.
 * @param {string} filePath - The path to the audio file.
 * @returns {Promise<string>} - The transcribed text.
 */
export async function transcribeAudio(filePath) {
  try {
    logger.info('Starting audio transcription:', filePath);

    // Load prompts configuration to get the Whisper model
    const config = await loadPromptsConfig();
    const whisperModel = config.models.whisper || 'whisper-1';

    const response = await openai.audio.transcriptions.create({
      file: fs.createReadStream(filePath),
      model: whisperModel,
    });

    logger.info('Audio transcription successful');
    return response.text;
  } catch (error) {
    logger.error('Error transcribing audio:', error.message);
    if (error.response) {
      logger.error('Response status:', error.response.status);
      logger.error('Response data:', JSON.stringify(error.response.data));
    }
    throw error;
  }
}

/**
 * Converts a video file to audio using ffmpeg.
 * @param {string} videoPath - The path to the video file.
 * @param {string} audioPath - The path to save the converted audio file.
 * @returns {Promise<void>}
 */
function convertVideoToAudio(videoPath, audioPath) {
  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .outputOptions('-vn') // No video
      .audioCodec('libmp3lame') // Audio codec
      .audioBitrate('128k') // Audio bitrate
      .save(audioPath)
      .on('end', () => {
        logger.info('Video successfully converted to audio:', audioPath);
        resolve();
      })
      .on('error', (err) => {
        logger.error('Error converting video to audio:', err.message);
        reject(err);
      });
  });
}

/**
 * Transcribes a video file by converting it to audio first.
 * @param {Buffer} buffer - The buffer of the video file.
 * @param {string} fileType - The file extension/type (e.g., 'mp4', 'mov').
 * @returns {Promise<string>} - The transcribed text.
 */
export async function transcribeVideo(buffer, fileType) {
  let tempVideoPath, tempAudioPath, videoTmp, audioTmp;
  try {
    // Create temporary video file
    videoTmp = tmp.fileSync({ postfix: `.${fileType}` });
    tempVideoPath = videoTmp.name;
    logger.info(`Created temporary video file: ${tempVideoPath}`);
    await writeFile(tempVideoPath, buffer);

    // Create temporary audio file
    audioTmp = tmp.fileSync({ postfix: '.mp3' });
    tempAudioPath = audioTmp.name;
    logger.info(`Created temporary audio file: ${tempAudioPath}`);

    // Convert video to audio
    logger.info('Converting video to audio...');
    await convertVideoToAudio(tempVideoPath, tempAudioPath);

    // Transcribe the audio
    logger.info('Transcribing audio from video...');
    const transcription = await transcribeAudio(tempAudioPath);

    logger.info('Video transcription completed successfully');
    return transcription;
  } catch (error) {
    logger.error('Error in transcribeVideo:', error.message);
    throw error;
  } finally {
    // Clean up temporary files
    if (videoTmp) videoTmp.removeCallback();
    if (audioTmp) audioTmp.removeCallback();
    logger.info('Temporary files cleaned up');
  }
}
