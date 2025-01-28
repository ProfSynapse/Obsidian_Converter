// services/converter/web/youtubeConverter.js
import sanitizeFilename from 'sanitize-filename';
import puppeteer from 'puppeteer';
import { YoutubeTranscript } from 'youtube-transcript';
import { extractVideoId, formatTimestamp, extractYoutubeMetadata } from '../../../routes/middleware/utils/youtubeUtils.js';
import { configureTorProxy, withTorRetry } from '../../../utils/proxyAgent.js';

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
    .map(entry => {
      const timestamp = entry.start ? formatTimestamp(Math.floor(parseFloat(entry.start))) : '00:00:00';
      return `**[${timestamp}]** ${entry.text.replace(/\n/g, ' ').trim()}\n`;
    })
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
    console.log('🎬 Starting YouTube conversion for:', url);

    const videoId = extractVideoId(url);
    if (!videoId || videoId === 'unknown') {
      throw new Error('Invalid YouTube URL');
    }
    console.log('🎯 Extracted video ID:', videoId);

    // Configure Tor proxy
    console.log('🧅 Setting up Tor proxy...');
    const { agent } = configureTorProxy();

    // Fetch transcript using Tor proxy with retry logic
    console.log('📝 Fetching transcript through Tor...');
    let transcript;
    try {
      transcript = await withTorRetry(async () => {
        const result = await YoutubeTranscript.fetchTranscript(videoId, {
          requestOptions: { agent }
        });
        
        if (!result || !Array.isArray(result)) {
          throw new Error('Invalid transcript response');
        }
        
        return result;
      });

      console.log('✅ Transcript fetched successfully with', transcript.length, 'entries');

      // Convert the transcript entries to our format
      transcript = transcript.map(entry => ({
        text: entry.text,
        start: entry.offset / 1000, // Convert ms to seconds
        duration: entry.duration
      }));
    } catch (error) {
      throw new Error(`Failed to fetch transcript through Tor: ${error.message}`);
    }

    // Only try to get metadata if we successfully got a transcript
    let metadata = { title: 'Untitled Video' };
    try {
      console.log('🔍 Launching browser for metadata...');
      browser = await puppeteer.launch({
        headless: true,
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
      console.log('🌐 Navigating to YouTube page...');
      await page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: 300000,
      });

      console.log('📊 Extracting metadata...');
      metadata = await extractYoutubeMetadata(page);
      console.log('✅ Metadata extracted:', {
        title: metadata.title,
      });
    } catch (metadataError) {
      console.warn('⚠️ Failed to fetch metadata:', metadataError.message);
      // Continue with default metadata if extraction fails
    }

    console.log('📝 Generating markdown...');
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
    console.error('❌ YouTube conversion failed:', error);
    return {
      success: false,
      type: 'youtube',
      name: 'youtube_video',
      error: error.message,
      images: [],
    };
  } finally {
    if (browser) {
      console.log('🔒 Closing browser...');
      await browser.close();
    }
  }
}
