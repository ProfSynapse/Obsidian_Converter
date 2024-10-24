// services/converter/web/youtubeConverter.js

import { YoutubeTranscript } from 'youtube-transcript';
import fetch from 'node-fetch';

export async function convertYoutubeToMarkdown(url) {
  try {
    const videoId = extractVideoId(url);
    if (!videoId) {
      throw new Error('Invalid YouTube URL');
    }

    // Fetch video metadata
    const metadata = await fetchVideoMetadata(videoId);

    // Fetch transcript
    const transcript = await YoutubeTranscript.fetchTranscript(videoId);

    // Generate Markdown
    let markdown = `# ${metadata.title}\n\n`;
    markdown += `**Link:** [${url}](${url})\n\n`;
    markdown += `**Description:** ${metadata.description}\n\n`;
    markdown += `**Published:** ${metadata.publishedAt}\n\n`;
    markdown += `## Transcript\n\n`;

    transcript.forEach((entry, index) => {
      const timestamp = formatTimestamp(entry.offset);
      markdown += `**[${timestamp}]** ${entry.text}\n\n`;
    });

    return markdown;
  } catch (error) {
    console.error('Error converting YouTube video to Markdown:', error);
    throw error;
  }
}

function extractVideoId(url) {
  const regex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com|youtu\.be)\/(?:watch\?v=)?(.+)/;
  const match = url.match(regex);
  return match ? match[1] : null;
}

async function fetchVideoMetadata(videoId) {
  // Note: This is a placeholder. You would typically use the YouTube Data API here.
  // For demonstration, we're returning mock data.
  return {
    title: 'Sample YouTube Video',
    description: 'This is a sample description for the video.',
    publishedAt: new Date().toISOString()
  };
}

function formatTimestamp(milliseconds) {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  return `${hours.toString().padStart(2, '0')}:${(minutes % 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
}