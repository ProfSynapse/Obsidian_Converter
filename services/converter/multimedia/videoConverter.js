// services/converter/multimedia/videoConverter.js

import { transcriber } from '../transcriber.js';
import { generateMarkdown } from '../../utils/markdownGenerator.js';

export async function convertVideoToMarkdown(filePath, apiKey) {
  try {
    // Transcribe video to text
    const transcription = await transcriber.transcribe(filePath, apiKey);

    // Generate Markdown
    const markdown = generateMarkdown({
      title: `Video Transcription: ${path.basename(filePath)}`,
      content: transcription,
    });

    return markdown;
  } catch (error) {
    console.error('Error converting video to Markdown:', error);
    throw error;
  }
}
