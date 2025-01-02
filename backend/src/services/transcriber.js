// services/transcriber.js

import fs from 'fs/promises';
import path from 'path';
import { OpenAI } from 'openai';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import { Readable } from 'stream';

// Set the ffmpeg path
ffmpeg.setFfmpegPath(ffmpegStatic);

class Transcriber {
  constructor() {
    this.openai = null;
  }

  initialize(apiKey) {
    this.openai = new OpenAI({ apiKey });
  }

  async transcribe(filePath, apiKey) {
    if (!this.openai) {
      this.initialize(apiKey);
    }

    try {
      const fileExtension = path.extname(filePath).toLowerCase();
      let audioFile = filePath;

      // Convert video to audio if necessary
      if (['.mp4', '.avi', '.mov', '.webm'].includes(fileExtension)) {
        audioFile = await this.convertVideoToAudio(filePath);
      }

      // Check if the audio format is supported, convert if not
      if (!['.mp3', '.mp4', '.mpeg', '.mpga', '.m4a', '.wav', '.webm'].includes(path.extname(audioFile).toLowerCase())) {
        audioFile = await this.convertToSupportedAudioFormat(audioFile);
      }

      const transcript = await this.transcribeAudio(audioFile);

      // Clean up temporary audio file if it was created
      if (audioFile !== filePath) {
        await fs.unlink(audioFile);
      }

      return transcript;
    } catch (error) {
      console.error('Transcription error:', error);
      throw error;
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