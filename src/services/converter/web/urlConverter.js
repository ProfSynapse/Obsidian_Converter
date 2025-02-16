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
 * Configuration for HTTP requests
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
    // Keep table structure
    this.turndownService.addRule('tables', {
      filter: ['table'],
      replacement: (content) => content
    });

    // Format code blocks
    this.turndownService.addRule('codeBlocks', {
      filter: ['pre'],
      replacement: (content) => `\n\`\`\`\n${content}\n\`\`\`\n`
    });

    // Convert line breaks
    this.turndownService.addRule('lineBreaks', {
      filter: ['br'],
      replacement: () => '\n'
    });
  }

  findBestImageUrl(img) {
    const src = img.attr('src');
    const srcset = img.attr('srcset');

    if (!srcset) return src;

    // Parse srcset and get the largest image
    const sources = srcset.split(',')
      .map(s => {
        const [url, width] = s.trim().split(/\s+/);
        return {
          url,
          width: parseInt(width) || 0
        };
      })
      .sort((a, b) => b.width - a.width);

    return sources[0]?.url || src;
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

      removeSelectors.forEach(selector => {
        $(selector).remove();
      });

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

      // Replace all img tags with markdown syntax
      $content.find('img').each((_, img) => {
        const $img = $(img);
        const src = this.findBestImageUrl($img);
        if (src) {
          const alt = $img.attr('alt') || '';
          $img.replaceWith(`\n![${alt}](${src})\n`);
        }
      });

      // Convert HTML to Markdown
      const markdown = this.turndownService.turndown($content.html())
        .replace(/\n{3,}/g, '\n\n')  // Remove extra newlines
        .trim();

      // Extract metadata
      let metadata = null;
      if (options.includeMeta !== false) {
        try {
          metadata = await extractMetadata(url);
        } catch (error) {
          console.error('Metadata extraction failed:', error);
        }
      }

      // Combine metadata and markdown
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
