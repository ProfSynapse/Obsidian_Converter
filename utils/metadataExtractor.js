// utils/metadataExtractor.js

import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

/**
 * Extracts metadata from a given URL.
 * @param {string} url - The URL to extract metadata from.
 * @returns {Promise<string>} - The formatted metadata in Markdown.
 * @throws {Error} - If fetching or parsing fails.
 */
export async function extractMetadata(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch URL for metadata: ${response.status} ${response.statusText}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    const title = $('title').text().trim() || new URL(url).hostname;
    const description = $('meta[name="description"]').attr('content') || '';
    const author = $('meta[name="author"]').attr('content') || '';
    const keywords = $('meta[name="keywords"]').attr('content') || '';

    const metadataLines = [
      `# ${title}`,
      '',
      description ? `> ${description}` : '',
      '',
      '## Metadata',
      '',
      `- **Source:** [${url}](${url})`,
      `- **Captured:** ${new Date().toISOString()}`,
      author ? `- **Author:** ${author}` : '',
      keywords ? `- **Keywords:** ${keywords}` : '',
      '',
      '---',
      ''
    ];

    return metadataLines.filter(Boolean).join('\n');
  } catch (error) {
    throw new Error(`Failed to extract metadata: ${error.message}`);
  }
}
