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
        while (queue.length > 0 && activeTasks.length < CONFIG.crawler.concurrentLimit) {
          const { url, depth } = queue.shift();
          if (visitedUrls.has(url) || depth > this.maxDepth) continue;
          visitedUrls.add(url);

          const task = limit(() => this.processUrl(url, startUrl, depth, queue, visitedUrls));
          activeTasks.push(task);
        }

        if (activeTasks.length > 0) {
          await Promise.race(activeTasks).catch(error => {
            console.warn('Task error:', error.message);
          });
          activeTasks = activeTasks.filter(task => task.isPending?.());
        }

        await new Promise(resolve => setTimeout(resolve, 100));
      }

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

  async extractLinks(page) {
    return await page.evaluate(() => {
      const links = new Set();
      
      document.querySelectorAll('a[href]').forEach(a => {
        try {
          const href = new URL(a.href, window.location.origin).href;
          if (href) links.add(href);
        } catch {}
      });

      const canonical = document.querySelector('link[rel="canonical"]');
      if (canonical && canonical.href) {
        try {
          links.add(new URL(canonical.href, window.location.origin).href);
        } catch {}
      }

      return Array.from(links);
    });
  }

  isValidUrl(url, parentUrl) {
    try {
      const urlObj = new URL(url);
      const parentObj = new URL(parentUrl);

      if (!urlObj.hostname.endsWith(parentObj.hostname)) {
        return false;
      }

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
            url,
            metadata: result.metadata
          };
        } catch (error) {
          console.log(`❌ Failed to convert: ${url}`);
          return { success: false, url, error: error.message };
        }
      })
    );

    return await Promise.all(tasks);
  }

  sanitizeFilename(input) {
    if (!input) return 'index';

    return input
      .toLowerCase()
      .replace(/^\/+|\/+$/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 100) || 'index';
  }

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
        return `- [[pages/${name}|${name}]] - [Original](${page.url})`;
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
      '- Images use Obsidian format: ![[image.jpg]]',
      '- Generated with Obsidian Note Converter'
    ].join('\n');
  }
}

/**
 * Converts a parent URL and its children to Markdown
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
    const hostname = new URL(parentUrl).hostname;

    // Process and deduplicate images
    const seenImageUrls = new Set();
    const allImages = processedPages
      .filter(p => p.success)
      .flatMap(p => p.images || [])
      .filter(img => {
        if (!img?.data || !img?.name || seenImageUrls.has(img.url)) {
          return false;
        }
        seenImageUrls.add(img.url);
        return true;
      })
      .map(img => ({
        name: `web/${hostname}/assets/${img.name.split('/').pop()}`,
        data: img.data,
        type: 'binary',
        metadata: img.metadata
      }));

    const index = processor.generateIndex(parentUrl, processedPages);

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
            // Replace image references to use relative paths
            content: content.replace(/!\[\[(.*?)\]\]/g, `![[../assets/$1]]`),
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
