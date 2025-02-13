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
    timeout: 30000,
    headers: {
      'accept': 'text/html,application/xhtml+xml',
      'accept-encoding': 'gzip, deflate',
      'accept-language': 'en-US,en;q=0.9',
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    }
  },
  conversion: {
    maxImages: 50,
    imageTypes: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'ico']
  }
};

class UrlConverter {
  constructor() {
    this.turndownService = new TurndownService({
      headingStyle: 'atx',
      bulletListMarker: '-',
      codeBlockStyle: 'fenced'
    });

    // Add rules for tables and code blocks
    this.turndownService.addRule('tables', {
      filter: ['table'],
      replacement: (content) => content + '\n\n'
    });

    this.turndownService.addRule('codeBlocks', {
      filter: ['pre'],
      replacement: (content, node) => {
        const language = node.getAttribute('class')?.replace('language-', '') || '';
        return `\n\`\`\`${language}\n${content}\n\`\`\`\n`;
      }
    });
  }

  async convertToMarkdown(url, options = {}) {
    try {
      // Fetch content
      const response = await got(url, CONFIG.http);
      const $ = cheerio.load(response.body);
      
      // Find main content area
      const contentSelectors = [
        'article', 'main', 'div[role="main"]',
        '.post-content', '.entry-content', '.article-content',
        '.markdown-body', '.docs-content', '.documentation',
        '.story-content', '.content', '.main'
      ];

      let $content = null;
      for (const selector of contentSelectors) {
        const $found = $(selector).first();
        if ($found.length && $found.text().trim().length > 100) {
          $content = $found;
          break;
        }
      }

      $content = $content || $('body');

      // Remove unwanted elements
      const removeSelectors = [
        'script', 'style', 'header', 'footer', 'nav',
        'iframe', 'noscript', '.ad', '.comments', '.social-share', 
        '.sidebar', '.navigation', '.menu', '.widget',
        '.popup', '.modal', '.overlay', '.newsletter'
      ];

      removeSelectors.forEach(selector => {
        $content.find(selector).remove();
      });

      // Process images
      const images = [];
      const domain = new URL(url).hostname;

      if (options.includeImages !== false) {
        $content.find('img').each((_, img) => {
          const $img = $(img);
          const src = $img.attr('src');
          if (!src) return;

          try {
            const imageUrl = new URL(src, url).href;
            const hash = require('crypto')
              .createHash('md5')
              .update(imageUrl)
              .digest('hex')
              .slice(0, 8);
            
            const ext = imageUrl.split('.').pop()?.toLowerCase() || 'jpg';
            const imageName = `image-${hash}.${ext}`;
            
            if (CONFIG.conversion.imageTypes.includes(ext)) {
              $img.replaceWith(`![[${imageName}]]`);
              
              images.push({
                url: imageUrl,
                name: `web/${domain}/assets/${imageName}`,
                type: `image/${ext}`,
                metadata: {
                  originalUrl: imageUrl,
                  alt: $img.attr('alt') || undefined,
                  dateAdded: new Date().toISOString()
                }
              });
            }
          } catch (error) {
            console.error('Image processing error:', error);
          }
        });
      }

      // Convert to markdown
      const markdown = this.turndownService.turndown($content.html());

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
        images,
        success: true,
        name: options.originalName || domain,
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
