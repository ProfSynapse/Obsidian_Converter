// services/converter/web/youtubeConverter.js
import sanitizeFilename from 'sanitize-filename';
import puppeteer from 'puppeteer';
import { extractVideoId, formatTimestamp } from '../../../routes/middleware/utils/youtubeUtils.js';

// Error types for better error handling
const YouTubeErrors = {
  NO_TRANSCRIPT: 'No transcript available',
  COOKIE_BANNER: 'Cookie banner interaction failed',
  EXPAND_BUTTON: 'Failed to expand description',
  TRANSCRIPT_BUTTON: 'Failed to find transcript button',
  EXTRACTION: 'Failed to extract transcript'
};

// Debug logging utility
const debugLog = {
  start: () => console.log('🎬 Starting YouTube conversion'),
  browser: () => console.log('🔍 Launching browser...'),
  navigation: () => console.log('🌐 Navigating to YouTube page...'),
  expand: () => console.log('📖 Expanding description...'),
  transcript: () => console.log('📝 Looking for transcript button...'),
  extraction: (count) => console.log(`✅ Extracted ${count} transcript entries`),
  error: (msg) => console.error('❌ Error:', msg),
  close: () => console.log('🔒 Closing browser...')
};

/**
 * Extracts transcript and metadata from a YouTube page using Puppeteer
 * @param {puppeteer.Page} page - Puppeteer page instance
 * @returns {Promise<{transcript: Array, metadata: Object}>}
 */
async function extractTranscriptAndMetadata(page) {
  try {
    // Step 1: Handle cookie consent if present
    try {
      await page.evaluate(() => {
        document.querySelector('button[aria-label*=cookies]')?.click();
      });
      await page.waitForTimeout(1000);
    } catch (error) {
      debugLog.error('Cookie banner handling failed, proceeding anyway');
    }

    // Step 2: Expand description
    try {
      debugLog.expand();
      await page.waitForSelector('tp-yt-paper-button#expand.button.style-scope.ytd-text-inline-expander', { timeout: 10000 });
      await page.click('tp-yt-paper-button#expand.button.style-scope.ytd-text-inline-expander');
      await page.waitForTimeout(1000);
    } catch (error) {
      debugLog.error('Description expansion failed, trying transcript anyway');
    }

    // Step 3: Click transcript button
    debugLog.transcript();
    await page.waitForSelector('div.yt-spec-touch-feedback-shape__fill', { timeout: 10000 });
    await page.click('div.yt-spec-touch-feedback-shape__fill');
    await page.waitForTimeout(1000);

    // Step 4: Wait for transcript container and extract content
    await page.waitForSelector('#segments-container', { timeout: 10000 });
    debugLog.extraction();

    // Extract transcript entries with exact selectors
    const { transcript, title } = await page.evaluate(() => {
      const titleElement = document.querySelector('ytd-watch-metadata yt-formatted-string.style-scope');
      const segments = document.querySelectorAll('#segments-container > ytd-transcript-segment-renderer');
      
      const transcript = Array.from(segments).map(segment => {
        const timestampElement = segment.querySelector('div > div > div');
        const textElement = segment.querySelector('div > yt-formatted-string');
        
        const timestamp = timestampElement?.textContent?.trim() || '0:00';
        const [minutes, seconds] = timestamp.split(':').map(Number);
        const startTime = minutes * 60 + (seconds || 0);

        return {
          text: textElement?.textContent?.trim() || '',
          start: startTime,
          duration: 0
        };
      });

      return {
        transcript,
        title: titleElement?.textContent?.trim() || 'Untitled Video'
      };
    });

    // Validate transcript data
    if (!transcript || transcript.length === 0) {
      throw new Error(YouTubeErrors.NO_TRANSCRIPT);
    }

    debugLog.extraction(transcript.length);
    return {
      transcript,
      metadata: { title }
    };
  } catch (error) {
    debugLog.error(`Transcript extraction failed: ${error.message}`);
    throw new Error(error.message);
  }
}

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
 * @returns {Promise<Object>} - The conversion result
 */
export async function convertYoutubeToMarkdown(url) {
  let browser;
  let retryCount = 0;
  const maxRetries = 3;

  while (retryCount < maxRetries) {
    try {
      debugLog.start();

      const videoId = extractVideoId(url);
      if (!videoId || videoId === 'unknown') {
        throw new Error('Invalid YouTube URL');
      }
      console.log('🎯 Extracted video ID:', videoId);

      // Launch browser
      debugLog.browser();
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
      
      // Navigate to the video page
      debugLog.navigation();
      await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });

      // Extract transcript and metadata
      const { transcript, metadata } = await extractTranscriptAndMetadata(page);

      // Generate markdown
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
      debugLog.error(`Attempt ${retryCount + 1}/${maxRetries} failed: ${error.message}`);
      
      if (retryCount < maxRetries - 1) {
        const waitTime = Math.pow(2, retryCount) * 1000;
        console.log(`🔄 Retrying in ${waitTime/1000}s...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        retryCount++;
        continue;
      }

      return {
        success: false,
        type: 'youtube',
        name: 'youtube_video',
        error: error.message,
        images: [],
      };
    } finally {
      if (browser) {
        debugLog.close();
        await browser.close();
      }
    }
  }
}
