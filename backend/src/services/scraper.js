// backend/src/services/scraper.js

import { YoutubeTranscript } from 'youtube-transcript';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { loadPromptsConfig } from '../utils/promptLoader.js';
import logger from '../utils/logger.js';

// Use Stealth Plugin to evade detection
puppeteer.use(StealthPlugin());

/**
 * @file scraper.js
 * @description Service for scraping website text and YouTube transcripts.
 */

/**
 * Determines if a URL is a YouTube video.
 * @param {string} url - The URL to check.
 * @returns {boolean} - True if YouTube URL, else false.
 */
function isYouTubeURL(url) {
  const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/;
  return youtubeRegex.test(url);
}

/**
 * Scrapes the transcript of a YouTube video using the YouTube Transcript API.
 * @param {string} url - The YouTube video URL.
 * @returns {Promise<string>} - The transcribed text.
 */
export async function scrapeYouTubeTranscript(url) {
  try {
    logger.info(`Scraping YouTube transcript for URL: ${url}`);
    const transcript = await YoutubeTranscript.fetchTranscript(url);
    const transcriptText = transcript.map(item => item.text).join('\n');
    logger.info('YouTube transcript scraped successfully');
    return transcriptText;
  } catch (error) {
    logger.error(`Error fetching YouTube transcript: ${error.message}`);
    return `Error: Unable to fetch YouTube transcript. ${error.message}`;
  }
}

/**
 * Scrapes text content from a given website URL using Puppeteer.
 * @param {string} url - The website URL to scrape.
 * @returns {Promise<string>} - The scraped text content.
 */
export async function scrapeWebsiteText(url) {
  let browser;
  try {
    logger.info(`Starting website scraping for URL: ${url}`);
    browser = await puppeteer.launch({
      headless: true, // Set to false if you want to see the browser action
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
    });
    const page = await browser.newPage();

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

    // Extract the main content
    const content = await page.evaluate(() => {
      // Remove script and style elements
      const scripts = document.getElementsByTagName('script');
      const styles = document.getElementsByTagName('style');
      Array.from(scripts).forEach(script => script.remove());
      Array.from(styles).forEach(style => style.remove());

      // Get the main content
      const main = document.querySelector('main') || document.querySelector('article') || document.body;

      // Extract text from paragraphs and headings
      const textElements = main.querySelectorAll('p, h1, h2, h3, h4, h5, h6');
      return Array.from(textElements)
        .map(el => el.textContent.trim())
        .filter(text => text.length > 0)
        .join('\n\n');
    });

    logger.info('Website text scraped successfully');
    return content;
  } catch (error) {
    logger.error(`Error scraping website text: ${error.message}`);
    return `Error: Unable to scrape website text. ${error.message}`;
  } finally {
    if (browser) await browser.close();
    logger.info('Browser instance closed');
  }
}

/**
 * Scrapes content based on the provided URL.
 * - If YouTube URL: Fetch transcript.
 * - Else: Scrape website text.
 * @param {string} url - The URL to scrape.
 * @returns {Promise<string>} - The scraped or transcribed text.
 */
export async function scrapeContent(url) {
  if (isYouTubeURL(url)) {
    return await scrapeYouTubeTranscript(url);
  } else {
    return await scrapeWebsiteText(url);
  }
}