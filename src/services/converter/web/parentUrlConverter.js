// services/converter/web/parentUrlConverter.js

import got from 'got';
import pLimit from 'p-limit';
import * as cheerio from 'cheerio';
import fs from 'fs';
import { convertUrlToMarkdown } from './urlConverter.js';
import { AppError } from '../../../utils/errorHandler.js';

/**
 * Configuration for URL conversion
 */
const CONFIG = {
  concurrentLimit: 50,
  validProtocols: ['http:', 'https:'],
  excludePatterns: [
    // Assets to exclude
    /\.(css|js|woff|woff2|ttf|eot)$/i,
    /\.(mp3|mp4|wav|avi|mov|wmv|flv|ogg|webm)$/i, // Media files
    
    // Documents and archives
    /\.(pdf|zip|doc|docx|xls|xlsx|ppt|pptx|rar|7z)$/i,
    
    // Tracking and analytics
    /\?(utm_|source=|campaign=|ref=|fbclid=|gclid=)/i,
    /\/(analytics|tracking|pixel|beacon|ad)\//i,
    /\.(analytics|tracking)\./i,
    /\b(ga|gtm|pixel|fb)\b/i,
    
    // System and utility
    /#.*/,  // Anchors
    /^(mailto:|tel:|javascript:|data:)/i,  // Protocols
    /\/(api|feed|rss|auth|login|signup|sitemap|robots\.txt)/i,  // System paths
    /\/(cart|checkout|account|profile|settings)/i,  // User pages
    /\/(search|tags?|categories)/i,  // Navigation
    /\/(wp-admin|wp-content|wp-includes)/i,  // CMS
    /\/(cdn-cgi|__webpack|_next|static)\//i,  // Infrastructure
    
    // Dynamic and temporary
    /\?.*(?:session|token|nonce|timestamp)=/i,
    /\/\d{4}\/\d{2}\/\d{2}\//  // Date-based URLs
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
  constructor() {
    this.tempDir = `${process.env.TEMP || '/tmp'}/obsidian-converter/temp-${Date.now()}`;
  }

  async processUrls(urls, options = {}) {
    const limit = pLimit(CONFIG.concurrentLimit);
    const batchSize = 20; // Process 20 pages at a time
    const urlArray = Array.from(urls);
    const totalUrls = urlArray.length;
    
    console.log(`\n🔄 Converting ${totalUrls} pages to Markdown in batches of ${batchSize}...\n`);

    // Create temp directory for batch processing
    await fs.promises.mkdir(this.tempDir, { recursive: true });
    console.log(`📁 Created temp directory: ${this.tempDir}`);

    const results = [];
    let processedCount = 0;

    // Process URLs in batches
    for (let i = 0; i < urlArray.length; i += batchSize) {
      const batch = urlArray.slice(i, i + batchSize);
      console.log(`\n📦 Processing batch ${Math.floor(i/batchSize) + 1} of ${Math.ceil(totalUrls/batchSize)}`);

      const batchTasks = batch.map(url =>
        limit(async () => {
          try {
            const conversionOptions = {
              ...options,
              includeImages: true,
              includeMeta: true,
              got: {
                retry: CONFIG.http.retry,
                timeout: CONFIG.http.timeout,
                headers: CONFIG.http.headers,
                decompress: CONFIG.http.decompress,
                followRedirect: true,
                throwHttpErrors: false,
                responseType: 'text'
              },
              spa: CONFIG.http.spa
            };

            const result = await convertUrlToMarkdown(url, conversionOptions);
            const urlPath = new URL(url).pathname || '/';
            const name = this.sanitizeFilename(urlPath);
            
            // Write markdown file to disk
            const filePath = `${this.tempDir}/${name}.md`;
            await fs.promises.writeFile(filePath, result.content, 'utf8');

            processedCount++;
            console.log(`✓ Converted (${processedCount}/${totalUrls}): ${url} -> ${name}`);
            
            return {
              success: true,
              name: `${name}.md`,
              path: filePath,
              url,
              metadata: result.metadata,
              images: result.images || []
            };
          } catch (error) {
            console.log(`❌ Failed to convert: ${url}`);
            return { success: false, url, error: error.message };
          }
        })
      );

      const batchResults = await Promise.all(batchTasks);
      results.push(...batchResults);

      // Force garbage collection if available
      if (global.gc) {
        console.log('🧹 Running garbage collection after batch');
        global.gc();
      }
    }

    console.log(`\n✅ All batches processed. Total pages: ${processedCount}`);
    return results;
  }

  sanitizeFilename(input) {
    if (!input) return 'index';

    // Extract meaningful parts from the path
    const parts = input.split('/').filter(Boolean);
    const lastPart = parts.pop() || 'index';
    
    // Clean up the filename
    const sanitized = lastPart
      .toLowerCase()
      // Remove file extensions
      .replace(/\.[^.]+$/, '')
      // Remove query parameters
      .split('?')[0]
      // Remove special characters
      .replace(/[^a-z0-9]+/g, '-')
      // Clean up dashes
      .replace(/^-+|-+$/g, '')
      // Limit length but try to keep words intact
      .split('-')
      .reduce((acc, part) => {
        if ((acc + (acc ? '-' : '') + part).length <= 100) {
          return acc + (acc ? '-' : '') + part;
        }
        return acc;
      }, '');

    return sanitized || 'index';
  }

  /**
   * Collects unique image references from pages
   */
  collectImageReferences(pages) {
    const seenUrls = new Set();
    const images = [];

    pages.filter(p => p.success).forEach(page => {
      if (page.images) {
        page.images.forEach(img => {
          if (img?.url && !seenUrls.has(img.url)) {
            seenUrls.add(img.url);
            images.push({
              ...img,
              referenceUrl: page.url
            });
          }
        });
      }
    });

    return images;
  }

  generateIndex(parentUrl, pages, imageData) {
    const successfulPages = pages.filter(p => p.success);
    const failedPages = pages.filter(p => !p.success);
    const hostname = new URL(parentUrl).hostname;
    const timestamp = new Date().toISOString();

    // Group pages by their primary sections
    const sections = new Map();
    successfulPages.forEach(page => {
      try {
        const url = new URL(page.url);
        const pathParts = url.pathname.split('/').filter(Boolean);
        const section = pathParts[0] || 'main';
        if (!sections.has(section)) {
          sections.set(section, []);
        }
        sections.get(section).push(page);
      } catch (error) {
        console.error('Error processing page section:', error);
      }
    });

    // Generate section content
    const sectionContent = Array.from(sections.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([section, pages]) => [
        `### ${section.charAt(0).toUpperCase() + section.slice(1)}`,
        '',
        ...pages.map(page => {
          const name = page.name.replace(/\.md$/, '');
          return `- [[pages/${name}|${name}]] - [Original](${page.url})`;
        }),
        ''
      ].join('\n'));

    // Collect all image references
    const allImages = new Set();
    pages.filter(p => p.success).forEach(page => {
      if (page.images) {
        page.images.forEach(img => {
          if (img.url) allImages.add(img);
        });
      }
    });

    const imageList = Array.from(allImages)
      .sort((a, b) => (b.addedAt || '').localeCompare(a.addedAt || ''))
      .map(img => `- [${img.alt || 'Image'}](${img.url}) (from ${img.referenceUrl})`);

    return [
      `---`,
      `title: "${hostname} Archive"`,
      `description: "Website archive of ${hostname}"`,
      `date: "${timestamp}"`,
      `source: "${parentUrl}"`,
      `archived_at: "${timestamp}"`,
      `tags:`,
      `  - website-archive`,
      `  - ${hostname.replace(/\./g, '-')}`,
      `---`,
      '',
      `# ${hostname} Website Archive`,
      '',
      '## Site Information',
      `- **Source URL:** ${parentUrl}`,
      `- **Archived:** ${timestamp}`,
      `- **Total Pages:** ${pages.length}`,
      `- **Successful:** ${successfulPages.length}`,
      `- **Failed:** ${failedPages.length}`,
      '',
      '## Successfully Converted Pages',
      '',
      ...sectionContent,
      '',
      failedPages.length ? [
        '## Failed Conversions',
        '',
        ...failedPages.map(page => `- ${page.url}: ${page.error}`),
        ''
      ].join('\n') : '',
      '## Referenced Images',
      '',
      'The following images are referenced in the archive:',
      '',
      ...imageList.slice(0, 30), // Limit to first 30 images to keep the list manageable
      '',
      '## Notes',
      '',
      '- All pages are stored in the `pages/` folder',
      '- Internal links are preserved as wiki-links',
      '- Original URLs are preserved in page metadata',
      '- Images are linked to their original source URLs',
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

    const processor = new UrlProcessor();

    try {
      // Get all child pages
      const childUrls = await finder.findChildUrls(parentUrl);
      if (childUrls.length === 0) {
        console.log('No child pages found, converting parent URL only');
      }

      // Include parent URL in pages to convert
      const allUrls = new Set([parentUrl, ...childUrls]);
      console.log(`Processing ${allUrls.size} total pages`);

      // Convert all pages to markdown with disk streaming
      const processedPages = await processor.processUrls(allUrls);

      // Collect image references
      const imageRefs = processor.collectImageReferences(processedPages);

      // Generate index with image references
      const index = processor.generateIndex(parentUrl, processedPages, { images: imageRefs });

      // Create files array from disk files
      const files = [
        {
          name: `web/${hostname}/index.md`,
          content: index,
          type: 'text'
        }
      ];

      // Add processed pages from disk
      for (const page of processedPages.filter(p => p.success)) {
        const content = await fs.promises.readFile(page.path, 'utf8');
        files.push({
          name: `web/${hostname}/pages/${page.name}`,
          content,
          type: 'text'
        });
      }

      // Clean up temp directory
      await fs.promises.rm(processor.tempDir, { recursive: true, force: true });
      console.log(`🧹 Cleaned up temp directory: ${processor.tempDir}`);

      return {
        url: parentUrl,
        type: 'parenturl',
        content: index,
        name: hostname,
        files,
        success: true,
        stats: {
          totalPages: processedPages.length,
          successfulPages: processedPages.filter(p => p.success).length,
          failedPages: processedPages.filter(p => !p.success).length,
          totalImages: imageRefs.length
        }
      };
    } finally {
      // Ensure temp directory is cleaned up even on error
      try {
        await fs.promises.rm(processor.tempDir, { recursive: true, force: true });
        console.log(`🧹 Cleaned up temp directory: ${processor.tempDir}`);
      } catch (cleanupError) {
        console.error('Failed to clean up temp directory:', cleanupError);
      }
    }
  } catch (error) {
    console.error('URL conversion failed:', error);
    throw new AppError(
      error instanceof AppError ? error.message : `Failed to convert URL: ${error.message}`,
      error instanceof AppError ? error.statusCode : 500
    );
  }
}
