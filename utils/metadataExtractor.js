// utils/metadataExtractor.js

import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

/**
 * Extracts metadata from a given URL.
 * @param {string} url - The URL to extract metadata from.
 * @returns {Promise<string>} - The formatted metadata in Markdown.
 * @throws {Error} - If fetching or parsing fails.
 */
// In utils/metadataExtractor.js
export async function extractMetadata(url) {
  try {
      const response = await fetch(url);
      if (!response.ok) {
          throw new Error(`Failed to fetch URL: ${response.status}`);
      }

      const html = await response.text();
      const $ = cheerio.load(html);

      return {
          title: $('title').text().trim() || new URL(url).hostname,
          description: $('meta[name="description"]').attr('content') || '',
          source: url,
          captured: new Date().toISOString()
      };
  } catch (error) {
      console.error('Metadata extraction error:', error);
      // Return basic metadata even if extraction fails
      return {
          title: new URL(url).hostname,
          source: url,
          captured: new Date().toISOString()
      };
  }
}
