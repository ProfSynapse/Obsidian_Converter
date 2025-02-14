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

      $content = $content || $('body');

      const imageRefs = [];
      const processedUrls = new Set();

      if (options.includeImages !== false) {
        const normalizeUrl = (src, baseUrl) => {
          if (!src) return null;
          try {
            let imgUrl = src.trim();
            if (imgUrl.startsWith('data:')) return null;
            if (imgUrl.startsWith('//')) {
              imgUrl = `https:${imgUrl}`;
            }

            const urlObj = new URL(imgUrl, baseUrl);
            urlObj.search = '';
            urlObj.hash = '';
            
            return decodeURIComponent(urlObj.href);
          } catch (error) {
            console.error('URL normalization error:', error);
            return null;
          }
        };

        const processImageUrl = (imgUrl, altText = '', parentUrl = null) => {
          if (!imgUrl) return null;
          
          try {
            const normalizedUrl = normalizeUrl(imgUrl, url);
            if (!normalizedUrl || processedUrls.has(normalizedUrl)) return null;

            const ext = normalizedUrl.split('.').pop()?.toLowerCase() || '';
            if (!ext || !CONFIG.conversion.imageTypes.includes(ext)) return null;

            if (CONFIG.conversion.excludePatterns.some(pattern => pattern.test(normalizedUrl))) {
              return null;
            }

            processedUrls.add(normalizedUrl);
            return {
              url: normalizedUrl,
              alt: altText || '',
              linkedTo: parentUrl,
              referenceUrl: url,
              addedAt: new Date().toISOString()
            };
          } catch (error) {
            console.error('Image processing error:', error);
            return null;
          }
        };

        $content.find('img').each((_, img) => {
          const $img = $(img);
          const srcs = [
            $img.attr('src'),
            ...CONFIG.conversion.lazyLoadAttrs.map(attr => $img.attr(attr))
          ].filter(Boolean);

          for (const src of srcs) {
            const imageData = processImageUrl(src, $img.attr('alt') || '');
            if (imageData) {
              const isLinked = $img.parent('a').length > 0;
              if (isLinked) {
                const $link = $img.parent('a');
                const href = $link.attr('href');
                if (href && href !== imageData.url) {
                  $link.replaceWith(`[![${imageData.alt}](${imageData.url})](${href})`);
                } else {
                  $link.replaceWith(`![${imageData.alt}](${imageData.url})`);
                }
              } else {
                $img.replaceWith(`![${imageData.alt}](${imageData.url})`);
              }
              imageRefs.push(imageData);
              break;
            }
          }
        });

        $content.find('[style*="background"]').each((_, el) => {
          const $el = $(el);
          const style = $el.attr('style') || '';
          const match = style.match(/background(?:-image)?\s*:\s*url\(['"]?([^'"]+)['"]?\)/i);
          
          if (match) {
            const imageData = processImageUrl(match[1]);
            if (imageData) {
              $el.before(`\n\n![${imageData.alt}](${imageData.url})\n\n`);
              $el.removeAttr('style');
              imageRefs.push(imageData);
            }
          }
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
