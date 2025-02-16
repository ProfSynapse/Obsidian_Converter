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
    imageTypes: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'ico', 'avif', 'bmp', 'tiff'],
    // Reduced exclude patterns to avoid filtering legitimate images
    excludePatterns: [
      /\/(analytics|tracking|beacon)\//i
    ],
    lazyLoadAttrs: [
      'src',
      'data-src',
      'data-original',
      'data-lazy',
      'data-srcset',
      'data-original-src',
      'data-fallback-src',
      'loading-src',
      'lazy-src',
      'srcset',
      'data-image',
      'data-img',
      'data-lazy-src',
      'data-hs-src'  // HubSpot specific
    ],
    backgroundImageSelectors: [
      '[style*="background"]',
      '[style*="background-image"]',
      '[data-background]',
      '[data-bg]'
    ],
    // Added image path patterns to help identify images without extensions
    imagePathPatterns: [
      /\/images?\//i,
      /\/img\//i,
      /\/photos?\//i,
      /\/pictures?\//i,
      /\/uploads\//i,
      /\/media\//i,
      /\/assets\//i,
      /\.hubspotusercontent/i  // HubSpot specific
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

    this.addBasicRules();
  }

  addBasicRules() {
    this.turndownService.addRule('tables', {
      filter: ['table'],
      replacement: (content) => content
    });

    this.turndownService.addRule('codeBlocks', {
      filter: ['pre'],
      replacement: (content) => `\n\`\`\`\n${content}\n\`\`\`\n`
    });

    this.turndownService.addRule('lineBreaks', {
      filter: ['br'],
      replacement: () => '\n'
    });
  }

  async convertToMarkdown(url, options = {}) {
    try {
      const gotOptions = {
        ...CONFIG.http,
        ...options.got,
        headers: {
          ...CONFIG.http.headers,
          ...(options.got?.headers || {})
        }
      };

      const response = await got(url, gotOptions);
      const $ = cheerio.load(response.body);

      const removeSelectors = [
        'script', 'style', 'iframe', 'noscript',
        'header nav', 'footer nav', 'aside',
        '.ads', '.social-share', '.comments',
        '.navigation', '.menu', '.widget'
      ];

      removeSelectors.forEach(selector => {
        $(selector).remove();
      });

      const contentSelectors = [
        'article',
        'main',
        '[role="main"]',
        '.post-content',
        '.entry-content',
        '.article-content',
        '.content',
        '#content',
        '#main',
        '.main-content',  // Added more selectors
        '.page-content',
        '[data-hs-page-content]', // HubSpot specific
        'body'
      ];

      let $content = null;
      for (const selector of contentSelectors) {
        const $found = $(selector);
        if ($found.length) {
          $content = $found;
          break;
        }
      }

      $content = $content || $('body');

      const imageRefs = [];
      const processedUrls = new Set();

      if (options.includeImages !== false) {
        const normalizeUrl = (src, baseUrl) => {
          if (!src) return null;
          try {
            const imgUrl = src.trim();
            if (imgUrl.startsWith('data:')) return null;

            // Convert protocol-relative URLs
            const fullUrl = imgUrl.startsWith('//') ? `https:${imgUrl}` : imgUrl;
            
            // Handle relative paths
            const urlObj = new URL(fullUrl, baseUrl);
            
            // Keep query parameters for CDN and dynamic images
            return urlObj.href;
          } catch (error) {
            console.error('URL normalization error:', error);
            return null;
          }
        };

        const processImageUrl = (imgUrl, altText = '', titleText = '') => {
          if (!imgUrl) return null;
          
          try {
            const normalizedUrl = normalizeUrl(imgUrl, url);
            if (!normalizedUrl) return null;

            // Skip already processed identical URLs
            if (processedUrls.has(normalizedUrl)) return null;

            // Check file extension or URL patterns
            const ext = normalizedUrl.split('.').pop()?.toLowerCase().split('?')[0] || '';
            const isValidExtension = CONFIG.conversion.imageTypes.includes(ext);
            const hasImagePath = CONFIG.conversion.imagePathPatterns.some(pattern => pattern.test(normalizedUrl));

            if (!isValidExtension && !hasImagePath) return null;

            if (CONFIG.conversion.excludePatterns.some(pattern => pattern.test(normalizedUrl))) {
              return null;
            }

            processedUrls.add(normalizedUrl);
            return {
              url: normalizedUrl,
              alt: altText || titleText || '',
              referenceUrl: url,
              addedAt: new Date().toISOString()
            };
          } catch (error) {
            console.error('Image processing error:', error);
            return null;
          }
        };

        // Process img tags with enhanced lazy loading support
        $content.find('img').each((_, img) => {
          const $img = $(img);
          
          // Get all possible image source attributes
          const srcs = CONFIG.conversion.lazyLoadAttrs
            .map(attr => $img.attr(attr))
            .filter(Boolean);

          for (const src of srcs) {
            const imageData = processImageUrl(
              src,
              $img.attr('alt') || '',
              $img.attr('title') || $img.attr('data-title') || ''
            );

            if (imageData) {
              const isLinked = $img.parent('a').length > 0;
              const createMarkdown = (altText, url, href = null) => {
                if (href && href !== url) {
                  return $.text(`[![[[${url}]${altText ? ` | ${altText}` : ''}]](${href})`);
                }
                return $.text(`![[${url}]${altText ? ` | ${altText}` : ''}`);
              };

              if (isLinked) {
                const $link = $img.parent('a');
                const href = $link.attr('href');
                $link.replaceWith(createMarkdown(imageData.alt, imageData.url, href));
              } else {
                $img.replaceWith(createMarkdown(imageData.alt, imageData.url));
              }
              imageRefs.push(imageData);
              break;
            }
          }
        });

        // Enhanced background image processing
        CONFIG.conversion.backgroundImageSelectors.forEach(selector => {
          $content.find(selector).each((_, el) => {
            const $el = $(el);
            const style = $el.attr('style') || '';
            const dataBg = $el.attr('data-background') || $el.attr('data-bg');
            
            // Check both inline style and data attributes
            const bgMatch = style.match(/background(?:-image)?\s*:\s*url\(['"]?([^'"]+)['"]?\)/i);
            const bgUrl = bgMatch ? bgMatch[1] : dataBg;

            if (bgUrl) {
              const imageData = processImageUrl(bgUrl);
              if (imageData) {
                $el.before($.text(`\n\n![[${imageData.url}]${imageData.alt ? ` | ${imageData.alt}` : ''}]\n\n`));
                imageRefs.push(imageData);
              }
            }
          });
        });
      }

      const markdown = this.turndownService.turndown($content.html())
        .replace(/\n{3,}/g, '\n\n')
        .trim();

      let metadata = null;
      if (options.includeMeta !== false) {
        try {
          metadata = await extractMetadata(url);
        } catch (error) {
          console.error('Metadata extraction failed:', error);
        }
      }

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

export const urlConverter = new UrlConverter();

export const convertUrlToMarkdown = async (url, options) => 
  urlConverter.convertToMarkdown(url, options);
