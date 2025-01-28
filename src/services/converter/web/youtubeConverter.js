// services/converter/web/youtubeConverter.js
import sanitizeFilename from 'sanitize-filename';
import puppeteer from 'puppeteer';
import { YoutubeTranscript } from 'youtube-transcript'; // Ensure this package is installed
import { extractVideoId, formatTimestamp, extractYoutubeMetadata } from '../../../routes/middleware/utils/youtubeUtils.js';

/**
 * Generates markdown content with transcript and title
 * @param {string} url - The YouTube video URL
 * @param {string} videoId - The extracted video ID
 * @param {Array} transcript - The transcript array
 * @param {Object} metadata - The extracted metadata
 * @returns {string} - The generated markdown content
 */
function generateMarkdown(url, videoId, transcript, metadata) {
  const frontmatter = `---
title: "${metadata.title.replace(/"/g, '\\"')}"
url: "${url}"
videoId: "${videoId}"
date: "${new Date().toISOString()}"
tags: 
 - youtube
 - video
 - transcript
---

`;

  const videoEmbed = `<iframe width="560" height="315" src="https://www.youtube.com/embed/${videoId}" frameborder="0" allowfullscreen></iframe>\n\n`;

  const transcriptMarkdown = transcript
    .map(
      (entry) =>
        `**[${formatTimestamp(entry.offset)}]** ${entry.text.replace(/\n/g, ' ').trim()}\n`
    )
    .join('\n');

  return `${frontmatter}${videoEmbed}# Transcript\n\n${transcriptMarkdown}`;
}

/**
 * YouTube to Markdown Converter
 * @param {string} url - The YouTube video URL
 * @param {string} apiKey - (Optional) API key if required
 * @returns {Promise<Object>} - The conversion result
 */
export async function convertYoutubeToMarkdown(url, apiKey) {
  let browser;
  try {
    console.log('Starting YouTube conversion for:', url);

    const videoId = extractVideoId(url);
    if (!videoId || videoId === 'unknown') {
      throw new Error('Invalid YouTube URL');
    }
    console.log('Extracted video ID:', videoId);

    console.log('Launching browser...');
    browser = await puppeteer.launch({
      headless: true, // Set to false for debugging
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
      ],
      defaultViewport: { width: 1280, height: 800 },
    });

    const page = await browser.newPage();
    console.log('Navigating to YouTube page...');
    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 300000,
    });

    console.log('Extracting metadata...');
    const metadata = await extractYoutubeMetadata(page);
    console.log('Metadata extracted:', {
      title: metadata.title,
    });

    // Fetch transcript
    console.log('🎯 Attempting to fetch transcript for video:', videoId);
    let transcript = [];
    try {
      transcript = await YoutubeTranscript.fetchTranscript(videoId);
      console.log('✅ Transcript successfully fetched with', transcript.length, 'entries');
      
      if (transcript.length === 0) {
        console.warn('⚠️ Transcript was fetched but contains no entries');
      }
    } catch (transcriptError) {
      // Log detailed error information
      console.warn('❌ Failed to fetch transcript:', {
        error: transcriptError.message,
        videoId,
        url
      });
      
      // Handle specific error cases
      if (transcriptError.message.includes('Could not retrieve a transcript')) {
        transcript = [{ offset: 0, text: '**Note:** No transcript is available for this video. This could be because:\n- Captions are disabled\n- Auto-generated captions are not available\n- The video is not publicly accessible' }];
      } else if (transcriptError.message.includes('Invalid')) {
        throw new Error(`Invalid YouTube video ID or URL: ${videoId}`);
      } else {
        console.error('Unexpected transcript error:', transcriptError);
        transcript = [{ offset: 0, text: '**Note:** Unable to retrieve transcript due to a technical error. Please try again later.' }];
      }
    }

    console.log('Generating markdown...');
    const markdownContent = generateMarkdown(url, videoId, transcript, metadata);

    return {
      success: true,
      type: 'youtube',
      category: 'web',
      name: sanitizeFilename(metadata.title),
      content: markdownContent,
      images: [],
      files: [],
      originalUrl: url,
    };
  } catch (error) {
    console.error('YouTube conversion failed:', error);
    return {
      success: false,
      type: 'youtube',
      name: 'youtube_video',
      error: error.message,
      images: [],
    };
  } finally {
    if (browser) {
      console.log('Closing browser...');
      await browser.close();
    }
  }
}
