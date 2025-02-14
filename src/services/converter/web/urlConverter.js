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

      // Process images with comprehensive detection
      const imageRefs = [];
      const processedUrls = new Set();

      if (options.includeImages !== false) {
        // Helper function to clean and normalize URLs
        const normalizeUrl = (src, baseUrl) => {
          if (!src) return null;
          try {
            const cleanSrc = src
              .replace(/\s+/g, '')
              .replace(/['"]/g, '')
              .trim();

            if (cleanSrc.startsWith('data:')) return null;

            // Handle protocol-relative URLs
            if (cleanSrc.startsWith('//')) {
              return `https:${cleanSrc}`;
            }

            return new URL(cleanSrc, baseUrl).href;
          } catch (error) {
            console.error('URL normalization error:', error);
            return null;
          }
        };

        // Helper function to sanitize filenames
        const sanitizeFilename = (url) => {
          try {
            const urlObj = new URL(url);
            let filename = urlObj.pathname.split('/').pop() || 'image';
            
            // Remove query parameters but keep file extension
            filename = filename.split('?')[0].split('#')[0];
            
            // Clean the filename
            return filename
              .replace(/[^a-zA-Z0-9.-]/g, '-') // Replace special chars with hyphen
              .replace(/--+/g, '-')            // Replace multiple hyphens with single
              .replace(/^-+|-+$/g, '')         // Remove leading/trailing hyphens
              .toLowerCase();
          } catch (error) {
            console.error('Filename sanitization error:', error);
            return 'image';
          }
        };

        // Process a potential image URL
        const processImageUrl = (imgUrl, altText = '', parentUrl = null) => {
          if (!imgUrl) return null;
          
          try {
            const normalizedUrl = normalizeUrl(imgUrl, url);
            if (!normalizedUrl) return null;

            if (processedUrls.has(normalizedUrl)) return null;

            const ext = normalizedUrl.split('.').pop()?.toLowerCase() || '';
            if (!ext || !CONFIG.conversion.imageTypes.includes(ext)) return null;

            if (CONFIG.conversion.excludePatterns.some(pattern => pattern.test(normalizedUrl))) {
              return null;
            }

            processedUrls.add(normalizedUrl);

            return {
              url: normalizedUrl,
              alt: altText || undefined,
              filename: sanitizeFilename(normalizedUrl),
              linkedTo: parentUrl,
              referenceUrl: url,
              addedAt: new Date().toISOString()
            };
          } catch (error) {
            console.error('Image processing error:', error);
            return null;
          }
        };

        // Find all possible image sources
        const findImageSources = ($element) => {
          const sources = [];

          // Direct image elements
          $element.find('img').each((_, img) => {
            const $img = $(img);
            const srcs = [
              $img.attr('src'),
              ...CONFIG.conversion.lazyLoadAttrs.map(attr => $img.attr(attr))
            ].filter(Boolean);

            srcs.forEach(src => {
              const imageData = processImageUrl(src, $img.attr('alt'));
              if (imageData) {
                sources.push({
                  element: $img,
                  data: imageData,
                  isLinked: $img.parent('a').length > 0
                });
              }
            });
          });

          // Background images
          $element.find('[style*="background"]').each((_, el) => {
            const $el = $(el);
            const style = $el.attr('style') || '';
            const match = style.match(/background(?:-image)?\s*:\s*url\(['"]?([^'"]+)['"]?\)/i);
            
            if (match) {
              const imageData = processImageUrl(match[1]);
              if (imageData) {
                sources.push({
                  element: $el,
                  data: imageData,
                  isBackground: true
                });
              }
            }
          });

          // JSON-LD images
          $element.find('script[type="application/ld+json"]').each((_, script) => {
            try {
              const json = JSON.parse($(script).html());
              const findImages = (obj) => {
                if (!obj || typeof obj !== 'object') return;
                
                if (Array.isArray(obj)) {
                  obj.forEach(item => findImages(item));
                  return;
                }

                for (const [key, value] of Object.entries(obj)) {
                  if (typeof value === 'string' && 
                      (key.toLowerCase().includes('image') || key.toLowerCase().includes('photo'))) {
                    const imageData = processImageUrl(value);
                    if (imageData) {
                      sources.push({
                        data: imageData,
                        isJsonLd: true
                      });
                    }
                  } else if (typeof value === 'object') {
                    findImages(value);
                  }
                }
              };

              findImages(json);
            } catch (error) {
              console.error('JSON-LD parsing error:', error);
            }
          });

          return sources;
        };

        // Process all image sources
        const imageSources = findImageSources($content);
        
        // Replace images in content and collect references
        imageSources.forEach(({ element, data, isLinked, isBackground }) => {
          if (data) {
            if (element) {
              if (isBackground) {
                // For background images, use the direct URL
                element.before(`\n\n![${data.alt || ''}](${data.url})\n\n`);
                element.removeAttr('style');
              } else if (isLinked) {
                // For linked images
                const $link = element.parent('a');
                const href = $link.attr('href');
                if (href && href !== data.url) {
                  $link.replaceWith(`[![${data.alt || ''}](${data.url})](${href})`);
                } else {
                  $link.replaceWith(`![${data.alt || ''}](${data.url})`);
                }
              } else {
                // For regular images
                element.replaceWith(`![${data.alt || ''}](${data.url})`);
              }
            }
            // Store reference but don't download
            imageRefs.push({
              url: data.url,
              alt: data.alt,
              linkedTo: data.linkedTo,
              addedAt: new Date().toISOString()
            });
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
