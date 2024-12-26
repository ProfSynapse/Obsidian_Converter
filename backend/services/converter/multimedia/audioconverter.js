import fs from 'fs/promises';
import { openaiProxy } from '../../openaiProxy.js';
import { generateMarkdown } from '../../../utils/markdownGenerator.js';
import { FormData } from 'formdata-node';

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB (OpenAI's current limit)
const SUPPORTED_FORMATS = ['mp3', 'mp4', 'mpeg', 'mpga', 'm4a', 'wav', 'webm'];

export async function convertAudioToMarkdown(input, originalName, apiKey) {
  try {
    // Validate input
    if (!Buffer.isBuffer(input)) {
      throw new Error('Input must be a buffer');
    }

    // Check file size
    if (input.length > MAX_FILE_SIZE) {
      throw new Error(`File size exceeds the maximum limit of ${MAX_FILE_SIZE / (1024 * 1024)} MB`);
    }

    // Validate file format
    const fileExt = originalName.split('.').pop().toLowerCase();
    if (!SUPPORTED_FORMATS.includes(fileExt)) {
      throw new Error(`Unsupported audio format. Supported formats: ${SUPPORTED_FORMATS.join(', ')}`);
    }

    // Create FormData instance
    const formData = new FormData();
    formData.append('file', new Blob([input]), originalName);
    formData.append('model', 'whisper-1');
    formData.append('response_format', 'text');

    // Call OpenAI Whisper API via proxy
    const transcriptionResponse = await openaiProxy.makeRequest(
      apiKey,
      'audio/transcriptions',
      formData
    );

    if (!transcriptionResponse?.text) {
      throw new Error('Failed to transcribe audio');
    }

    // Generate Markdown
    const markdown = generateMarkdown({
      title: `Audio Transcription: ${originalName}`,
      content: transcriptionResponse.text,
      metadata: {
        source: originalName,
        type: 'audio-transcription',
        created: new Date().toISOString()
      }
    });

    return {
      content: markdown,
      images: [], // No images for audio transcription
      success: true
    };

  } catch (error) {
    console.error('Error in audio conversion:', error);
    throw error;
  }
}

// Helper function to format timestamps (if provided by the API)
function formatTimestamp(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
}