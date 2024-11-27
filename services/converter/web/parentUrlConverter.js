// services/converter/web/parenturlConverter.js

import puppeteer from 'puppeteer';
import pLimit from 'p-limit';
import { convertUrlToMarkdown } from './urlConverter.js';
import { AppError } from '../../../utils/errorHandler.js';

/**
 * Configuration for URL processing and crawling
 */
const CONFIG = {
  crawler: {
    maxPages: 100,
    maxDepth: 1000,
    concurrentLimit: 5,
    timeout: 300000,
    validProtocols: ['http:', 'https:'],
    excludePatterns: [
      /\.(pdf|zip|doc|docx|xls|xlsx|ppt|pptx)$/i,  // Document files
      /\?(utm_|source=|campaign=)/i,                // Tracking parameters
      /#.*/,                                        // Hash fragments
      /\/api\//,                                    // API endpoints
      /\/feed\//,                                   // RSS/Atom feeds
      /\/rss\//                                     // RSS feeds
    ],
    retryAttempts: 3,
    retryDelay: 1000
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
      timeout: 300000
    },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  }
};

/**
 * Class to manage URL crawling and processing
 */
class WebsiteCrawler {
  constructor() {
    this.browser = null;
    this.discoveredUrls = new Set();
    this.maxDepth = CONFIG.crawler.maxDepth;
  }

  /**
   * Initializes the crawler
   */
  async initialize() {
    this.browser = await puppeteer.launch(CONFIG.puppeteer.launch);
  }

  /**
   * Cleans up resources
   */
  async cleanup() {
    if (this.browser) {
      await this.browser.close();
    }
  }

  /**
   * Crawls a website starting from a parent URL
   * @param {string} startUrl - Starting URL
   * @returns {Promise<Set<string>>} Set of discovered URLs
   */
  async crawl(startUrl) {
    try {
      const queue = [{ url: startUrl, depth: 0 }];
      const visitedUrls = new Set();
      const limit = pLimit(CONFIG.crawler.concurrentLimit);
      let activeTasks = [];

      console.log(`Starting crawl of: ${startUrl}`);

      while (
        (queue.length > 0 || activeTasks.length > 0) &&
        this.discoveredUrls.size < CONFIG.crawler.maxPages
      ) {
        // Fill up active tasks from queue
        while (queue.length > 0 && activeTasks.length < CONFIG.crawler.concurrentLimit) {
          const { url, depth } = queue.shift();
          if (visitedUrls.has(url) || depth > this.maxDepth) continue;
          visitedUrls.add(url);

          const task = limit(() => this.processUrl(url, startUrl, depth, queue, visitedUrls));
          activeTasks.push(task);
        }

        if (activeTasks.length > 0) {
          // Wait for one task to complete
          await Promise.race(activeTasks).catch(error => {
            console.warn('Task error:', error.message);
          });

          // Remove completed tasks
          activeTasks = activeTasks.filter(task => task.isPending?.());
        }

        // Small delay to prevent CPU spinning
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Wait for remaining tasks
      if (activeTasks.length > 0) {
        await Promise.allSettled(activeTasks);
      }

      console.log(`\nCrawl completed - Found ${this.discoveredUrls.size} pages\n`);
      return this.discoveredUrls;
    } catch (error) {
      console.error('Crawl error:', error);
      throw error;
    }
  }

  /**
   * Processes a single URL and extracts links
   * @param {string} url - URL to process
   * @param {string} parentUrl - Parent URL for domain checking
   * @param {number} depth - Current depth
   * @param {Array} queue - Queue of URLs
   * @param {Set} visitedUrls - Set of visited URLs
   */
  async processUrl(url, parentUrl, depth, queue, visitedUrls) {
    let page;
    try {
      page = await this.browser.newPage();
      await page.setUserAgent(CONFIG.puppeteer.userAgent);

      const response = await page.goto(url, {
        ...CONFIG.puppeteer.navigation,
        waitUntil: 'domcontentloaded'
      });

      if (!response) {
        console.log(`❌ Failed to load: ${url}`);
        return;
      }

      const contentType = response.headers()['content-type'] || '';
      if (contentType.includes('text/html')) {
        this.discoveredUrls.add(url);
        await page.waitForSelector('body');
        const links = await this.extractLinks(page);
        console.log(`✓ Processed: ${url} (${links.length} links)`);

        for (const link of links) {
          if (this.isValidUrl(link, parentUrl) && !visitedUrls.has(link)) {
            queue.push({ url: link, depth: depth + 1 });
          }
        }
      }
    } catch (error) {
      console.log(`❌ Error on ${url}: ${error.message}`);
    } finally {
      if (page) await page.close().catch(() => {});
    }
  }

  /**
   * Extracts all links from the given page
   * @param {object} page - Puppeteer page instance
   * @returns {Promise<string[]>} Array of discovered URLs
   */
  async extractLinks(page) {
    return await page.evaluate(() => {
      const links = new Set();
      
      // Process regular links
      document.querySelectorAll('a[href]').forEach(a => {
        try {
          const href = new URL(a.href, window.location.origin).href;
          if (href) links.add(href);
        } catch {}
      });

      // Process canonical links
      const canonical = document.querySelector('link[rel="canonical"]');
      if (canonical && canonical.href) {
        try {
          links.add(new URL(canonical.href, window.location.origin).href);
        } catch {}
      }

      return Array.from(links);
    });
  }

  /**
   * Validates if a URL should be processed
   * @param {string} url - URL to check
   * @param {string} parentUrl - Parent URL for domain checking
   * @returns {boolean} Whether URL should be processed
   */
  isValidUrl(url, parentUrl) {
    try {
      const urlObj = new URL(url);
      const parentObj = new URL(parentUrl);

      // Must be same domain or subdomain
      if (!urlObj.hostname.endsWith(parentObj.hostname)) {
        return false;
      }

      // Check against exclude patterns
      if (CONFIG.crawler.excludePatterns.some(pattern => pattern.test(url))) {
        return false;
      }

      return true;
    } catch {
      return false;
    }
  }
}

/**
 * URL Processor class to handle conversion of discovered URLs
 */
class UrlProcessor {
  /**
   * Processes a collection of URLs into Markdown
   * @param {Set<string>} urls - URLs to process
   * @returns {Promise<Array>} Processing results
   */
  async processUrls(urls) {
    const limit = pLimit(CONFIG.crawler.concurrentLimit);
    console.log(`\nConverting ${urls.size} pages to Markdown...\n`);

    const tasks = Array.from(urls).map(url =>
      limit(async () => {
        try {
          const result = await convertUrlToMarkdown(url, {
            includeImages: true,
            includeMeta: true
          });

          const urlPath = new URL(url).pathname || '/';
          const name = this.sanitizeFilename(urlPath);
          console.log(`✓ Converted: ${url}`);
          return {
            success: true,
            name: `${name}.md`,
            content: result.content,
            images: result.images || [],
            url
          };
        } catch (error) {
          console.log(`❌ Failed to convert: ${url}`);
          return { success: false, url, error: error.message };
        }
      })
    );

    return await Promise.all(tasks);
  }

  /**
   * Sanitizes a string for use as a filename
   * @param {string} input - String to sanitize
   * @returns {string} Sanitized string
   */
  sanitizeFilename(input) {
    if (!input) return 'index';

    return input
      .toLowerCase()
      .replace(/^\/+|\/+$/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 100) || 'index';
  }

  /**
   * Generates index content for the website
   * @param {string} parentUrl - Parent URL
   * @param {Array} pages - Processed pages
   * @returns {string} Index content in Markdown
   */
  generateIndex(parentUrl, pages) {
    const successfulPages = pages.filter(p => p.success);
    const failedPages = pages.filter(p => !p.success);
    const hostname = new URL(parentUrl).hostname;

    return [
      `---`,
      `title: "${hostname} Archive"`,
      `description: "Website archive of ${hostname}"`,
      `date: "${new Date().toISOString()}"`,
      `tags:`,
      `  - website-archive`,
      `  - ${hostname.replace(/\./g, '-')}`,
      `---`,
      '',
      `# ${hostname} Website Archive`,
      '',
      '## Site Information',
      `- **Source URL:** ${parentUrl}`,
      `- **Archived:** ${new Date().toISOString()}`,
      `- **Total Pages:** ${pages.length}`,
      `- **Successful:** ${successfulPages.length}`,
      `- **Failed:** ${failedPages.length}`,
      '',
      '## Successfully Converted Pages',
      '',
      ...successfulPages.map(page => {
        const name = page.name.replace(/\.md$/, '');
        return `- [[${name}]] - [Original](${page.url})`;
      }),
      '',
      failedPages.length ? [
        '## Failed Conversions',
        '',
        ...failedPages.map(page => `- ${page.url}: ${page.error}`),
        ''
      ].join('\n') : '',
      '## Notes',
      '',
      '- All images are stored in the `assets/` folder',
      '- Internal links are preserved as wiki-links',
      '- Original URLs are preserved in page metadata',
      '- Generated with Obsidian Note Converter'
    ].join('\n');
  }
}

/**
 * Converts a parent URL and its children to Markdown
 * @param {string} parentUrl - Parent URL to convert
 * @param {string} originalName - Original name for context
 * @returns {Promise<Object>} Conversion results
 */
export async function convertParentUrlToMarkdown(parentUrl) {
  const crawler = new WebsiteCrawler();
  const processor = new UrlProcessor();

  try {
    await crawler.initialize();
    const urls = await crawler.crawl(parentUrl);

    console.log(`Found ${urls.size} URLs to process`);

    if (urls.size === 0) {
      throw new AppError('No valid URLs found to convert', 400);
    }

    const processedPages = await processor.processUrls(urls);
    const index = processor.generateIndex(parentUrl, processedPages);
    const hostname = new URL(parentUrl).hostname;

    // Collect all images across all pages
    const allImages = processedPages
      .filter(p => p.success)
      .flatMap(p => p.images || [])
      .filter(img => img && img.data && img.name)
      .map(img => ({
        name: `web/${hostname}/assets/${img.name}`,
        data: img.data,
        type: 'binary'
      }));

    return {
      url: parentUrl,
      type: 'parenturl',
      content: index,
      name: hostname,
      files: [
        {
          name: `web/${hostname}/index.md`,
          content: index,
          type: 'text'
        },
        ...processedPages
          .filter(p => p.success)
          .map(({ name, content }) => ({
            name: `web/${hostname}/pages/${name}`,
            content,
            type: 'text'
          }))
      ],
      images: allImages,
      success: true
    };
  } finally {
    await crawler.cleanup();
  }
}

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