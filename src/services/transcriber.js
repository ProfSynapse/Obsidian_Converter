// services/transcriber.js

import fs from 'fs/promises';
import { createReadStream } from 'fs';  // Add this import
import path from 'path';
import { OpenAI } from 'openai';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import { Readable } from 'stream';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';

// Set ffmpeg path only
ffmpeg.setFfmpegPath(ffmpegStatic);

class Transcriber {
  constructor() {
    this.openai = null;
  }

  initialize(apiKey) {
    this.openai = new OpenAI({ apiKey });
  }

  async transcribe(input, apiKey) {
    if (!this.openai) {
      this.initialize(apiKey);
    }

    let audioPath;
    const isBuffer = Buffer.isBuffer(input);
    const tempDir = path.join(os.tmpdir(), uuidv4());

    try {
      await fs.mkdir(tempDir, { recursive: true });

      if (isBuffer) {
        // For buffer input, create temporary file
        audioPath = path.join(tempDir, 'audio.mp3');
        await fs.writeFile(audioPath, input);
      } else {
        audioPath = input; // For path input, use directly
      }

      // Use the imported createReadStream instead of fs.createReadStream
      const audioStream = createReadStream(audioPath);
      
      const response = await this.openai.audio.transcriptions.create({
        file: audioStream,
        model: "whisper-1",
      });

      return response.text;
    } catch (error) {
      console.error('Transcription error:', error);
      throw error;
    } finally {
      if (isBuffer) {
        // Cleanup temp directory if we created it
        try {
          await fs.rm(tempDir, { recursive: true, force: true });
        } catch (cleanupError) {
          console.warn('Failed to cleanup temp directory:', cleanupError);
        }
      }
    }
  }

  async convertVideoToAudio(videoPath) {
    const outputPath = videoPath.replace(path.extname(videoPath), '.mp3');
    return new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .outputOptions('-ab', '192k')
        .save(outputPath)
        .on('end', () => resolve(outputPath))
        .on('error', (err) => reject(err));
    });
  }

  async convertToSupportedAudioFormat(audioPath) {
    const outputPath = audioPath.replace(path.extname(audioPath), '.mp3');
    return new Promise((resolve, reject) => {
      ffmpeg(audioPath)
        .toFormat('mp3')
        .on('end', () => resolve(outputPath))
        .on('error', (err) => reject(err))
        .save(outputPath);
    });
  }

  async extractAudioFromVideo(buffer) {
    const tempDir = path.join(os.tmpdir(), uuidv4());
    const inputPath = path.join(tempDir, 'input.mp4');
    const outputPath = path.join(tempDir, 'output.mp3');

    try {
      // Create temp directory
      await fs.mkdir(tempDir, { recursive: true });
      
      // Write buffer to temp file
      await fs.writeFile(inputPath, buffer);

      console.log('Extracting audio with ffmpeg:', {
        inputPath,
        outputPath,
        ffmpegPath: ffmpegStatic
      });

      // Extract audio
      await new Promise((resolve, reject) => {
        ffmpeg(inputPath)
          .toFormat('mp3')
          .on('start', cmd => console.log('Started ffmpeg with command:', cmd))
          .on('error', err => {
            console.error('FFmpeg error:', err);
            reject(new Error(`FFmpeg error: ${err.message}`));
          })
          .on('end', () => {
            console.log('FFmpeg finished extracting audio');
            resolve();
          })
          .save(outputPath);
      });

      // Read output file
      const audioBuffer = await fs.readFile(outputPath);
      return audioBuffer;

    } catch (error) {
      console.error('Audio extraction error:', error);
      throw error;
    } finally {
      // Cleanup temp files
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
      } catch (cleanupError) {
        console.warn('Failed to cleanup temp files:', cleanupError);
      }
    }
  }

  async transcribeAudio(audioPath) {
    const audioStream = fs.createReadStream(audioPath);
    
    const response = await this.openai.audio.transcriptions.create({
      file: audioStream,
      model: "whisper-1",
    });

    return response.text;
  }
}

export const transcriber = new Transcriber();