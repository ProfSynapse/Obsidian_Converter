// audioConverter.js
import fs from 'fs/promises';
import { openaiProxy } from '../../openaiProxy.js';
import { generateMarkdown } from './markdownGenerator.js';

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB (OpenAI's current limit)

export async function convertAudioToMarkdown(filePath, apiKey) {
  try {
    // Check file size
    const stats = await fs.stat(filePath);
    if (stats.size > MAX_FILE_SIZE) {
      throw new Error(`File size exceeds the maximum limit of ${MAX_FILE_SIZE / (1024 * 1024)} MB`);
    }

    // Read file
    const fileBuffer = await fs.readFile(filePath);

    // Prepare form data for OpenAI API
    const formData = new FormData();
    formData.append('file', new Blob([fileBuffer]), 'audio.mp3');
    formData.append('model', 'whisper-1');

    // Call OpenAI Whisper API via proxy
    const transcriptionResponse = await openaiProxy.makeRequest(
      apiKey,
      'audio/transcriptions',
      formData
    );

    if (!transcriptionResponse || !transcriptionResponse.text) {
      throw new Error('Failed to transcribe audio');
    }

    // Generate Markdown
    const markdown = generateMarkdown({
      title: 'Audio Transcription',
      content: transcriptionResponse.text
    });

    return markdown;
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