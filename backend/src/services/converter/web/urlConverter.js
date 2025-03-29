/**
 * URL Converter Module
 */

import puppeteer from 'puppeteer';
import path from 'path';
import { extractMetadata } from '../../../utils/metadataExtractor.js';
import { AppError } from '../../../utils/errorHandler.js';
import { 
  DEFAULT_URL_CONVERTER_OPTIONS, 
  IMAGE_EXTENSIONS 
} from './utils/config.js';
import { generateNameFromUrl, extractTitleFromUrl } from './utils/contentExtractor.js';
import { generateMarkdown, cleanMarkdown } from './utils/htmlToMarkdown.js';

// Browser instance cache to avoid launching multiple browsers
let browserInstance = null;

export class UrlConverter {
  constructor() {
    this.externalBrowser = null;
    this.shouldCloseBrowser = false;
  }
  
  async convertToMarkdown(url, options = {}) {
    console.log(`🔄 Converting URL to Markdown: ${url}`);
    
    let browser = null;
    let page = null;
    
    try {
      // Validate URL
      if (!url) {
        throw new AppError('URL is required', 400);
      }
      
      // Normalize URL if needed
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
      }
      
      // Merge options with defaults
      const mergedOptions = this.mergeOptions(options);
      
      // Get or create browser instance
      browser = await this.getBrowser(options.browser);
      
      // Create a new page
      page = await browser.newPage();
      
      // Set viewport
      await page.setViewport({ width: 1280, height: 800 });
      
      // Set user agent
      await page.setUserAgent(mergedOptions.got?.headers?.['User-Agent'] || 
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
      
      // Navigate to URL with timeout
      await page.goto(url, { 
        waitUntil: 'networkidle2',
        timeout: mergedOptions.got?.timeout || 30000
      });
      
      // Get the final URL after redirects
      const finalUrl = page.url();
      
      // Extract metadata if requested
      let metadata = {};
      if (mergedOptions.includeMeta) {
        // Extract metadata from page
        metadata = await this.extractMetadataFromPage(page, finalUrl);
      }
      
      // Extract content
      const { content, images } = await this.extractContent(page, finalUrl, mergedOptions);
      
      // Log content for debugging
      console.log(`Content length: ${content.length}`);
      console.log(`Content preview: ${content.substring(0, 200)}...`);
      
      // Generate Markdown
      const markdown = await generateMarkdown(content, metadata, images, finalUrl, mergedOptions);
      
      // Log markdown for debugging
      console.log(`Markdown length: ${markdown.length}`);
      console.log(`Markdown preview: ${markdown.substring(0, 200)}...`);
      
      // Generate a name for the file
      const name = this.generateName(finalUrl);
      
      return {
        content: markdown,
        name,
        url: finalUrl,
        metadata,
        images,
        success: true
      };
    } catch (error) {
      console.error('URL conversion failed:', error);
      throw new AppError(
        error instanceof AppError ? error.message : `Failed to convert URL: ${error.message}`,
        error instanceof AppError ? error.statusCode : 500
      );
    } finally {
      // Close the page but keep the browser instance
      if (page) {
        await page.close().catch(err => console.error('Error closing page:', err));
      }
    }
  }
  
  async getBrowser(externalBrowser = null) {
    // If an external browser is provided, use it
    if (externalBrowser) {
      this.externalBrowser = externalBrowser;
      return externalBrowser;
    }
    
    // If we already have an external browser, use it
    if (this.externalBrowser) {
      return this.externalBrowser;
    }
    
    // Otherwise, use or create the cached browser instance
    if (!browserInstance) {
      console.log('🌐 Launching new Puppeteer browser instance...');
      browserInstance = await puppeteer.launch({
        headless: 'new',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--disable-gpu',
          '--window-size=1280,800'
        ]
      });
      
      // Set up event listeners
      browserInstance.on('disconnected', () => {
        console.log('🌐 Browser disconnected, clearing instance');
        browserInstance = null;
      });
      
      this.shouldCloseBrowser = true;
    }
    
    return browserInstance;
  }
  
  mergeOptions(options) {
    // Default options
    const defaultOptions = {
      includeMeta: true,
      includeImages: true,
      handleDynamicContent: true,
      got: DEFAULT_URL_CONVERTER_OPTIONS.http,
      excludeSelectors: DEFAULT_URL_CONVERTER_OPTIONS.excludeSelectors,
      contentSelectors: DEFAULT_URL_CONVERTER_OPTIONS.contentSelectors,
      useBodyFallback: DEFAULT_URL_CONVERTER_OPTIONS.useBodyFallback,
      minContentLength: DEFAULT_URL_CONVERTER_OPTIONS.minContentLength
    };
    
    // Merge options, preserving any user-provided settings
    return {
      ...defaultOptions,
      ...options,
      got: {
        ...(defaultOptions.got || {}),
        ...(options.got || {}),
        headers: {
          ...(defaultOptions.got?.headers || {}),
          ...(options.got?.headers || {})
        }
      }
    };
  }
  
  async extractMetadataFromPage(page, url) {
    try {
      // Extract metadata using page.evaluate
      const pageMetadata = await page.evaluate(() => {
        try {
          const metadata = {};
          
          if (!document) {
            return metadata;
          }
          
          // Title
          metadata.title = document.title || '';
          
          // Description
          try {
            const descriptionMeta = document.querySelector('meta[name="description"]') || 
                                   document.querySelector('meta[property="og:description"]');
            metadata.description = descriptionMeta ? descriptionMeta.content : '';
          } catch (err) {
            metadata.description = '';
          }
          
          // Other metadata
          try {
            if (document.querySelectorAll) {
              const metaTags = Array.from(document.querySelectorAll('meta'));
              metaTags.forEach(meta => {
                if (!meta) return;
                
                try {
                  const name = meta.getAttribute('name') || meta.getAttribute('property');
                  const content = meta.getAttribute('content');
                  if (name && content) {
                    metadata[name.replace(/^og:/, '')] = content;
                  }
                } catch (err) {
                  // Skip this meta tag if there's an error
                }
              });
            }
          } catch (err) {
            console.error('Error processing meta tags:', err);
          }
          
          return metadata;
        } catch (error) {
          console.error('Error in metadata extraction:', error);
          return {};
        }
      });
      
      // Add URL and timestamp
      return {
        ...pageMetadata,
        source: url,
        site: new URL(url).hostname,
        captured: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error extracting metadata:', error);
      return {
        source: url,
        site: new URL(url).hostname,
        captured: new Date().toISOString()
      };
    }
  }
  
  /**
   * Clean up the page by removing unwanted elements
   * @param {Page} page - Puppeteer page object
   * @param {Object} options - Conversion options
   */
  async cleanupPage(page, options) {
    try {
      // Remove elements that should be excluded
      if (options.excludeSelectors?.length > 0) {
        await page.evaluate((selectors) => {
          for (const selector of selectors) {
            document.querySelectorAll(selector).forEach(el => el.remove());
          }
        }, options.excludeSelectors);
      }
      
      // Remove script tags and their content
      await page.evaluate(() => {
        const elementsToRemove = [
          'script',
          'style',
          'noscript',
          'iframe',
          '[id*="cookie"]',
          '[class*="cookie"]',
          '[id*="consent"]',
          '[class*="consent"]',
          '[id*="popup"]',
          '[class*="popup"]',
          '[id*="banner"]',
          '[class*="banner"]',
          '[id*="modal"]',
          '[class*="modal"]',
          '[id*="dialog"]',
          '[class*="dialog"]',
          '[id*="overlay"]',
          '[class*="overlay"]',
          '[id*="notification"]',
          '[class*="notification"]',
          '[class*="hs-"]',
          '[id*="hs-"]',
          '[data-hs-]'
        ];
        
        elementsToRemove.forEach(selector => {
          document.querySelectorAll(selector).forEach(el => el.remove());
        });
        
        // Remove inline JavaScript
        document.querySelectorAll('[onclick], [onload], [onunload], [onchange], [onsubmit], [onfocus], [onblur]').forEach(el => {
          el.removeAttribute('onclick');
          el.removeAttribute('onload');
          el.removeAttribute('onunload');
          el.removeAttribute('onchange');
          el.removeAttribute('onsubmit');
          el.removeAttribute('onfocus');
          el.removeAttribute('onblur');
        });
        
        // Remove empty elements (except for certain tags)
        const skipTags = ['BR', 'HR', 'IMG', 'INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'];
        document.querySelectorAll('*').forEach(el => {
          if (!skipTags.includes(el.tagName) && el.textContent.trim() === '' && !el.querySelector('img')) {
            el.remove();
          }
        });
      });
      
      // Clean up JavaScript variable assignments in HTML
      await page.evaluate(() => {
        try {
          // Find and remove script blocks that set window variables
          if (document && document.documentElement) {
            const html = document.documentElement.outerHTML;
            if (html) {
              const cleanedHtml = html.replace(/window\.__[^;]+;/g, '')
                                   .replace(/var\s+\w+\s*=\s*{[^}]+};/g, '')
                                   .replace(/const\s+\w+\s*=\s*{[^}]+};/g, '')
                                   .replace(/let\s+\w+\s*=\s*{[^}]+};/g, '');
              
              // This is a bit of a hack, but it works to clean up the HTML
              if (html !== cleanedHtml) {
                document.open();
                document.write(cleanedHtml);
                document.close();
              }
            }
          }
        } catch (error) {
          console.error('Error cleaning up HTML:', error);
          // Continue with extraction even if cleanup fails
        }
      });
    } catch (error) {
      console.error('Error cleaning up page:', error);
      // Continue with extraction even if cleanup fails
    }
  }
  
  async extractContent(page, baseUrl, options) {
    console.log(`📄 Extracting content from: ${baseUrl}`);
    
    try {
      // Get the raw HTML before any cleanup as a fallback
      const initialRawHtml = await page.content();
      console.log(`Initial raw HTML length: ${initialRawHtml.length}`);
      
      // First, clean up the page by removing unwanted elements
      await this.cleanupPage(page, options);
      
      // Get the raw HTML after cleanup as another fallback
      const cleanedRawHtml = await page.content();
      console.log(`Cleaned raw HTML length: ${cleanedRawHtml.length}`);
      
      // Find main content using selectors
      let content = '';
      let score = 0;
      let images = [];
      
      // Try a simpler approach first - just get the entire HTML
      content = cleanedRawHtml;
      
      // Only try the complex extraction if the simple approach didn't work well
      if (content.length < 1000) {
        console.log('Content is too short, trying complex extraction...');
        
        try {
          // Take a screenshot for debugging
          await page.screenshot({ path: 'debug-screenshot.png' });
          console.log('Saved debug screenshot to debug-screenshot.png');
          
          // Try to extract content using a more complex approach
          const result = await page.evaluate((selectors, minContentLength) => {
            try {
              // Helper function to clean an element before scoring
              const cleanElementForScoring = (element) => {
                if (!element) return null;
                
                try {
                  // Create a clone to avoid modifying the original
                  const clone = element.cloneNode(true);
                  
                  // Remove script, style, and other unwanted elements from the clone
                  const unwantedTags = ['script', 'style', 'noscript', 'iframe', 'svg', 'canvas'];
                  unwantedTags.forEach(tag => {
                    clone.querySelectorAll(tag).forEach(el => el.remove());
                  });
                  
                  // Remove elements with certain attributes
                  ['[onclick]', '[data-analytics]', '[data-tracking]'].forEach(selector => {
                    clone.querySelectorAll(selector).forEach(el => el.remove());
                  });
                  
                  // Remove empty elements
                  clone.querySelectorAll('*').forEach(el => {
                    if (el.textContent.trim() === '' && !el.querySelector('img') && el.tagName !== 'BR') {
                      el.remove();
                    }
                  });
                  
                  return clone;
                } catch (error) {
                  console.error('Error cleaning element:', error);
                  return element; // Return original if cleaning fails
                }
              };
              
              // Helper function to score an element
              const scoreElement = (element) => {
                if (!element) return 0;
                
                try {
                  // Clean the element before scoring
                  const cleanedElement = cleanElementForScoring(element);
                  if (!cleanedElement) return 0;
                  
                  const text = cleanedElement.textContent || '';
                  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
                  
                  // Skip elements with very little content
                  if (wordCount < 20) return 0;
                  
                  const paragraphCount = cleanedElement.querySelectorAll('p').length;
                  const headingCount = cleanedElement.querySelectorAll('h1, h2, h3, h4, h5, h6').length;
                  const imageCount = cleanedElement.querySelectorAll('img').length;
                  const linkCount = cleanedElement.querySelectorAll('a[href]').length;
                  const listItemCount = cleanedElement.querySelectorAll('li').length;
                  const tableCount = cleanedElement.querySelectorAll('table').length;
                  const htmlLength = cleanedElement.innerHTML?.length || 1;
                  const textDensity = text.length / htmlLength;
                  
                  let linkText = 0;
                  cleanedElement.querySelectorAll('a').forEach(link => {
                    linkText += link.textContent.length;
                  });
                  const linkDensity = linkText / (text.length || 1);
                  
                  // Penalize high link density
                  const linkPenalty = linkDensity > 0.5 ? -100 : 0;
                  
                  // Check for article semantic elements
                  const hasArticleTag = cleanedElement.tagName === 'ARTICLE' || 
                                      !!cleanedElement.closest('article');
                  const hasMainTag = cleanedElement.tagName === 'MAIN' || 
                                    !!cleanedElement.closest('main');
                  const semanticBonus = (hasArticleTag ? 100 : 0) + (hasMainTag ? 100 : 0);
                  
                  // Check for content indicators
                  const hasContentClass = cleanedElement.className.includes('content') || 
                                        cleanedElement.className.includes('article') ||
                                        cleanedElement.className.includes('post');
                  const contentClassBonus = hasContentClass ? 50 : 0;
                  
                  // Calculate base score
                  let score = paragraphCount * 15 + 
                            headingCount * 20 + 
                            imageCount * 5 + 
                            (linkCount * (1 - linkDensity)) +
                            wordCount * 0.5 +
                            listItemCount * 3 +
                            tableCount * 10 +
                            textDensity * 100 +
                            semanticBonus +
                            contentClassBonus +
                            linkPenalty;
                  
                  // Boost score for elements with more content
                  if (wordCount > 200) score += 50;
                  if (wordCount > 500) score += 100;
                  if (wordCount > 1000) score += 200;
                  
                  // Penalize elements that are likely navigation, headers, footers
                  if (cleanedElement.tagName === 'NAV' || 
                      cleanedElement.tagName === 'HEADER' || 
                      cleanedElement.tagName === 'FOOTER' ||
                      cleanedElement.className.includes('nav') ||
                      cleanedElement.className.includes('menu') ||
                      cleanedElement.className.includes('header') ||
                      cleanedElement.className.includes('footer')) {
                    score -= 500;
                  }
                  
                  return score;
                } catch (error) {
                  console.error('Error scoring element:', error);
                  return 0;
                }
              };
              
              let bestElement = null;
              let bestScore = 0;
              
              // Try each content selector in order
              for (const selector of selectors) {
                try {
                  const elements = document.querySelectorAll(selector);
                  if (elements.length > 0) {
                    for (const element of elements) {
                      const score = scoreElement(element);
                      if (score > bestScore) {
                        bestElement = element;
                        bestScore = score;
                      }
                    }
                    
                    // If we found a good content element, stop searching
                    if (bestScore > 150) break;
                  }
                } catch (e) {
                  // Ignore errors for individual selectors
                }
              }
              
              // If no content was found or content is too small, use body as fallback
              if (!bestElement || 
                  bestElement.textContent.trim().length < minContentLength || 
                  bestScore < 50) {
                
                // Try to find the main content area in the body
                const mainContent = document.querySelector('main') || 
                                  document.querySelector('article') || 
                                  document.querySelector('.content') ||
                                  document.querySelector('#content');
                
                if (mainContent) {
                  const mainScore = scoreElement(mainContent);
                  if (mainScore > bestScore) {
                    bestElement = mainContent;
                    bestScore = mainScore;
                  }
                }
                
                // If still no good content, use body as fallback
                if (!bestElement || bestScore < 30) {
                  bestElement = document.body;
                  bestScore = scoreElement(document.body);
                }
              }
              
              // Clean the selected element before returning
              const finalElement = cleanElementForScoring(bestElement);
              
              // Ensure we always return valid content even if cleaning removed too much
              let contentHtml = '';
              if (finalElement && finalElement.outerHTML) {
                contentHtml = finalElement.outerHTML;
              } else if (bestElement && bestElement.outerHTML) {
                contentHtml = bestElement.outerHTML;
              } else if (document.body && document.body.outerHTML) {
                contentHtml = document.body.outerHTML;
              } else if (document.documentElement && document.documentElement.outerHTML) {
                contentHtml = document.documentElement.outerHTML;
              } else {
                // Last resort fallback
                contentHtml = '<html><body><p>Failed to extract content</p></body></html>';
              }
              
              return { 
                content: contentHtml,
                score: bestScore
              };
            } catch (error) {
              console.error('Error in content extraction:', error);
              // Return a basic fallback if everything fails
              return { 
                content: document.documentElement ? document.documentElement.outerHTML : '<html><body><p>Failed to extract content</p></body></html>',
                score: 0
              };
            }
          }, options.contentSelectors, options.minContentLength);
          
          if (result && result.content && result.content.length > content.length) {
            console.log(`Complex extraction found better content (${result.content.length} bytes vs ${content.length} bytes)`);
            content = result.content;
            score = result.score;
          } else {
            console.log('Complex extraction did not find better content, using simple approach');
          }
        } catch (error) {
          console.error('Error in complex content extraction:', error);
          // Continue with the simple approach if the complex one fails
        }
      }
      
      // Extract images
      if (options.includeImages) {
        try {
          const extractedImages = await page.evaluate((baseUrl, imageExtensions) => {
            try {
              if (!document || !document.querySelectorAll) {
                return [];
              }
              
              return Array.from(document.querySelectorAll('img')).map(img => {
                if (!img) return null;
                
                try {
                  const src = img.src;
                  const alt = img.alt || '';
                  const title = img.title || alt;
                  
                  if (src) {
                    try {
                      const absoluteSrc = new URL(src, baseUrl).href;
                      const ext = absoluteSrc.split('?')[0].toLowerCase().split('.').pop();
                      
                      if (imageExtensions.includes(`.${ext}`)) {
                        return {
                          src: absoluteSrc,
                          alt,
                          title
                        };
                      }
                    } catch (e) {
                      // Ignore invalid URLs
                    }
                  }
                } catch (err) {
                  // Ignore errors for individual images
                }
                return null;
              }).filter(Boolean);
            } catch (error) {
              console.error('Error extracting images:', error);
              return [];
            }
          }, baseUrl, IMAGE_EXTENSIONS);
          
          if (Array.isArray(extractedImages)) {
            images = extractedImages;
          }
        } catch (error) {
          console.error('Error in image extraction:', error);
          // Continue without images if extraction fails
        }
      }
      
      // If content is still too short, use the initial raw HTML
      if (content.length < 1000 && initialRawHtml.length > content.length) {
        console.log(`Content is still too short, using initial raw HTML (${initialRawHtml.length} bytes)`);
        content = initialRawHtml;
      }
      
      return {
        content,
        images
      };
    } catch (error) {
      console.error('Error extracting content:', error);
      // Return empty content as a last resort
      return {
        content: '<html><body><p>Failed to extract content: ' + error.message + '</p></body></html>',
        images: []
      };
    }
  }
  
  generateName(url) {
    return generateNameFromUrl(url);
  }
  
  extractTitleFromUrl(url) {
    return extractTitleFromUrl(url);
  }
  
  // Instance method to close the browser instance
  async closeBrowser() {
    // Only close the browser if it's not an external one
    if (browserInstance && !this.externalBrowser) {
      await browserInstance.close();
      browserInstance = null;
    }
  }
  
  // Static method to close the browser instance
  static async closeBrowser() {
    if (browserInstance) {
      await browserInstance.close();
      browserInstance = null;
    }
  }
}

export async function convertUrlToMarkdown(url, options = {}) {
  const converter = new UrlConverter();
  return converter.convertToMarkdown(url, options);
}

export const urlConverter = {
  convertToMarkdown: async (url, options = {}) => {
    const converter = new UrlConverter();
    return converter.convertToMarkdown(url, options);
  },
  closeBrowser: UrlConverter.closeBrowser
};
