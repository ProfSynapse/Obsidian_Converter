// services/converter/web/parentUrlConverter.js

import got from 'got';
import pLimit from 'p-limit';
import * as cheerio from 'cheerio';
import { convertUrlToMarkdown } from './urlConverter.js';
import { AppError } from '../../../utils/errorHandler.js';

/**
 * Configuration for URL conversion
 */
const CONFIG = {
  concurrentLimit: 5,
  validProtocols: ['http:', 'https:'],
  excludePatterns: [
    /\.(jpg|jpeg|png|gif|svg|css|js|ico|woff|woff2|ttf|eot)$/i,  // Assets
    /\.(pdf|zip|doc|docx|xls|xlsx|ppt|pptx)$/i,                  // Documents
    /\?(utm_|source=|campaign=)/i,                                // Tracking
    /#.*/,                                                        // Anchors
    /^(mailto:|tel:|javascript:)/i,                              // Protocols
    /\/(api|feed|rss|auth|login|signup|sitemap|robots\.txt)/i    // System
  ],
  http: {
    headers: {
      'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,text/xml;q=0.8,*/*;q=0.7',
      'accept-encoding': 'gzip, deflate, br',
      'accept-language': 'en-US,en;q=0.9',
      'cache-control': 'no-cache',
      'pragma': 'no-cache',
      'sec-fetch-dest': 'document',
      'sec-fetch-mode': 'navigate',
      'sec-fetch-site': 'same-origin',
      'sec-fetch-user': '?1',
      'upgrade-insecure-requests': '1',
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    },
    decompress: true,
    responseType: 'text',
    dynamicContentWait: 2000, // Wait time in ms for dynamic content
    timeout: {
      request: 30000,
      response: 30000
    },
    preflight: {
      timeout: 5000,    // Quick check timeout
      maxRetries: 2     // Limited retries for preflight
    },
    retry: {
      limit: 3,
      methods: ['GET', 'HEAD'],
      statusCodes: [408, 413, 429, 500, 502, 503, 504],
      errorCodes: [
        'ETIMEDOUT',
        'ECONNRESET',
        'EADDRINUSE',
        'ECONNREFUSED',
        'EPIPE',
        'ENOTFOUND',
        'ENETUNREACH',
        'EAI_AGAIN'
      ],
      calculateDelay: ({retryCount}) => retryCount * 1000,
      maxRetryAfter: 60000 // Maximum value for retry-after header
    },
    spa: {
      selectors: [
        '[data-router-view]',   // Common SPA view containers
        '[data-view]',
        '[ng-view]',
        '[ui-view]',
        '[v-cloak]',           // Vue.js
        '[data-reactroot]',    // React
        '[ng-app]',            // Angular
        '.nuxt-content',       // Nuxt.js
        '.gatsby-content'      // Gatsby
      ],
      navigationTimeout: 5000
    }
  }
};

/**
 * Simple URL finder class to get child pages
 */
class UrlFinder {
  constructor() {
    this.childUrls = new Set();
  }

  async findChildUrls(parentUrl) {
    try {
      console.log(`Finding child pages for: ${parentUrl}`);
      
      const response = await got(parentUrl, {
        retry: {
          limit: 3,
          statusCodes: [408, 413, 429, 500, 502, 503, 504],
          methods: ['GET'],
          calculateDelay: ({retryCount}) => retryCount * 1000
        },
        timeout: {
          request: 30000,
          response: 30000
        },
        headers: CONFIG.http.headers,
        throwHttpErrors: false,
        followRedirect: true,
        decompress: true,
        responseType: 'text'
      });

      if (!response.ok) {
        throw new AppError(`Failed to load parent URL: ${response.statusCode}`, 400);
      }

      const $ = cheerio.load(response.body);
      const parentUrlObj = new URL(parentUrl);
      
      // Find all <a> tags with href
      $('a[href]').each((_, element) => {
        try {
          let href = $(element).attr('href');
          
          // Clean and normalize URL
          href = href.trim()
            .replace(/[\n\r\t]/g, '')
            .split('#')[0]
            .split('?')[0];

          // Skip invalid protocols
          if (href.match(/^(mailto:|tel:|javascript:|data:)/i)) {
            return;
          }

          // Convert to absolute URL
          const absoluteUrl = new URL(href, parentUrl).href;
          const urlObj = new URL(absoluteUrl);

          // Only include URLs from same domain and not excluded
          if (urlObj.hostname === parentUrlObj.hostname &&
              !CONFIG.excludePatterns.some(pattern => pattern.test(absoluteUrl))) {
            this.childUrls.add(absoluteUrl);
          }
        } catch (error) {
          console.log(`⚠️ Skipping invalid URL: ${error.message}`);
        }
      });

      console.log(`Found ${this.childUrls.size} child pages`);
      return Array.from(this.childUrls);
    } catch (error) {
      throw new AppError(`Failed to find child pages: ${error.message}`, 500);
    }
  }
}

/**
 * URL Processor class to handle conversion of discovered URLs
 */
class UrlProcessor {
  async processUrls(urls, options = {}) {
    const limit = pLimit(CONFIG.concurrentLimit);
    console.log(`\nConverting ${urls.size} pages to Markdown...\n`);

    const tasks = Array.from(urls).map(url =>
      limit(async () => {
        try {
          const result = await convertUrlToMarkdown(url, {
            ...options,
            includeImages: true,
            includeMeta: true,
            got: {
              retry: {
                limit: CONFIG.http.retry.limit,
                statusCodes: CONFIG.http.retry.statusCodes,
                methods: CONFIG.http.retry.methods,
                errorCodes: CONFIG.http.retry.errorCodes,
                calculateDelay: ({retryCount}) => retryCount * 1000,
                maxRetryAfter: CONFIG.http.retry.maxRetryAfter
              },
              timeout: {
                request: CONFIG.http.timeout.request,
                response: CONFIG.http.timeout.response
              },
              decompress: CONFIG.http.decompress,
              followRedirect: true,
              maxRedirects: 10,
              headers: CONFIG.http.headers,
              throwHttpErrors: false,
              responseType: 'text'
            },
            dynamicContentWait: CONFIG.http.dynamicContentWait,
            spa: CONFIG.http.spa
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
 * Converts a parent URL and its child pages to Markdown
 * @param {string} parentUrl - The URL normalized by the frontend
 */
export async function convertParentUrlToMarkdown(parentUrl) {
  const finder = new UrlFinder();
  const processor = new UrlProcessor();

  try {
    // Basic URL validation
    let urlObj;
    try {
      urlObj = new URL(parentUrl);
    } catch (error) {
      throw new AppError('Invalid URL format', 400);
    }
    
    const hostname = urlObj.hostname;
    console.log(`Starting conversion of ${parentUrl}`);

    // Get all child pages
    const childUrls = await finder.findChildUrls(parentUrl);
    if (childUrls.length === 0) {
      console.log('No child pages found, converting parent URL only');
    }

    // Include parent URL in pages to convert
    const allUrls = new Set([parentUrl, ...childUrls]);
    console.log(`Processing ${allUrls.size} total pages`);

    // Convert all pages to markdown
    const processedPages = await processor.processUrls(allUrls);

    // Generate index and collect images
    const seenImageUrls = new Set();
    const allImages = processedPages
      .filter(p => p.success)
      .flatMap(p => p.images || [])
      .filter(img => {
        if (!img?.data || !img?.name || seenImageUrls.has(img.url)) return false;
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
            content: content.replace(/!\[\[(.*?)\]\]/g, `![[../assets/$1]]`),
            type: 'text'
          }))
      ],
      images: allImages,
      success: true
    };
  } catch (error) {
    console.error('URL conversion failed:', error);
    throw new AppError(
      error instanceof AppError ? error.message : `Failed to convert URL: ${error.message}`,
      error instanceof AppError ? error.statusCode : 500
    );
  }
}
