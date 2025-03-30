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
  
  /**
   * Removes annoying overlays, cookie notices, and popups
   */
  async removeOverlays(page) {
    try {
      await page.evaluate(() => {
        const overlayPatterns = [
          // Cookie-related
          '[id*="cookie" i]',
          '[class*="cookie" i]',
          '[id*="consent" i]',
          '[class*="consent" i]',
          // Popups and modals
          '[id*="popup" i]',
          '[class*="popup" i]',
          '[role="dialog"]',
          '[aria-modal="true"]',
          // Notifications and banners
          '[id*="banner" i]',
          '[class*="banner" i]',
          '[id*="notification" i]',
          '[class*="notification" i]',
          // Common overlay patterns
          '[class*="overlay" i]',
          '[id*="overlay" i]',
          // Newsletter and subscription
          '[class*="newsletter" i]',
          '[id*="newsletter" i]',
          '[class*="subscribe" i]',
          '[id*="subscribe" i]',
        ];

        overlayPatterns.forEach(pattern => {
          document.querySelectorAll(pattern).forEach(element => {
            // Check if it's likely an overlay
            const style = window.getComputedStyle(element);
            const position = style.position;
            const zIndex = parseInt(style.zIndex, 10);
            
            // Remove if it looks like an overlay
            if ((position === 'fixed' || position === 'absolute') && 
                (zIndex > 100 || element.matches('[role="dialog"]'))) {
              element.remove();
            }
          });
        });

        // Remove body classes that might prevent scrolling
        document.body.classList.forEach(className => {
          if (className.includes('modal-open') || 
              className.includes('no-scroll') || 
              className.includes('overflow-hidden')) {
            document.body.classList.remove(className);
          }
        });

        // Reset body styles
        document.body.style.overflow = '';
        document.body.style.position = '';
      });
    } catch (error) {
      console.error('Error removing overlays:', error);
    }
  }

  /**
   * Enhanced strategy for finding the main content
   */
  async findMainContent(page) {
    try {
      return await page.evaluate(() => {
        // Helper function to get text density
        const getTextDensity = (element) => {
          if (!element) return 0;
          const text = element.textContent || '';
          const html = element.innerHTML || '';
          return text.length / (html.length || 1);
        };

        // Helper function to get content value
        const getContentValue = (element) => {
          if (!element) return 0;
          
          const text = element.textContent || '';
          const words = text.split(/\s+/).filter(Boolean);
          
          // Skip empty or very short elements
          if (words.length < 20) return 0;
          
          // Count various content indicators
          const paragraphs = element.querySelectorAll('p');
          const headings = element.querySelectorAll('h1, h2, h3, h4, h5, h6');
          const lists = element.querySelectorAll('ul, ol');
          const codeBlocks = element.querySelectorAll('pre, code');
          const links = element.querySelectorAll('a');
          const images = element.querySelectorAll('img');
          
          // Calculate density scores
          const textDensity = getTextDensity(element);
          const linkDensity = Array.from(links).reduce((sum, link) => 
            sum + (link.textContent || '').length, 0) / (text.length || 1);
          
          // Calculate base score
          let score = 0;
          score += words.length * 0.3;
          score += paragraphs.length * 15;
          score += headings.length * 20;
          score += lists.length * 10;
          score += codeBlocks.length * 15;
          score += images.length * 5;
          score += textDensity * 100;
          score -= linkDensity * 50;
          
          // Semantic meaning bonuses
          if (element.tagName === 'ARTICLE' || element.closest('article')) score += 150;
          if (element.tagName === 'MAIN' || element.closest('main')) score += 150;
          if (element.getAttribute('role') === 'main') score += 100;
          
          // Content-related class bonuses
          const className = element.className || '';
          if (/content|article|post|entry|body/i.test(className)) score += 50;
          
          // Penalize navigation, header, footer areas
          if (/nav|header|footer|menu|sidebar/i.test(className) || 
              /nav|header|footer/i.test(element.tagName)) {
            score -= 200;
          }
          
          // Bonus for deep article structure
          if (element.querySelectorAll('article p').length > 3) score += 100;
          
          return score;
        };

        // Find best content element
        const allElements = document.querySelectorAll('body *');
        let bestElement = null;
        let bestScore = 0;

        allElements.forEach(element => {
          const score = getContentValue(element);
          if (score > bestScore) {
            bestElement = element;
            bestScore = score;
          }
        });

        // Return the best content found
        return {
          content: bestElement ? bestElement.outerHTML : document.body.outerHTML,
          score: bestScore
        };
      });
    } catch (error) {
      console.error('Error finding main content:', error);
      return { content: '', score: 0 };
    }
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
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
      
      // Navigate to URL with timeout and wait for content
      await page.goto(url, { 
        waitUntil: 'networkidle2',
        timeout: mergedOptions.got?.timeout || 30000
      });
      
      // Get the final URL after redirects
      const finalUrl = page.url();
      
      // Extract metadata if requested
      let metadata = {};
      if (mergedOptions.includeMeta) {
        metadata = await this.extractMetadataFromPage(page, finalUrl);
      }
      
      // Wait for dynamic content and remove overlays
      await this.removeOverlays(page);
      await page.waitForTimeout(1000); // Brief pause for any remaining dynamics
      
      // Extract content
      const { content, images } = await this.extractContent(page, finalUrl, mergedOptions);
      
      // Log content size for debugging
      console.log(`Content length: ${content.length}`);
      
      // Generate Markdown
      const markdown = await generateMarkdown(content, metadata, images, finalUrl, mergedOptions);
      
      // Log markdown size for debugging
      console.log(`Markdown length: ${markdown.length}`);
      
      // Generate file name
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
      if (page) {
        await page.close().catch(err => console.error('Error closing page:', err));
      }
    }
  }
  
  async getBrowser(externalBrowser = null) {
    if (externalBrowser) {
      this.externalBrowser = externalBrowser;
      return externalBrowser;
    }
    
    if (this.externalBrowser) {
      return this.externalBrowser;
    }
    
    if (!browserInstance) {
      console.log('🌐 Launching new Puppeteer browser instance...');
      browserInstance = await puppeteer.launch({
        headless: 'new',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-blink-features=AutomationControlled',
          '--disable-infobars',
          '--window-size=1920,1080'
        ],
        defaultViewport: {
          width: 1920,
          height: 1080,
          deviceScaleFactor: 1,
          isMobile: false,
          hasTouch: false,
          isLandscape: true
        }
      });
      
      browserInstance.on('disconnected', () => {
        console.log('🌐 Browser disconnected, clearing instance');
        browserInstance = null;
      });
      
      this.shouldCloseBrowser = true;
    }
    
    return browserInstance;
  }
  
  mergeOptions(options) {
    return {
      ...DEFAULT_URL_CONVERTER_OPTIONS,
      ...options,
      got: {
        ...(DEFAULT_URL_CONVERTER_OPTIONS.http || {}),
        ...(options.got || {}),
        headers: {
          ...(DEFAULT_URL_CONVERTER_OPTIONS.http?.headers || {}),
          ...(options.got?.headers || {})
        },
        timeout: {
          ...(DEFAULT_URL_CONVERTER_OPTIONS.http?.timeout || {}),
          ...(options.got?.timeout || {})
        }
      }
    };
  }
  
  async extractMetadataFromPage(page, url) {
    // ... (unchanged extractMetadataFromPage method)
  }
  
  async cleanupPage(page, options) {
    // ... (unchanged cleanupPage method)
  }
  
  async extractContent(page, baseUrl, options) {
    console.log(`📄 Extracting content from: ${baseUrl}`);
    
    try {
      // Get initial state
      const initialRawHtml = await page.content();
      console.log(`Initial raw HTML length: ${initialRawHtml.length}`);
      
      // Remove overlays and cookie notices first
      await this.removeOverlays(page);
      
      // General cleanup
      await this.cleanupPage(page, options);
      
      // Get cleaned state
      const cleanedRawHtml = await page.content();
      console.log(`Cleaned raw HTML length: ${cleanedRawHtml.length}`);
      
      let content = '';
      let score = 0;
      let images = [];

      // Try enhanced content detection first
      try {
        const result = await this.findMainContent(page);
        if (result.content && result.score > 50) {
          content = result.content;
          score = result.score;
          console.log(`Found main content with score: ${score}`);
        }
      } catch (e) {
        console.error('Error in main content detection:', e);
      }

      // If no good content found, try fallback approaches
      if (!content || content.length < 1000 || score < 30) {
        console.log('Content too short or low quality, using fallback content');
        content = cleanedRawHtml;
      }
      
      // Extract images if requested
      if (options.includeImages) {
        images = await this.extractImages(page, baseUrl);
      }
      
      return { content, images };
    } catch (error) {
      console.error('Error extracting content:', error);
      return {
        content: `<html><body><p>Failed to extract content: ${error.message}</p></body></html>`,
        images: []
      };
    }
  }

  async extractImages(page, baseUrl) {
    try {
      return await page.evaluate((baseUrl, imageExtensions) => {
        if (!document || !document.querySelectorAll) return [];
        
        return Array.from(document.querySelectorAll('img'))
          .filter(img => {
            try {
              const src = img.src;
              if (!src) return false;
              const url = new URL(src, baseUrl);
              const ext = url.pathname.split('.').pop().toLowerCase();
              return imageExtensions.includes(`.${ext}`);
            } catch (e) {
              return false;
            }
          })
          .map(img => ({
            src: new URL(img.src, baseUrl).href,
            alt: img.alt || '',
            title: img.title || img.alt || ''
          }));
      }, baseUrl, IMAGE_EXTENSIONS);
    } catch (error) {
      console.error('Error extracting images:', error);
      return [];
    }
  }
  
  generateName(url) {
    return generateNameFromUrl(url);
  }
  
  extractTitleFromUrl(url) {
    return extractTitleFromUrl(url);
  }
  
  async closeBrowser() {
    if (browserInstance && !this.externalBrowser) {
      await browserInstance.close();
      browserInstance = null;
    }
  }
  
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
