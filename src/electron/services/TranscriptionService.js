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
const { OpenAI } = require('openai');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegStatic = require('ffmpeg-static');
const apiKeyService = require('./ApiKeyService');

// Set ffmpeg path
ffmpeg.setFfmpegPath(ffmpegStatic);

class TranscriptionService {
  constructor() {
    this.openai = null;
  }

  /**
   * Initialize OpenAI client with API key
   * @private
   */
  async _initializeClient() {
    // Get API key from secure storage
    const apiKey = apiKeyService.getApiKey('openai');
    
    if (!apiKey) {
      throw new Error('OpenAI API key not configured');
    }
    
    this.openai = new OpenAI({ apiKey });
    return this.openai;
  }

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
   * Transcribe audio file
   * @param {string} audioPath Path to audio file
   * @returns {Promise<string>} Transcription text
   */
  async transcribeAudio(audioPath) {
    try {
      if (!this.openai) {
        await this._initializeClient();
      }
      
      // Create a read stream for the audio file
      const audioStream = fs.createReadStream(audioPath);
      
      // Call OpenAI API
      const response = await this.openai.audio.transcriptions.create({
        file: audioStream,
        model: "whisper-1",
      });
      
      return response.text;
    } catch (error) {
      console.error('Audio transcription error:', error);
      throw error;
    }
  }

  /**
   * Transcribe video file by extracting audio first
   * @param {string} videoPath Path to video file
   * @returns {Promise<string>} Transcription text
   */
  async transcribeVideo(videoPath) {
    const tempDir = this._getTempDir();
    const audioPath = path.join(tempDir, 'audio.mp3');
    
    try {
      // Create temp directory
      await fsPromises.mkdir(tempDir, { recursive: true });
      
      // Extract audio from video
      await this.extractAudioFromVideo(videoPath, audioPath);
      
      // Transcribe the extracted audio
      const transcription = await this.transcribeAudio(audioPath);
      
      return transcription;
    } catch (error) {
      console.error('Video transcription error:', error);
      throw error;
    } finally {
      // Clean up temp directory
      try {
        await fsPromises.rm(tempDir, { recursive: true, force: true });
      } catch (cleanupError) {
        console.warn('Failed to clean up temp directory:', cleanupError);
      }
    }
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
