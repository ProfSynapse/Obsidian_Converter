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
    timeout: 30000,
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
      timeout: 30000
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
    this.page = null;
    this.discoveredUrls = new Set();
    this.processedUrls = new Set();
    this.urlQueue = [];
  }

  /**
   * Initializes the crawler
   */
  async initialize() {
    this.browser = await puppeteer.launch(CONFIG.puppeteer.launch);
    this.page = await this.browser.newPage();
    await this.page.setUserAgent(CONFIG.puppeteer.userAgent);
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
   * Processes a single URL and extracts links
   * @param {string} url - URL to process
   * @param {string} parentUrl - Original parent URL for domain checking
   */
  async processUrl(url, parentUrl) {
    if (this.processedUrls.has(url)) return;
    
    try {
      this.processedUrls.add(url);
      console.log(`Processing page ${this.processedUrls.size}:`, url);

      const response = await this.page.goto(url, CONFIG.puppeteer.navigation);
      if (!response) {
        console.warn(`No response for URL: ${url}`);
        return;
      }

      const contentType = response.headers()['content-type'] || '';

      // Add URLs based on content type
      if (contentType.includes('text/html') || contentType.includes('image/')) {
        this.discoveredUrls.add(url);
      }

      // Only extract links from HTML pages
      if (contentType.includes('text/html')) {
        const links = await this.extractLinks();
        
        // Add valid links to the queue
        for (const link of links) {
          if (this.isValidUrl(link, parentUrl) && !this.processedUrls.has(link)) {
            this.urlQueue.push(link);
          }
        }
      }
    } catch (error) {
      console.error(`Error processing ${url}:`, error);
      // Don't rethrow to continue processing other URLs
    }
  }

  /**
   * Extracts all links from the current page
   * @returns {Promise<string[]>} Array of discovered URLs
   */
  async extractLinks() {
    return await this.page.evaluate(() => {
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

      // Check domain - include subdomains of the parent domain
      const parentDomain = parentObj.hostname.split('.');
      const urlDomain = urlObj.hostname.split('.');
      
      // Match either exact domain or subdomains
      const isSubdomain = urlDomain.slice(-parentDomain.length).join('.') === parentDomain.join('.');
      if (!isSubdomain) return false;

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
   * Crawls a website starting from a parent URL
   * @param {string} parentUrl - Starting URL
   * @returns {Promise<Set<string>>} Set of discovered URLs
   */
  async crawl(parentUrl) {
    this.urlQueue = [parentUrl];

    while (this.urlQueue.length > 0 && this.discoveredUrls.size < CONFIG.crawler.maxPages) {
      const url = this.urlQueue.shift();
      await this.processUrl(url, parentUrl);
    }

    return this.discoveredUrls;
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

    const tasks = Array.from(urls).map(url =>
      limit(async () => {
        try {
          const urlObj = new URL(url);
          const name = this.sanitizeFilename(urlObj.pathname);

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
          console.error(`Error converting ${url}:`, error);
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
export async function convertParentUrlToMarkdown(parentUrl, originalName) {
  const crawler = new WebsiteCrawler();
  const processor = new UrlProcessor();

  try {
    // Normalize URL
    const normalizedUrl = normalizeUrl(parentUrl);
    console.log(`Starting conversion of ${normalizedUrl}`);

    // Initialize and crawl
    await crawler.initialize();
    const urls = await crawler.crawl(normalizedUrl);

    console.log(`Found ${urls.size} URLs to process`);

    if (urls.size === 0) {
      throw new AppError('No valid URLs found to convert', 400);
    }

    // Process discovered URLs
    const processedPages = await processor.processUrls(urls);

    // Generate index
    const index = processor.generateIndex(normalizedUrl, processedPages);

    // Collect successful pages and images
    const successfulPages = processedPages.filter(p => p.success);
    const allImages = successfulPages.flatMap(p => p.images || []);

    // Return results
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
    console.error('Parent URL conversion failed:', error);
    throw new AppError(
      `Parent URL conversion failed: ${error.message}`,
      error.status || 500
    );
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