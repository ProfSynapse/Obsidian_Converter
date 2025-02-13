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
    imageTypes: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'ico']
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
      
      // Content selection rules - from most specific to most general
      const contentSelectors = {
        article: [
          'article[class*="post"]', 'article[class*="content"]', 'article[class*="entry"]',
          'article[id*="post"]', 'article[id*="content"]', 'article',
          '[role="article"]', '[typeof="Article"]'
        ],
        blog: [
          '.post-content', '.entry-content', '.article-content', '.blog-content',
          '.post-body', '.entry-body', '.article-body', '.blog-post',
          '.blog-entry', '.post-entry', '.single-post'
        ],
        docs: [
          '.markdown-body', '.readme', '.documentation', '.docs-content',
          '.wiki-content', '.document-content', '.help-content',
          '[role="document"]', '[role="documentation"]'
        ],
        news: [
          '.story-content', '.news-content', '.article-text', '.story-body',
          '.news-article', '.article-body', '.story', '.news-body'
        ],
        main: [
          'main[role="main"]', 'div[role="main"]', 'main', '#main-content',
          '#mainContent', '.main-content', '.maincontent', '[role="main"]'
        ],
        cms: [
          '.node-content', '.page-content', '.site-content', '.cms-content',
          '.contentBody', '.page-body', '.wysiwyg-content', '.editor-content',
          '[data-content]', '[data-content-area]'
        ],
        forum: [
          '.thread-content', '.forum-post', '.message-content', '.post-message',
          '.forum-content', '.thread-body', '.message-body', '.forum-message'
        ],
        common: [
          '#content', '.content', '[class*="content-"]', '[id*="content-"]',
          '[class*="-content"]', '[id*="-content"]', '.text', '.body'
        ]
      };

      // Initialize content container
      const $contentParts = $('<div></div>');

      // Initialize content collection with a wrapper
      const $wrapper = $('<div class="content-wrapper"></div>');
      let foundContent = false;

      // Track processed elements to avoid duplicates
      const processedNodes = new Set();
      
      // First pass: Find specific content sections
      for (const [category, selectors] of Object.entries(contentSelectors)) {
        for (const selector of selectors) {
          $(selector).each((_, element) => {
            // Skip if we've already processed this node
            if (processedNodes.has(element)) return;
            
            const $element = $(element);
            // Skip empty sections
            if (!$element.text().trim()) return;
            
            foundContent = true;
            processedNodes.add(element);
            
            // Add section with category marker
            const $section = $('<div></div>')
              .addClass(`section-${category}`)
              .append($element.clone());
            
            $wrapper.append($section);
            console.log(`Found content in ${category}: ${selector}`);
          });
        }
      }

      // If no content found through selectors, try other approaches
      if (!foundContent) {
        console.log('No specific content found, looking for article content');

        // First, look for divs with significant text content
        const possibleContentDivs = new Map(); // Map to store div scores
        $('div').each((_, div) => {
          const $div = $(div);
          const paragraphs = $div.find('p');
          if (paragraphs.length < 2) return; // Skip divs with few paragraphs

          // Score based on content indicators
          let score = 0;
          score += paragraphs.length * 2;
          score += $div.find('h1, h2, h3, h4, h5, h6').length * 3;
          score += $div.find('ul, ol').length * 2;
          score += $div.find('blockquote').length * 2;
          score -= $div.find('script, style, iframe').length * 5;
          score -= $div.find('.ad, .share, .social').length * 3;

          // Additional scoring based on div characteristics
          const id = $div.attr('id') || '';
          const className = $div.attr('class') || '';
          if (/(article|content|post|entry|text|body)/i.test(id)) score += 5;
          if (/(article|content|post|entry|text|body)/i.test(className)) score += 5;
          if (/(header|footer|nav|sidebar|widget)/i.test(id)) score -= 5;
          if (/(header|footer|nav|sidebar|widget)/i.test(className)) score -= 5;

          // Store score if significant
          if (score > 5) {
            possibleContentDivs.set(div, score);
          }
        });

        // Sort divs by score and process top scoring ones
        const sortedDivs = Array.from(possibleContentDivs.entries())
          .sort((a, b) => b[1] - a[1]);

        if (sortedDivs.length > 0) {
          console.log('Found content divs:', sortedDivs.length);
          sortedDivs.slice(0, 3).forEach(([div, score]) => {
            console.log(`Processing div with score ${score}`);
            const $div = $(div);
            foundContent = true;
            $wrapper.append($div.clone());
          });
        }

        // If still no content, look for individual content elements
        if (!foundContent) {
          $('body').find('p, h1, h2, h3, h4, h5, h6, ul, ol, blockquote').each((_, element) => {
            const $element = $(element);
            const $parent = $element.parent();
            
            // Skip elements in unwanted sections
            if ($parent.is('header, footer, nav, aside, .sidebar')) return;
            
            // Check if element has meaningful content
            const text = $element.text().trim();
            if (text && text.length >= 2) {
              foundContent = true;
              $wrapper.append($element.clone());
            }
          });
        }
      }

      // Last resort: Use body content
      const $content = foundContent ? $wrapper : $('body');
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
      if (options.includeImages !== false) {
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

            // Replace entire link+image structure with markdown
            if (targetUrl && targetUrl !== imageUrl) {
              // Image is linked to something else
              $link.replaceWith(`[![${alt}](${imageUrl})](${targetUrl})`);
            } else {
              // Image links to itself or no link
              $link.replaceWith(`![${alt}](${imageUrl})`);
            }

            // Track image reference
            imageRefs.push({
              url: imageUrl,
              alt: alt || undefined,
              linkedTo: targetUrl || undefined,
              referenceUrl: url,
              addedAt: new Date().toISOString()
            });
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

            // Replace with standard markdown image
            $img.replaceWith(`![${alt}](${imageUrl})`);
            
            // Track image reference
            imageRefs.push({
              url: imageUrl,
              alt: alt || undefined,
              referenceUrl: url,
              addedAt: new Date().toISOString()
            });
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
