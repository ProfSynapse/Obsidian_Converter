// services/converter/web/urlConverter.js

import puppeteer from 'puppeteer';
import TurndownService from 'turndown';
import * as cheerio from 'cheerio';
import path from 'path';

/**
 * Converts a general URL to Markdown format, extracting content and images.
 * @param {string} input - The URL to convert.
 * @param {string} originalName - Original identifier, typically the URL.
 * @param {string} [apiKey] - API key if needed.
 * @returns {Promise<{ content: string, images: Array }>} - Converted content and images.
 */
export async function convertUrlToMarkdown(input, originalName, apiKey) {
  let browser;
  try {
    if (typeof input !== 'string' || !input.startsWith('http')) {
      throw new Error('Invalid URL provided.');
    }

    browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    // Navigate to the URL
    await page.goto(input, { waitUntil: 'networkidle2' });

    // Extract page content
    const content = await page.content();

    // Load content into Cheerio for parsing
    const $ = cheerio.load(content);

    // Extract images
    const images = [];
    $('img').each((index, img) => {
      const src = $(img).attr('src');
      const alt = $(img).attr('alt') || `Image ${index + 1}`;
      if (src) {
        // Handle base64 images or external URLs
        if (src.startsWith('data:')) {
          const matches = src.match(/^data:(image\/[a-zA-Z]+);base64,(.+)$/);
          if (matches) {
            const imageType = matches[1].split('/')[1];
            const imageData = matches[2];
            const imageName = `image-${index + 1}.${imageType}`;
            images.push({
              name: imageName,
              data: imageData,
              type: `image/${imageType}`,
              path: `attachments/${path.basename(originalName, path.extname(originalName))}/${imageName}`
            });

            // Replace src with new path
            $(img).attr('src', `attachments/${path.basename(originalName, path.extname(originalName))}/${imageName}`);
          }
        } else {
          // For external URLs, you might want to download and include them
          // This implementation assumes images are to be handled externally
          images.push({
            name: path.basename(src),
            data: '', // Placeholder if you plan to download images
            type: '', // Placeholder for image type
            path: src // External path
          });
        }
      }
    });

    // Get modified HTML with updated image paths
    const modifiedHtml = $.html();

    // Initialize TurndownService
    const turndownService = new TurndownService({
      headingStyle: 'atx',
      codeBlockStyle: 'fenced',
      emDelimiter: '_',
      strongDelimiter: '**'
    });

    // Add custom rules if needed
    turndownService.addRule('strikethrough', {
      filter: ['del', 's', 'strike'],
      replacement: function(content) {
        return '~~' + content + '~~';
      }
    });

    // Convert HTML to Markdown
    let markdownContent = turndownService.turndown(modifiedHtml);

    // Extract title
    const pageTitle = $('title').text() || path.basename(input);

    // Add metadata
    const metadataMarkdown = `# ${pageTitle}\n\n` +
                             `**Source:** [${input}](${input})\n\n`;

    // Combine metadata and content
    const fullMarkdown = metadataMarkdown + markdownContent;

    return {
      content: fullMarkdown,
      images: images
    };
  } catch (error) {
    console.error('Error converting URL to Markdown:', error);
    throw error;
  } finally {
    if (browser) await browser.close();
  }
}
