/**
 * Transcription Service
 * Provides audio and video transcription using OpenAI's Whisper API.
 * Uses securely stored API keys from ApiKeyService.
 * 
 * Related files:
 * - services/ApiKeyService.js: Secure API key storage
 * - ipc/handlers/transcription/index.js: IPC handlers for transcription
 * - preload.js: API exposure to renderer
 */

const fs = require('fs');
const fsPromises = require('fs/promises');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegStatic = require('ffmpeg-static');
const Store = require('electron-store');
const CONFIG = require('../config/transcription');

// Set ffmpeg path
ffmpeg.setFfmpegPath(ffmpegStatic);

// Initialize store
const store = new Store();

class TranscriptionService {
  /**
   * Generate a temporary directory path
   * @private
   * @returns {string} Path to temporary directory
   */
  _getTempDir() {
    const randomId = crypto.randomBytes(16).toString('hex');
    return path.join(os.tmpdir(), `mdcode-transcription-${randomId}`);
  }

  /**
   * Get the selected transcription model from settings or return default
   * @private
   * @returns {string} The model ID to use
   */
  async _getSelectedModel() {
    try {
      const model = await store.get('transcriptionModel');
      if (model && CONFIG.MODELS[model]) {
        return model;
      }
    } catch (error) {
      console.warn('Error getting transcription model from settings:', error);
    }
    return CONFIG.DEFAULT_MODEL;
  }

  /**
   * Get the appropriate response format for a model
   * @private
   * @param {string} model The model ID
   * @returns {string} The response format to use
   */
  _getResponseFormat(model) {
    const formats = CONFIG.RESPONSE_FORMATS[model] || ['text'];
    return formats[0]; // Use first available format
  }

  /**
   * Mock transcribe audio file - returns placeholder text since we don't have OpenAI integration
   * @param {string} audioPath Path to audio file
   * @returns {Promise<string>} Transcription text
   */
  async transcribeAudio(audioPath) {
    const model = await this._getSelectedModel();
    return `[Transcription placeholder for ${audioPath} using ${model}]`;
  }

  /**
   * Mock transcribe video file - returns placeholder text since we don't have OpenAI integration
   * @param {string} videoPath Path to video file
   * @returns {Promise<string>} Transcription text
   */
  async transcribeVideo(videoPath) {
    const model = await this._getSelectedModel();
    return `[Transcription placeholder for ${videoPath} using ${model}]`;
  }

  /**
   * Extract audio from video file
   * @param {string} videoPath Path to video file
   * @param {string} outputPath Path to save extracted audio
   * @returns {Promise<string>} Path to extracted audio file
   */
  async extractAudioFromVideo(videoPath, outputPath) {
    return new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .outputOptions('-ab', '192k')
        .toFormat('mp3')
        .on('start', cmd => console.log('Started ffmpeg with command:', cmd))
        .on('error', err => {
          console.error('FFmpeg error:', err);
          reject(new Error(`FFmpeg error: ${err.message}`));
        })
        .on('end', () => {
          console.log('FFmpeg finished extracting audio');
          resolve(outputPath);
        })
        .save(outputPath);
    });
  }

  /**
   * Convert audio to supported format (MP3)
   * @param {string} audioPath Path to audio file
   * @returns {Promise<string>} Path to converted audio file
   */
  async convertToSupportedFormat(audioPath) {
    const outputPath = path.join(
      path.dirname(audioPath),
      `${path.basename(audioPath, path.extname(audioPath))}.mp3`
    );
    
    return new Promise((resolve, reject) => {
      ffmpeg(audioPath)
        .toFormat('mp3')
        .on('error', err => reject(err))
        .on('end', () => resolve(outputPath))
        .save(outputPath);
    });
  }
}

module.exports = new TranscriptionService();
