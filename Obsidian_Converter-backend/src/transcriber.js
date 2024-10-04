import fs from 'fs';
import OpenAI from 'openai';
import { join, dirname } from 'path';
import { writeFile, readFile } from 'fs/promises';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import { fileURLToPath } from 'url';
import tmp from 'tmp';

// Ensure tmp creates files synchronously and handles cleanup
tmp.setGracefulCleanup();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

async function createOpenAIClient(apiKey) {
  return new OpenAI({ apiKey });
}

export async function transcribeAudio(filePath, apiKey) {
  try {
    console.log('Transcribing audio file:', filePath);
    
    const openai = await createOpenAIClient(apiKey);
    const response = await openai.audio.transcriptions.create({
      file: fs.createReadStream(filePath),
      model: 'whisper-1',
    });

    console.log('Audio transcription API call successful');
    return response.text;
  } catch (error) {
    console.error('Error transcribing audio:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    throw error;
  }
}

async function convertVideoToAudio(videoPath, audioPath) {
  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .outputOptions('-vn')
      .audioCodec('libmp3lame')
      .audioBitrate('128k')
      .save(audioPath)
      .on('end', () => {
        console.log('Video converted to audio successfully');
        resolve();
      })
      .on('error', (err) => {
        console.error('Error converting video to audio:', err);
        reject(err);
      });
  });
}

export async function transcribeVideo(buffer, fileType, apiKey) {
  let tempVideoPath, tempAudioPath, videoTmp, audioTmp;
  try {
    // Create temporary video file
    videoTmp = tmp.fileSync({ postfix: `.${fileType}` });
    tempVideoPath = videoTmp.name;
    console.log(`Created temporary video file: ${tempVideoPath}`);
    await writeFile(tempVideoPath, buffer);

    // Create temporary audio file
    audioTmp = tmp.fileSync({ postfix: '.mp3' });
    tempAudioPath = audioTmp.name;
    console.log(`Created temporary audio file: ${tempAudioPath}`);

    // Convert video to audio
    console.log('Starting video to audio conversion');
    await convertVideoToAudio(tempVideoPath, tempAudioPath);

    // Transcribe the audio
    console.log('Starting audio transcription');
    const transcription = await transcribeAudio(tempAudioPath, apiKey);

    console.log('Video transcription completed successfully');
    return transcription;
  } catch (error) {
    console.error('Error in transcribeVideo:', error);
    throw error;
  } finally {
    // Clean up temporary files
    if (videoTmp) videoTmp.removeCallback();
    if (audioTmp) audioTmp.removeCallback();
  }
}