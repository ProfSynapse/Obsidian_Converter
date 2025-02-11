// services/converter/web/parenturlConverter.js

import got from 'got';
import pLimit from 'p-limit';
import * as cheerio from 'cheerio';
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
    retry: {
      limit: 3,
      statusCodes: [408, 413, 429, 500, 502, 503, 504],
      methods: ['GET']
    }
  },
  http: {
    headers: {
      'accept': 'text/html,application/xhtml+xml',
      'accept-encoding': 'gzip, deflate',
      'accept-language': 'en-US,en;q=0.9',
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'cache-control': 'no-cache',
      'pragma': 'no-cache'
    },
    decompress: true
  }
};

/**
 * Class to manage URL crawling and processing
 */
class WebsiteCrawler {
  constructor() {
    this.discoveredUrls = new Set();
    this.maxDepth = CONFIG.crawler.maxDepth;
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
    try {
      const response = await got(url, {
        timeout: CONFIG.crawler.timeout,
        retry: CONFIG.crawler.retry,
        headers: CONFIG.http.headers,
        throwHttpErrors: false,
        followRedirect: true,
        maxRedirects: 10
      });

      // Get the final URL after redirects
      const finalUrl = response.url;

      if (!response.ok) {
        console.log(`❌ Failed to load: ${finalUrl} (${response.statusCode})`);
        return;
      }

      // Check if the final URL is valid for our domain
      if (!await this.isValidUrl(finalUrl, parentUrl)) {
        console.log(`⚠️ Skipping external URL after redirect: ${finalUrl}`);
        return;
      }

      // Some servers might not provide content-type header, attempt to parse HTML anyway
      const contentType = response.headers['content-type'] || '';
      const isHtml = contentType.includes('text/html') || 
                    contentType === '' || // Empty content type - try anyway
                    response.body.trim().startsWith('<!DOCTYPE html>') ||
                    response.body.trim().startsWith('<html');

      if (isHtml) {
        this.discoveredUrls.add(finalUrl);
        const links = await this.extractLinks(response.body, finalUrl);
        console.log(`✓ Processed: ${finalUrl} (${links.length} links)`);

        for (const link of links) {
          if (!visitedUrls.has(link)) {
            queue.push({ url: link, depth: depth + 1 });
          }
        }
      }

      // Log if we're skipping content
      if (!isHtml) {
        console.log(`⚠️ Skipping non-HTML content: ${finalUrl} (${contentType})`);
      }
    } catch (error) {
      console.log(`❌ Error on ${url}: ${error.message}`);
    }
  }

  async extractLinks(html, baseUrl) {
    const links = new Set();
    const $ = cheerio.load(html);

    // Get all links and process them
    const linkPromises = [];

    // Extract regular links
    $('a[href]').each((_, element) => {
      const href = $(element).attr('href');
      if (href) {
        try {
          const absoluteUrl = new URL(href, baseUrl).href;
          linkPromises.push(this.resolveRedirects(absoluteUrl));
        } catch {}
      }
    });

    // Extract canonical links
    $('link[rel="canonical"]').each((_, element) => {
      const href = $(element).attr('href');
      if (href) {
        try {
          const absoluteUrl = new URL(href, baseUrl).href;
          linkPromises.push(this.resolveRedirects(absoluteUrl));
        } catch {}
      }
    });

    // Wait for all redirects to be resolved
    const resolvedLinks = await Promise.all(linkPromises);
    resolvedLinks.forEach(link => {
      if (link) links.add(link);
    });

    return Array.from(links);
  }

  async resolveRedirects(url) {
    try {
      const response = await got.head(url, {
        followRedirect: true,
        maxRedirects: 10,
        timeout: CONFIG.crawler.timeout,
        retry: CONFIG.crawler.retry
      });
      return response.url;
    } catch {
      return null;
    }
  }

  async isValidUrl(url, parentUrl) {
    try {
      // Get final URL after redirects
      const finalUrl = await this.resolveRedirects(url);
      if (!finalUrl) return false;

      const urlObj = new URL(finalUrl);
      const parentObj = new URL(parentUrl);

      const parentDomain = parentObj.hostname.replace(/^www\./, '');
      const urlDomain = urlObj.hostname.replace(/^www\./, '');

      // Check if domains match (ignoring www.)
      if (urlDomain !== parentDomain) {
        return false;
      }

      if (CONFIG.crawler.excludePatterns.some(pattern => pattern.test(finalUrl))) {
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
  async processUrls(urls, options = {}) {
    const limit = pLimit(CONFIG.crawler.concurrentLimit);
    console.log(`\nConverting ${urls.size} pages to Markdown...\n`);

    const tasks = Array.from(urls).map(url =>
      limit(async () => {
        try {
          const result = await convertUrlToMarkdown(url, {
            ...options,
            includeImages: true,
            includeMeta: true,
            decompress: true,
            followRedirect: true,
            maxRedirects: 10,
            throwHttpErrors: false
          });

          const urlPath = new URL(url).pathname || '/';
          const name = this.sanitizeFilename(urlPath);
          console.log(`✓ Converted: ${url} -> ${name}`);
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
    const urls = await crawler.crawl(parentUrl);
    console.log(`Found ${urls.size} URLs to process`);

    if (urls.size === 0) {
      throw new AppError('No valid URLs found to convert', 400);
    }

    const processedPages = await processor.processUrls(urls, {
      decompress: true,
      followRedirect: true,
      maxRedirects: 10,
      throwHttpErrors: false
    });
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
  } catch (error) {
    console.error('Parent URL conversion failed:', error);
    throw new AppError(`Failed to convert parent URL: ${error.message}`, 500);
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
