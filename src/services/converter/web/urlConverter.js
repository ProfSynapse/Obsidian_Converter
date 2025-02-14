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

    this.addCustomRules();
  }

  addCustomRules() {
    // Table handling
    this.turndownService.addRule('tables', {
      filter: ['table'],
      replacement: (content, node) => {
        // Parse table structure
        const table = [];
        const rows = node.querySelectorAll('tr');
        
        rows.forEach((row) => {
          const cells = Array.from(row.querySelectorAll('th, td')).map(cell => 
            cell.textContent.trim().replace(/\|/g, '\\|')
          );
          table.push(cells);
        });

        if (table.length === 0) return '';

        // Create markdown table
        const header = table[0];
        const separator = header.map(() => '---');
        const body = table.slice(1);

        const markdownRows = [
          `| ${header.join(' | ')} |`,
          `| ${separator.join(' | ')} |`,
          ...body.map(row => `| ${row.join(' | ')} |`)
        ];

        return `\n\n${markdownRows.join('\n')}\n\n`;
      }
    });

    // Code block handling with language detection
    this.turndownService.addRule('codeBlocks', {
      filter: ['pre', 'code'],
      replacement: (content, node) => {
        const language = node.getAttribute('class')?.match(/language-(\w+)/)?.[1] || 
                        node.getAttribute('data-language') || 
                        node.getAttribute('lang') || 
                        '';
        const code = content.trim();
        return `\n\`\`\`${language}\n${code}\n\`\`\`\n`;
      }
    });

    // Quote block handling
    this.turndownService.addRule('blockquotes', {
      filter: ['blockquote'],
      replacement: (content) => {
        const lines = content.trim().split('\n');
        return `\n\n${lines.map(line => `> ${line}`).join('\n')}\n\n`;
      }
    });

    // List handling
    this.turndownService.addRule('lists', {
      filter: ['ul', 'ol'],
      replacement: (content, node) => {
        const isOrdered = node.nodeName.toLowerCase() === 'ol';
        const listItems = content.trim().split('\n');
        const prefix = isOrdered ? '1. ' : '- ';
        
        return `\n\n${listItems.map(item => `${prefix}${item.trim()}`).join('\n')}\n\n`;
      }
    });

    // Definition list handling
    this.turndownService.addRule('definitionLists', {
      filter: ['dl'],
      replacement: (content, node) => {
        const terms = [];
        Array.from(node.children).forEach((child) => {
          if (child.nodeName === 'DT') {
            terms.push(`\n**${child.textContent.trim()}**`);
          } else if (child.nodeName === 'DD') {
            terms.push(`: ${child.textContent.trim()}`);
          }
        });
        return `\n\n${terms.join('\n')}\n\n`;
      }
    });

    // Preserve line breaks
    this.turndownService.addRule('lineBreaks', {
      filter: ['br'],
      replacement: () => '\n'
    });

    // Handle text alignment
    this.turndownService.addRule('textAlignment', {
      filter: (node) => {
        const style = node.getAttribute('style') || '';
        return style.includes('text-align');
      },
      replacement: (content, node) => {
        const style = node.getAttribute('style') || '';
        const alignment = style.match(/text-align:\s*(\w+)/)?.[1];
        
        if (alignment === 'center') {
          return `\n\n<div align="center">\n\n${content}\n\n</div>\n\n`;
        } else if (alignment === 'right') {
          return `\n\n<div align="right">\n\n${content}\n\n</div>\n\n`;
        }
        return content;
      }
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
        },
        timeout: {
          ...CONFIG.http.timeout,
          ...(options.got?.timeout || {})
        },
        retry: {
          ...CONFIG.http.retry,
          ...(options.got?.retry || {})
        }
      };

      // Fetch content
      const response = await got(url, gotOptions);
      const $ = cheerio.load(response.body);
      
      // Track if we found meaningful content
      let foundContent = false;

      // First remove obvious non-content elements
      console.log('Removing non-content elements...');
      const removeInitial = [
        'script', 'style', 'link', 'meta', 'noscript',
        '.cookie-banner', '.gdpr-notice', '.ads',
        'header nav', 'footer nav', '.social-share'
      ];
      removeInitial.forEach(selector => {
        $(selector).remove();
      });

      // Keep a copy of the full body for fallback
      const $fullBody = $('body').clone();

      // Try to find the main content container
      console.log('Looking for main content container...');
      let $mainContent = null;
      const mainSelectors = [
        'main',
        'article',
        '[role="main"]',
        '[role="article"]',
        '.post-content',
        '.article-content',
        '.entry-content',
        '.content',
        '#content',
        '#main'
      ];

      for (const selector of mainSelectors) {
        const $found = $(selector).first();
        if ($found.length && $found.text().trim().length > 100) {
          console.log(`Found main content using selector: ${selector}`);
          $mainContent = $found;
          break;
        }
      }

      // If no main content found, try looking for the largest content div
      if (!$mainContent) {
        console.log('No main content found, looking for largest content block...');
        let maxLength = 0;
        let bestDiv = null;

        $('div').each((_, div) => {
          const $div = $(div);
          // Skip obvious non-content divs
          if ($div.closest('header, footer, nav, aside, [role="complementary"]').length) return;
          
          const text = $div.text().trim();
          if (text.length > maxLength && 
              $div.find('p, h1, h2, h3, h4, h5, h6').length > 0) {
            maxLength = text.length;
            bestDiv = div;
          }
        });

        if (bestDiv) {
          console.log('Found largest content block');
          $mainContent = $(bestDiv);
        }
      }

      // Create fresh wrapper and copy content
      const $wrapper = $('<div class="content-wrapper"></div>');

      if ($mainContent) {
        // Keep original structure but clean it up
        console.log('Processing main content...');
        const $cleanContent = $mainContent.clone();
        
        // Remove unwanted nested elements
        $cleanContent.find('header, footer, nav, aside, .sidebar, .widget, .comments').remove();
        
        // Move any remaining headings and content to wrapper
        $wrapper.append($cleanContent);
        foundContent = true;
      } else {
        // Fallback to body content after cleaning
        console.log('No main content found, using cleaned body...');
        const $cleanBody = $fullBody.clone();
        $cleanBody.find('header, footer, nav, aside, .sidebar, .widget, .comments').remove();
        $wrapper.append($cleanBody.children());
        foundContent = $wrapper.text().trim().length > 100;
      }

      const $content = $wrapper;

      // Log what we found
      if (foundContent) {
        console.log('Content found. Length:', $content.text().trim().length);
      } else {
        console.log('No meaningful content found');
      }
      console.log(`Content found: ${foundContent ? 'YES' : 'NO - using body'}`);

      // Clean up content structure
      const unwantedSelectors = [
        // Essential removals
        'script', 'style', 'link', 'meta', 'noscript',
        
        // Navigation elements
        'header', 'footer', 'nav', '.navigation', '.menu', '[role="navigation"]',
        '[role="banner"]', '[role="contentinfo"]', '.breadcrumb', '.pagination',

        // Sidebars and supplementary content
        'aside', '.sidebar', '.widget', '[role="complementary"]',
        '.related', '.recommendations', '.suggested', '.popular',

        // Social and interactive elements
        '.social-share', '.share-buttons', '.social-media',
        '.comments', '.disqus', '#disqus_thread', '.reactions',

        // Ads and promotional content
        '.ad', '.advertisement', '.sponsored', '.promotions',
        '[class*="advert"]', '[id*="advert"]', '[class*="promo"]',

        // Popups and overlays
        '.popup', '.modal', '.overlay', '.newsletter-signup',
        '[class*="popup"]', '[id*="popup"]', '.subscribe',

        // Cookie notices and banners
        '.cookie-notice', '.cookie-banner', '.gdpr',
        '[class*="cookie"]', '[id*="cookie"]',

        // Dynamic content placeholders
        '[aria-hidden="true"]', '.hidden', '.invisible',
        '.loading', '.placeholder', '.skeleton'
      ];

      // Remove unwanted elements
      unwantedSelectors.forEach(selector => {
        $content.find(selector).remove();
      });

      // Transform common elements
      $content.find('div[class*="title"], div[class*="heading"]').each((_, el) => {
        const $el = $(el);
        const level = $el.parents().length > 5 ? 3 : 2;
        $el.replaceWith(`<h${level}>${$el.text()}</h${level}>`);
      });

      // Handle dynamic content containers
      $content.find('[data-component], [data-module], [data-widget]').each((_, el) => {
        const $el = $(el);
        const text = $el.text().trim();
        if (text) {
          $el.replaceWith(`<div>${text}</div>`);
        } else {
          $el.remove();
        }
      });

      // Ensure proper spacing around headings
      $content.find('h1, h2, h3, h4, h5, h6').each((_, el) => {
        const $el = $(el);
        $el.before('\n\n');
        $el.after('\n');
      });

      // Pre-process images and their containers
      const imageRefs = [];
      const processedUrls = new Set();
      
      if (options.includeImages !== false) {
        // Helper function to sanitize image filename
        const sanitizeImageFilename = (url) => {
          try {
            const urlObj = new URL(url);
            const filename = urlObj.pathname.split('/').pop() || 'image';
            return filename
              .replace(/[^a-zA-Z0-9.-]/g, '-')
              .replace(/^-+|-+$/g, '')
              .toLowerCase();
          } catch (e) {
            return 'image';
          }
        };

        // Helper function to process image
        const processImage = ($img, parentUrl = null) => {
          // Get all possible image sources
          const srcs = [
            $img.attr('src'),
            ...CONFIG.conversion.lazyLoadAttrs.map(attr => $img.attr(attr))
          ].filter(Boolean);

          if (srcs.length === 0) return null;

          // Find first valid image source
          for (const src of srcs) {
            try {
              const cleanSrc = src
                .replace(/\s+/g, '')
                .replace(/['"]/g, '')
                .split('#')[0]
                .split('?')[0];

              if (cleanSrc.startsWith('data:')) continue;

              const imageUrl = new URL(cleanSrc, url).href;
              
              // Skip if already processed or matches exclude patterns
              if (processedUrls.has(imageUrl) || 
                  CONFIG.conversion.excludePatterns.some(pattern => pattern.test(imageUrl))) {
                continue;
              }

              const ext = imageUrl.split('.').pop()?.toLowerCase() || '';
              if (!ext || !CONFIG.conversion.imageTypes.includes(ext)) continue;

              processedUrls.add(imageUrl);

              const alt = $img.attr('alt') || '';
              const filename = sanitizeImageFilename(imageUrl);
              
              // Return image data
              return {
                url: imageUrl,
                alt: alt || undefined,
                filename,
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

        // First, handle images that are inside links
        $content.find('a > img').each((_, img) => {
          const $img = $(img);
          const $link = $img.parent('a');
          const src = $img.attr('src');
          const alt = $img.attr('alt') || '';
          const href = $link.attr('href');

          if (!src) return;

          try {
            // Clean image source
            const cleanSrc = src
              .replace(/\s+/g, '') // Remove whitespace
              .replace(/['"]/g, '') // Remove quotes
              .split('#')[0]       // Remove fragment
              .split('?')[0];      // Remove query string

            // Handle data URIs
            if (cleanSrc.startsWith('data:')) {
              return; // Skip data URIs
            }

            // Handle relative and protocol-relative URLs
            const imageUrl = new URL(cleanSrc, url).href;
            const ext = imageUrl.split('.').pop()?.toLowerCase() || '';
            
            if (!ext || !CONFIG.conversion.imageTypes.includes(ext)) return;

            // Clean href URL if present
            const cleanHref = href ? href
              .replace(/\s+/g, '')
              .replace(/['"]/g, '')
              .split('#')[0]
              .split('?')[0] : null;

            const targetUrl = cleanHref ? new URL(cleanHref, url).href : null;

            const imageData = processImage($img, targetUrl);
            if (imageData) {
              // Replace with Obsidian format
              if (targetUrl && targetUrl !== imageData.url) {
                $link.replaceWith(`[![${imageData.alt}](![[${imageData.filename}]])](${targetUrl})`);
              } else {
                $link.replaceWith(`![[${imageData.filename}]]`);
              }
              imageRefs.push(imageData);
            }
          } catch (error) {
            console.error('Linked image processing error:', error);
          }
        });

        // Then handle standalone images
        $content.find('img').not('a > img').each((_, img) => {
          const $img = $(img);
          const src = $img.attr('src');
          const alt = $img.attr('alt') || '';
          
          if (!src) return;

          try {
            // Clean image source
            const cleanSrc = src
              .replace(/\s+/g, '') // Remove whitespace
              .replace(/['"]/g, '') // Remove quotes
              .split('#')[0]       // Remove fragment
              .split('?')[0];      // Remove query string

            // Handle data URIs
            if (cleanSrc.startsWith('data:')) {
              return; // Skip data URIs
            }

            // Handle relative and protocol-relative URLs
            const imageUrl = new URL(cleanSrc, url).href;
            const ext = imageUrl.split('.').pop()?.toLowerCase() || '';
            
            if (!ext || !CONFIG.conversion.imageTypes.includes(ext)) return;

            const imageData = processImage($img);
            if (imageData) {
              // Replace with Obsidian format
              $img.replaceWith(`![[${imageData.filename}]]`);
              imageRefs.push(imageData);
            }
          } catch (error) {
            console.error('Standalone image processing error:', error);
          }
        });
      }

      // Clean up duplicate content before conversion
      const textNodes = new Set();
      const duplicateNodes = new Set();

      // Find duplicate text content
      $content.find('*').each((_, element) => {
        const $el = $(element);
        const text = $el.text().trim();
        if (text.length > 50) { // Only check substantial content
          if (textNodes.has(text)) {
            duplicateNodes.add(element);
          } else {
            textNodes.add(text);
          }
        }
      });

      // Remove duplicate nodes
      duplicateNodes.forEach(node => {
        $(node).remove();
      });

      // Ensure proper whitespace around block elements
      $content.find('p, div, h1, h2, h3, h4, h5, h6, ul, ol, blockquote, table').each((_, el) => {
        const $el = $(el);
        const prevText = $el.prev().text().trim();
        const nextText = $el.next().text().trim();
        
        if (prevText) $el.before('\n');
        if (nextText) $el.after('\n');
      });

      // Convert to markdown
      const markdown = this.turndownService.turndown($content.html())
        .replace(/\n{3,}/g, '\n\n') // Remove excessive newlines
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
