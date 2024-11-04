// services/converter/web/parenturlConverter.js

import puppeteer from 'puppeteer';
import pLimit from 'p-limit';
import { convertUrlToMarkdown } from './urlConverter.js';

/**
 * Configuration for URL processing and crawling
 */
const CONFIG = {
  crawler: {
    maxPages: 100,
    maxDepth: 1000,
    concurrentLimit: 5,
    timeout: 30000,
    validProtocols: ['http:', 'https:'],
    excludePatterns: [
      /\.(pdf|zip|doc|docx|xls|xlsx|ppt|pptx)$/i,
      /\?(utm_|source=|campaign=)/i,
      /#.*/,
      /\/api\//,
      /\/feed\//,
      /\/rss\//
    ]
  },
  puppeteer: {
    launch: {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu'
      ]
    },
    navigation: {
      waitUntil: 'networkidle2',
      timeout: 30000
    },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  }
};

/**
 * Validates and normalizes a URL
 * @param {string} url - URL to validate
 * @returns {string} Normalized URL
 */
function normalizeUrl(url) {
  try {
    url = url.trim();
    if (!/^https?:\/\//i.test(url)) {
      url = 'https://' + url.replace(/^\/\//, '');
    }

    const urlObj = new URL(url);
    if (!CONFIG.crawler.validProtocols.includes(urlObj.protocol)) {
      throw new Error(`Invalid protocol: ${urlObj.protocol}`);
    }

    return urlObj.href;
  } catch (error) {
    throw new Error(`Invalid URL: ${error.message}`);
  }
}

/**
 * Sanitizes a string for use as a filename
 * @param {string} input - String to sanitize
 * @returns {string} Sanitized string
 */
function sanitizeFilename(input) {
  if (!input) return 'index';

  return input
    .toLowerCase()
    .replace(/^\/+|\/+$/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100) || 'index';
}

/**
 * Checks if a URL should be processed
 * @param {string} url - URL to check
 * @param {string} parenturl - Parent URL for domain checking
 * @returns {boolean} Whether URL should be processed
 */
function shouldProcessUrl(url, parenturl) {
  try {
    const urlObj = new URL(url);
    const parentObj = new URL(parenturl);

    // Must be same domain
    if (urlObj.hostname !== parentObj.hostname) return false;

    // Check against exclude patterns
    if (CONFIG.crawler.excludePatterns.some(pattern => pattern.test(url))) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Crawls a website to find all valid URLs
 * @param {string} parenturl - Starting URL
 * @returns {Promise<Set<string>>} Set of discovered URLs
 */
async function crawlWebsite(parenturl) {
  const browser = await puppeteer.launch(CONFIG.puppeteer.launch);
  const discoveredUrls = new Set();
  const processedUrls = new Set();

  try {
    const page = await browser.newPage();
    await page.setUserAgent(CONFIG.puppeteer.userAgent);

    async function processPage(url, depth) {
      if (depth > CONFIG.crawler.maxDepth) return;
      if (discoveredUrls.size >= CONFIG.crawler.maxPages) return;
      if (processedUrls.has(url)) return;

      try {
        processedUrls.add(url);
        console.log(`Processing page ${processedUrls.size}:`, url);

        const response = await page.goto(url, CONFIG.puppeteer.navigation);
        if (!response) {
          console.warn(`No response for URL: ${url}`);
          return;
        }

        // Extract and verify content type
        const contentType = response.headers()['content-type'] || '';

        if (contentType.includes('text/html') || contentType.includes('image/')) {
          discoveredUrls.add(url);
        }

        // Only continue crawling for HTML pages
        if (contentType.includes('text/html')) {
          const links = await page.evaluate(() =>
            Array.from(document.querySelectorAll('a[href]'))
              .map(a => a.href)
              .filter(Boolean)
          );

          for (const link of links) {
            if (shouldProcessUrl(link, parenturl) && !processedUrls.has(link)) {
              await processPage(link, depth + 1);
              if (discoveredUrls.size >= CONFIG.crawler.maxPages) break;
            }
          }
        }
      } catch (error) {
        console.error(`Error processing ${url}:`, error.message);
      }
    }

    await processPage(parenturl, 0);
    return discoveredUrls;

  } catch (error) {
    console.error('Error during crawling:', error);
    throw error;
  } finally {
    await browser.close();
  }
}

/**
 * Processes discovered URLs into Markdown content
 * @param {Set<string>} urls - URLs to process
 * @returns {Promise<Array>} Processed results
 */
async function processUrls(urls) {
  const limit = pLimit(CONFIG.crawler.concurrentLimit);

  const tasks = Array.from(urls).map(url =>
    limit(async () => {
      try {
        const urlObj = new URL(url);
        const name = sanitizeFilename(urlObj.pathname);

        const result = await convertUrlToMarkdown(url, name);

        return {
          success: true,
          type: 'url',
          name: `${name || 'index'}.md`,
          content: result.content,
          images: result.images || [],
          url
        };
      } catch (error) {
        console.error(`Error converting ${url}:`, error.message);
        return {
          success: false,
          type: 'url',
          url,
          error: error.message
        };
      }
    })
  );

  return await Promise.all(tasks);
}

/**
 * Generates index content for the website
 * @param {string} parenturl - Parent URL
 * @param {Array} pages - Processed pages
 * @returns {string} Index content in Markdown
 */
function generateIndex(parenturl, pages) {
  const successfulPages = pages.filter(p => p.success);
  const failedPages = pages.filter(p => !p.success);
  const hostname = new URL(parenturl).hostname;

  return [
    `---`,
    `Title: ${hostname} Archive`,
    `Description: Website archive of ${hostname}`,
    `Date: ${new Date().toISOString().split('T')[0]}`,
    `Tags:`,
    ` - "#website-archive"`,
    ` - "#${hostname.replace(/\./g, '-')}"`,
    `---`,
    '',
    `# ${hostname}`,
    '',
    '## Site Information',
    `- Source URL: ${parenturl}`,
    `- Archived: ${new Date().toISOString()}`,
    `- Total Pages: ${pages.length}`,
    `- Successful: ${successfulPages.length}`,
    `- Failed: ${failedPages.length}`,
    '',
    '## Pages',
    '',
    ...successfulPages.map(page => {
      const name = page.name.replace(/\.md$/, '');
      return `- [[${name}]]`;
    }),
    '',
    failedPages.length ? [
      '## Failed Pages',
      '',
      ...failedPages.map(page => `- ${page.url}: ${page.error}`),
      ''
    ].join('\n') : '',
    '## Notes',
    '',
    '- All images are stored in the assets folder',
    '- Internal links are preserved as wiki-links',
    '- Original URLs are preserved in page metadata'
  ].join('\n');
}

/**
 * Converts a parent URL and its children to Markdown
 * @param {string} parenturl - Parent URL to convert
 * @param {string} originalName - Original name for context
 * @returns {Promise<Object>} Conversion results
 */
export async function convertParentUrlToMarkdown(parenturl, originalName) {
  try {
    // Normalize and validate URL
    const normalizedUrl = normalizeUrl(parenturl);
    console.log(`Starting conversion of ${normalizedUrl}`);

    // Crawl website
    const urls = await crawlWebsite(normalizedUrl);

    if (urls.size === 0) {
      return {
        content: index,
        files: successfulPages.map(({ name, content }) => ({
          name: name, // Use the sanitized page name
          content: content || `# ${name}\n\nNo content available.`
        })),
        images: allImages.filter(img => img.data && img.name).map(img => ({
          name: img.name,
          data: img.data
        })),
        childUrls: Array.from(urls)
      };      
    }

    // Process discovered URLs
    const processedPages = await processUrls(urls);

    // Generate index
    const index = generateIndex(normalizedUrl, processedPages);

    // Collect successful pages and images
    const successfulPages = processedPages.filter(p => p.success);
    const allImages = successfulPages.flatMap(p => p.images || []);

    // Return with required content structure
    return {
      content: index,
      files: successfulPages.map(({ name, content }) => ({
        name: `pages/${name}`,
        content: content || `# ${name}\n\nNo content available.`
      })),
      images: allImages.filter(img => img.data && img.name).map(img => ({
        name: `assets/${img.name}`,
        data: img.data
      })),
      childUrls: Array.from(urls)
    };

  } catch (error) {
    console.error('Parent URL conversion failed:', error.message);

    return {
      content: [
        `# Conversion Error: ${parenturl}`,
        '',
        '```',
        `Error: ${error.message}`,
        '```',
        '',
        `**Time:** ${new Date().toISOString()}`,
        `**URL:** ${parenturl}`,
        `**Type:** parenturl`
      ].join('\n'),
      images: [],
      error: error.message
    };
  }
}