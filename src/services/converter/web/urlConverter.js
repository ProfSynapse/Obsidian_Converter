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
    imageAttributes: [
      'src',
      'data-src',
      'data-original',
      'data-lazy',
      'data-srcset',
      'srcset'
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

  /**
   * Extract image URL from srcset attribute
   */
  extractSrcsetUrl(srcset) {
    if (!srcset) return null;
    // Get largest image from srcset (last one in the list)
    const urls = srcset.split(',')
      .map(src => src.trim().split(' ')[0])
      .filter(Boolean);
    return urls[urls.length - 1] || urls[0];
  }

  /**
   * Extract image URLs from an HTML img element
   */
  extractImageUrls($img) {
    const urls = [];
    
    // Check all possible image attributes
    for (const attr of CONFIG.conversion.imageAttributes) {
      const value = $img.attr(attr);
      if (!value) continue;

      if (attr === 'srcset') {
        const srcsetUrl = this.extractSrcsetUrl(value);
        if (srcsetUrl) urls.push(srcsetUrl);
      } else {
        urls.push(value);
      }
    }

    // Log found URLs
    console.log('Found image URLs:', urls);
    return urls.filter(Boolean);
  }

  /**
   * Normalize and validate an image URL
   */
  normalizeImageUrl(url, baseUrl) {
    try {
      // Handle protocol-relative URLs
      const fullUrl = url.startsWith('//') ? `https:${url}` : url;
      
      // Create full URL
      const normalizedUrl = new URL(fullUrl, baseUrl).href;

      // Check if URL points to an image
      const urlPath = normalizedUrl.toLowerCase();
      const hasImageExt = CONFIG.conversion.imageTypes.some(ext => 
        urlPath.includes(`.${ext}`)
      );

      // Check if URL has image hints in query params
      const params = new URLSearchParams(normalizedUrl.split('?')[1] || '');
      const nameParam = params.get('name') || '';
      const hasImageName = CONFIG.conversion.imageTypes.some(ext =>
        nameParam.toLowerCase().endsWith(`.${ext}`)
      );

      if (!hasImageExt && !hasImageName) {
        console.log('Skipping non-image URL:', normalizedUrl);
        return null;
      }

      return normalizedUrl;
    } catch (error) {
      console.error('URL normalization error:', error);
      return null;
    }
  }

  async convertToMarkdown(url, options = {}) {
    try {
      const response = await got(url, {
        ...CONFIG.http,
        ...options.got,
        headers: {
          ...CONFIG.http.headers,
          ...(options.got?.headers || {})
        }
      });

      const $ = cheerio.load(response.body);

      // Remove unnecessary elements
      const removeSelectors = [
        'script', 'style', 'iframe', 'noscript',
        'header nav', 'footer nav', 'aside',
        '.ads', '.social-share', '.comments',
        '.navigation', '.menu', '.widget'
      ];
      removeSelectors.forEach(selector => $(selector).remove());

      // Find main content
      const contentSelectors = [
        'article', 'main', '[role="main"]',
        '.post-content', '.entry-content', '.article-content',
        '.content', '#content', '#main', 'body'
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
        // Process all img tags
        $content.find('img').each((_, img) => {
          const $img = $(img);
          const urls = this.extractImageUrls($img);
          
          for (const imageUrl of urls) {
            const normalizedUrl = this.normalizeImageUrl(imageUrl, url);
            if (!normalizedUrl || processedUrls.has(normalizedUrl)) continue;

            processedUrls.add(normalizedUrl);
            const imageData = {
              url: normalizedUrl,
              alt: $img.attr('alt') || $img.attr('title') || '',
              referenceUrl: url,
              addedAt: new Date().toISOString()
            };

            const isLinked = $img.parent('a').length > 0;
            const createMarkdown = (alt, imgUrl, href = null) => {
              if (href && href !== imgUrl) {
                return $.text(`[![[[${imgUrl}]${alt ? ` | ${alt}` : ''}]](${href})`);
              }
              return $.text(`![[${imgUrl}]${alt ? ` | ${alt}` : ''}`);
            };

            if (isLinked) {
              const $link = $img.parent('a');
              const href = $link.attr('href');
              $link.replaceWith(createMarkdown(imageData.alt, imageData.url, href));
            } else {
              $img.replaceWith(createMarkdown(imageData.alt, imageData.url));
            }
            
            console.log('Processing image:', {
              original: imageUrl,
              normalized: normalizedUrl,
              alt: imageData.alt
            });
            
            imageRefs.push(imageData);
            break; // Take first valid URL
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
