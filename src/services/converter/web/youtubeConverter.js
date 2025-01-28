// services/converter/web/youtubeConverter.js
import sanitizeFilename from 'sanitize-filename';
import puppeteer from 'puppeteer';
import { extractVideoId, formatTimestamp } from '../../../routes/middleware/utils/youtubeUtils.js';

/**
 * Extracts transcript and metadata from a YouTube page using Puppeteer
 * @param {puppeteer.Page} page - Puppeteer page instance
 * @returns {Promise<{transcript: Array, metadata: Object}>}
 */
async function extractTranscriptAndMetadata(page) {
  try {
    // Handle cookie consent if present
    try {
      const cookieButton = await page.$('button[aria-label*="Accept"]');
      if (cookieButton) {
        await cookieButton.click();
        await page.waitForTimeout(1000); // Wait for cookie banner to disappear
      }
    } catch (error) {
      console.log('No cookie banner found or already accepted');
    }

    // Wait for and click the "Show transcript" button
    console.log('🔍 Looking for transcript button...');
    await page.waitForSelector('ytd-video-description-transcript-section-renderer button', { timeout: 5000 });
    await page.click('ytd-video-description-transcript-section-renderer button');

    // Wait for transcript container to appear
    console.log('📝 Extracting transcript...');
    await page.waitForSelector('#segments-container', { timeout: 5000 });

    // Extract transcript entries
    const { transcript, title } = await page.evaluate(() => {
      const titleElement = document.querySelector('ytd-watch-metadata yt-formatted-string.style-scope');
      const transcriptEntries = Array.from(document.querySelectorAll('#segments-container ytd-transcript-segment-renderer'));
      
      const transcript = transcriptEntries.map(entry => {
        const timestampElement = entry.querySelector('#timestamp');
        const textElement = entry.querySelector('#text');
        
        // Parse timestamp to seconds
        const timestamp = timestampElement?.textContent || '0:00';
        const [minutes, seconds] = timestamp.split(':').map(Number);
        const startTime = minutes * 60 + (seconds || 0);

        return {
          text: textElement?.textContent?.trim() || '',
          start: startTime,
          duration: 0 // Duration not available in UI
        };
      });

      return {
        transcript,
        title: titleElement?.textContent?.trim() || 'Untitled Video'
      };
    });

    return {
      transcript,
      metadata: { title }
    };
  } catch (error) {
    console.error('Failed to extract transcript:', error);
    throw new Error(`Failed to extract transcript: ${error.message}`);
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
 * @param {string} apiKey - (Optional) API key if required
 * @returns {Promise<Object>} - The conversion result
 */
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
      console.log('🎬 Starting YouTube conversion for:', url);

      const videoId = extractVideoId(url);
      if (!videoId || videoId === 'unknown') {
        throw new Error('Invalid YouTube URL');
      }
      console.log('🎯 Extracted video ID:', videoId);

      // Launch browser
      console.log('🔍 Launching browser...');
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
      console.log('🌐 Navigating to YouTube page...');
      await page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: 30000,
      });

      // Extract transcript and metadata
      const { transcript, metadata } = await extractTranscriptAndMetadata(page);
      
      if (!transcript || transcript.length === 0) {
        throw new Error('No transcript found or transcript is empty');
      }

      console.log('✅ Extracted', transcript.length, 'transcript entries');

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
      console.error(`❌ Attempt ${retryCount + 1} failed:`, error.message);
      
      if (retryCount < maxRetries - 1) {
        console.log(`🔄 Retrying... (${retryCount + 2}/${maxRetries})`);
        retryCount++;
        // Wait before retry with exponential backoff
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 1000));
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
        console.log('🔒 Closing browser...');
        await browser.close();
      }
    }
  }
}
