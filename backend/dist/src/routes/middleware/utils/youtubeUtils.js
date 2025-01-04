// routes/utils/youtubeUtils.js

/**
 * Extracts YouTube Video ID from URL
 * @param {string} url - The YouTube video URL
 * @returns {string} - The extracted video ID or 'unknown' if not found
 */
export function extractVideoId(url) {
  const regex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
  const match = url.match(regex);
  return match ? match[1] : 'unknown';
}

/**
 * Formats timestamp from seconds to HH:MM:SS
 * @param {number} seconds - The time in seconds
 * @returns {string} - Formatted timestamp
 */
export function formatTimestamp(seconds) {
  const date = new Date(0);
  date.setSeconds(seconds);
  return date.toISOString().substr(11, 8);
}

/**
 * Extracts YouTube video metadata (only title) using Puppeteer
 * @param {puppeteer.Page} page - The Puppeteer page instance
 * @returns {Promise<{ title: string }>} - The extracted metadata
 */

export async function extractYoutubeMetadata(page) {
  try {
    console.log('Waiting for YouTube title element...');

    // Updated selector based on the new DOM structure
    await page.waitForSelector('ytd-watch-metadata yt-formatted-string.style-scope', {
      timeout: 300000,
      visible: true
    });

    // Extract the title using Puppeteer
    const metadata = await page.evaluate(() => {
      // Adjust the selector if needed
      const titleElement = document.querySelector('ytd-watch-metadata yt-formatted-string.style-scope');
      const title = titleElement ? titleElement.textContent.trim() : 'Untitled Video';
      return {
        title
      };
    });
    console.log('Extracted metadata:', {
      titleLength: metadata.title.length
    });
    return metadata;
  } catch (error) {
    console.error('Failed to extract metadata:', error);
    return {
      title: 'Untitled Video'
    };
  }
}