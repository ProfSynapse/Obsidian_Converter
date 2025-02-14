// services/converter/web/urlConverter.js

import got from 'got';
import TurndownService from 'turndown';
import * as cheerio from 'cheerio';
import { extractMetadata } from '../../../utils/metadataExtractor.js';

/**
 * Custom error types for URL conversion
 */
class UrlConversionError extends Error {
  constructor(message, code = 'CONVERSION_ERROR', details = null) {
    super(message);
    this.name = 'UrlConversionError';
    this.code = code;
    this.details = details;
    this.timestamp = new Date().toISOString();
  }
}

/**
 * Configuration for URL conversion settings
 */
const CONFIG = {
  http: {
    timeout: {
      request: 30000,
      response: 30000
    },
    retry: {
      limit: 3,
      statusCodes: [408, 413, 429, 500, 502, 503, 504],
      methods: ['GET'],
      calculateDelay: ({retryCount}) => retryCount * 1000
    },
    headers: {
      'accept': 'text/html,application/xhtml+xml',
      'accept-encoding': 'gzip, deflate',
      'accept-language': 'en-US,en;q=0.9',
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    },
    throwHttpErrors: false,
    followRedirect: true,
    decompress: true,
    responseType: 'text'
  },
  conversion: {
    imageTypes: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'ico'],
    excludePatterns: [
      /\/(analytics|tracking|pixel|beacon|ad)\//i,
      /\.(analytics|tracking)\./i,
      /\b(ga|gtm|pixel|fb)\b/i,
      /\b(doubleclick|adsense)\b/i
    ],
    lazyLoadAttrs: [
      'data-src',
      'data-original',
      'data-lazy',
      'data-srcset',
      'loading-src',
      'lazy-src'
    ]
  }
};

class UrlConverter {
  constructor() {
    this.turndownService = new TurndownService({
      headingStyle: 'atx',
      bulletListMarker: '-',
      codeBlockStyle: 'fenced',
      hr: '---',
      strongDelimiter: '**',
      emDelimiter: '*'
    });

    // Add basic rules for common elements
    this.addBasicRules();
  }

  addBasicRules() {
    // Table handling
    this.turndownService.addRule('tables', {
      filter: ['table'],
      replacement: (content) => content
    });

    // Code block handling
    this.turndownService.addRule('codeBlocks', {
      filter: ['pre'],
      replacement: (content) => `\n\`\`\`\n${content}\n\`\`\`\n`
    });

    // Preserve line breaks
    this.turndownService.addRule('lineBreaks', {
      filter: ['br'],
      replacement: () => '\n'
    });
  }

  async convertToMarkdown(url, options = {}) {
    try {
      // Merge options with defaults
      const gotOptions = {
        ...CONFIG.http,
        ...options.got,
        headers: {
          ...CONFIG.http.headers,
          ...(options.got?.headers || {})
        }
      };

      // Fetch content
      const response = await got(url, gotOptions);
      const $ = cheerio.load(response.body);

      // Basic cleanup - remove obvious non-content elements
      const removeSelectors = [
        'script', 'style', 'iframe', 'noscript',
        'header nav', 'footer nav', 'aside',
        '.ads', '.social-share', '.comments',
        '.navigation', '.menu', '.widget'
      ];

      removeSelectors.forEach(selector => {
        $(selector).remove();
      });

      // Try to find main content
      const contentSelectors = [
        'article', 'main', '[role="main"]',
        '.post-content', '.entry-content', '.article-content',
        '.content', '#content', '#main'
      ];

      let $content = null;
      for (const selector of contentSelectors) {
        const $found = $(selector).first();
        if ($found.length) {
          $content = $found;
          break;
        }
      }

      // Fallback to body if no main content found
      $content = $content || $('body');

      // Process images
      const imageRefs = [];
      const processedUrls = new Set();
      
      if (options.includeImages !== false) {
        const processImage = ($img, parentUrl = null) => {
          const srcs = [
            $img.attr('src'),
            ...CONFIG.conversion.lazyLoadAttrs.map(attr => $img.attr(attr))
          ].filter(Boolean);

          if (srcs.length === 0) return null;

          for (const src of srcs) {
            try {
              const cleanSrc = src
                .replace(/\s+/g, '')
                .replace(/['"]/g, '')
                .split('#')[0]
                .split('?')[0];

              if (cleanSrc.startsWith('data:')) continue;

              const imageUrl = new URL(cleanSrc, url).href;
              
              if (processedUrls.has(imageUrl) || 
                  CONFIG.conversion.excludePatterns.some(pattern => pattern.test(imageUrl))) {
                continue;
              }

              const ext = imageUrl.split('.').pop()?.toLowerCase() || '';
              if (!ext || !CONFIG.conversion.imageTypes.includes(ext)) continue;

              processedUrls.add(imageUrl);

              const alt = $img.attr('alt') || '';
              const urlObj = new URL(imageUrl);
              const filename = urlObj.pathname.split('/').pop() || 'image';
              const sanitizedFilename = filename
                .replace(/[^a-zA-Z0-9.-]/g, '-')
                .replace(/^-+|-+$/g, '')
                .toLowerCase();
              
              return {
                url: imageUrl,
                alt: alt || undefined,
                filename: sanitizedFilename,
                linkedTo: parentUrl,
                referenceUrl: url,
                addedAt: new Date().toISOString()
              };
            } catch (error) {
              console.error('Image processing error:', error);
            }
          }
          return null;
        };

        // Handle linked images
        $content.find('a > img').each((_, img) => {
          const $img = $(img);
          const $link = $img.parent('a');
          const href = $link.attr('href');

          const imageData = processImage($img, href);
          if (imageData) {
            $link.replaceWith(`![[${imageData.filename}]]`);
            imageRefs.push(imageData);
          }
        });

        // Handle standalone images
        $content.find('img').not('a > img').each((_, img) => {
          const $img = $(img);
          const imageData = processImage($img);
          if (imageData) {
            $img.replaceWith(`![[${imageData.filename}]]`);
            imageRefs.push(imageData);
          }
        });
      }

      // Convert to markdown
      const markdown = this.turndownService.turndown($content.html())
        .replace(/\n{3,}/g, '\n\n')
        .trim();

      // Get metadata
      let metadata = null;
      if (options.includeMeta !== false) {
        try {
          metadata = await extractMetadata(url);
        } catch (error) {
          console.error('Metadata extraction failed:', error);
        }
      }

      // Format final content
      const content = [
        metadata ? [
          '---',
          Object.entries(metadata)
            .map(([key, value]) => `${key}: "${value?.toString()?.replace(/"/g, '\\"') || ''}"`)
            .join('\n'),
          '---'
        ].join('\n') : null,
        markdown
      ].filter(Boolean).join('\n\n');

      return {
        content,
        images: imageRefs,
        success: true,
        name: options.originalName || new URL(url).hostname,
        metadata,
        url
      };

    } catch (error) {
      console.error('URL conversion failed:', error);
      throw error instanceof UrlConversionError ? error : new UrlConversionError(error.message);
    }
  }
}

// Export singleton instance
export const urlConverter = new UrlConverter();

// Export main conversion function
export const convertUrlToMarkdown = async (url, options) => 
  urlConverter.convertToMarkdown(url, options);
