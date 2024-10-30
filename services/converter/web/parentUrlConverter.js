// services/converter/web/parentUrlConverter.js

import puppeteer from 'puppeteer';
import TurndownService from 'turndown';
import * as cheerio from 'cheerio';
import path from 'path';
import { convertUrlToMarkdown } from './urlConverter.js';

/**
 * Configuration object for puppeteer
 */
const PUPPETEER_CONFIG = {
  headless: true,
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-accelerated-2d-canvas',
    '--disable-gpu'
  ],
  defaultViewport: { width: 1920, height: 1080 }
};

/**
 * URL processing configuration
 */
const URL_CONFIG = {
  timeout: 30000,
  concurrentLimit: 5,
  validProtocols: ['http:', 'https:']
};

/**
 * Validates and normalizes a URL string
 * @param {string} url - The URL to validate
 * @returns {string} - Normalized URL
 * @throws {Error} - If URL is invalid
 */
function validateAndNormalizeUrl(url) {
  try {
    // Remove leading/trailing whitespace
    url = url.trim();
    
    // Add https:// if no protocol specified
    if (!/^https?:\/\//i.test(url)) {
      url = 'https://' + url.replace(/^\/\//, '');
    }
    
    const urlObj = new URL(url);
    if (!URL_CONFIG.validProtocols.includes(urlObj.protocol)) {
      throw new Error(`Invalid protocol: ${urlObj.protocol}`);
    }
    
    return urlObj.href;
  } catch (error) {
    throw new Error(`Invalid URL format: ${error.message}`);
  }
}

/**
 * Scrapes all child URLs under a given Parent URL
 * @param {string} parentUrl - The Parent URL to scrape
 * @returns {Promise<Set<string>>} - Set of unique child URLs
 */
async function scrapeChildUrls(parentUrl) {
  const browser = await puppeteer.launch(PUPPETEER_CONFIG);
  const processedUrls = new Set();
  const pendingUrls = new Set([parentUrl]);
  const links = new Set();

  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');

    while (pendingUrls.size > 0) {
      const currentUrl = pendingUrls.values().next().value;
      pendingUrls.delete(currentUrl);

      if (processedUrls.has(currentUrl)) {
        continue;
      }

      try {
        console.log(`Processing URL: ${currentUrl}`);
        await page.goto(currentUrl, { 
          waitUntil: 'networkidle2',
          timeout: URL_CONFIG.timeout
        });

        const content = await page.content();
        const $ = cheerio.load(content);
        const parentUrlObj = new URL(parentUrl);
        const currentUrlObj = new URL(currentUrl);

        $('a[href]').each((_, element) => {
          const href = $(element).attr('href');
          if (!href) return;

          try {
            let fullUrl = href.startsWith('http') ? href : new URL(href, currentUrl).href;
            const urlObj = new URL(fullUrl);

            // Only include URLs from the same domain
            if (urlObj.hostname === parentUrlObj.hostname) {
              const normalizedUrl = validateAndNormalizeUrl(fullUrl);
              links.add(normalizedUrl);
              
              // Add to pending if not processed
              if (!processedUrls.has(normalizedUrl)) {
                pendingUrls.add(normalizedUrl);
              }
            }
          } catch (error) {
            console.warn(`Invalid URL encountered: ${href}`, error);
          }
        });

        processedUrls.add(currentUrl);
      } catch (error) {
        console.error(`Error processing URL ${currentUrl}:`, error);
        // Continue with other URLs even if one fails
        processedUrls.add(currentUrl);
      }
    }

    console.log(`Found ${links.size} unique URLs under ${parentUrl}`);
    return links;

  } catch (error) {
    console.error(`Error in scrapeChildUrls for ${parentUrl}:`, error);
    throw error;
  } finally {
    await browser.close();
  }
}

/**
 * Processes URLs in chunks to prevent memory issues
 * @param {Array<string>} urls - Array of URLs to process
 * @param {number} chunkSize - Size of each chunk
 * @param {function} processor - Async function to process each URL
 * @returns {Promise<Array>} - Array of processed results
 */
async function processUrlsInChunks(urls, chunkSize, processor) {
  const results = [];
  const chunks = Array.from({ length: Math.ceil(urls.length / chunkSize) }, (_, i) =>
    urls.slice(i * chunkSize, (i + 1) * chunkSize)
  );

  for (const [index, chunk] of chunks.entries()) {
    console.log(`Processing chunk ${index + 1} of ${chunks.length}`);
    const chunkResults = await Promise.all(
      chunk.map(url => processor(url).catch(error => ({ error, url })))
    );
    results.push(...chunkResults);
  }

  return results;
}

/**
 * Converts a Parent URL to Markdown by scraping all child URLs
 * @param {string} parentUrl - The Parent URL to convert
 * @param {string} originalName - Original identifier for the Parent URL
 * @param {string} [apiKey] - API key for services that require authentication
 * @returns {Promise<{ content: string, images: Array }>} - Aggregated content and images
 */
export async function convertParentUrlToMarkdown(parentUrl, originalName, apiKey) {
  try {
    // Validate and normalize parent URL
    const normalizedParentUrl = validateAndNormalizeUrl(parentUrl);
    console.log(`Starting Parent URL conversion for: ${normalizedParentUrl}`);

    // Scrape child URLs
    const childUrls = await scrapeChildUrls(normalizedParentUrl);
    if (childUrls.size === 0) {
      throw new Error('No URLs found under the specified Parent URL');
    }

    // Initialize aggregated content
    let aggregatedContent = `# Website Conversion: ${normalizedParentUrl}\n\n`;
    aggregatedContent += `Converted on: ${new Date().toISOString()}\n\n`;
    const aggregatedImages = [];

    // Process URLs in chunks
    const results = await processUrlsInChunks(
      Array.from(childUrls),
      URL_CONFIG.concurrentLimit,
      async (url) => {
        try {
          const urlObj = new URL(url);
          const { content, images } = await convertUrlToMarkdown(
            { url, name: urlObj.pathname || urlObj.hostname },
            apiKey
          );
          return { success: true, url, content, images };
        } catch (error) {
          return { success: false, url, error: error.message };
        }
      }
    );

    // Aggregate results
    for (const result of results) {
      aggregatedContent += `\n\n## ${result.url}\n\n`;
      if (result.success) {
        aggregatedContent += result.content;
        if (result.images?.length > 0) {
          aggregatedImages.push(...result.images);
        }
      } else {
        aggregatedContent += `**Error:** ${result.error}\n\n`;
      }
    }

    // Add summary section
    const successCount = results.filter(r => r.success).length;
    aggregatedContent += `\n\n## Summary\n\n`;
    aggregatedContent += `- Total URLs processed: ${results.length}\n`;
    aggregatedContent += `- Successfully converted: ${successCount}\n`;
    aggregatedContent += `- Failed conversions: ${results.length - successCount}\n`;
    aggregatedContent += `- Total images extracted: ${aggregatedImages.length}\n`;

    console.log('Parent URL conversion completed successfully');

    return {
      content: aggregatedContent,
      images: aggregatedImages,
      stats: {
        totalUrls: results.length,
        successCount,
        failureCount: results.length - successCount,
        imageCount: aggregatedImages.length
      }
    };

  } catch (error) {
    console.error('Error converting Parent URL to Markdown:', error);
    throw error;
  }
}