/**
 * URL Converter Module
 * 
 * Converts URLs to Markdown format with robust content extraction.
 * This module handles the conversion of web pages to Markdown format,
 * including content extraction, image processing, and metadata handling.
 * 
 * Related files:
 * - ../../../utils/metadataExtractor.js: Extracts metadata from web pages
 * - ../parentUrlConverter.js: Handles conversion of entire websites
 * - ./utils/spaHandler.js: Handles SPA detection and content loading
 * - ./utils/contentExtractor.js: Extracts content from HTML
 * - ./utils/htmlToMarkdown.js: Converts HTML to Markdown
 * - ./utils/config.js: Configuration settings
 */

import got from 'got';
import * as cheerio from 'cheerio';
import path from 'path';
import { JSDOM } from 'jsdom';
import { extractMetadata, formatMetadata } from '../../../utils/metadataExtractor.js';
import { AppError } from '../../../utils/errorHandler.js';
import { 
  DEFAULT_URL_CONVERTER_OPTIONS, 
  IMAGE_EXTENSIONS 
} from './utils/config.js';
import { fetchPageWithSPAHandling } from './utils/spaHandler.js';
import { extractContent, generateNameFromUrl, extractTitleFromUrl } from './utils/contentExtractor.js';
import { generateMarkdown, htmlToMarkdown, cleanMarkdown } from './utils/htmlToMarkdown.js';

/**
 * URL Converter class for converting URLs to Markdown
 */
export class UrlConverter {
  /**
   * Converts a URL to Markdown
   * @param {string} url - The URL to convert
   * @param {Object} options - Conversion options
   * @returns {Promise<Object>} - The conversion result
   */
  async convertToMarkdown(url, options = {}) {
    console.log(`🔄 Converting URL to Markdown: ${url}`);
    
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
      
      // Fetch the page content
      const { html, finalUrl } = await this.fetchPage(url, mergedOptions);
      
      // Extract metadata if requested
      let metadata = {};
      if (mergedOptions.includeMeta) {
        metadata = await extractMetadata(finalUrl);
      }
      
      // Extract content
      const { content, images } = await this.extractContent(html, finalUrl, mergedOptions);
      
      // Generate Markdown
      const markdown = await this.generateMarkdown(content, metadata, images, finalUrl, mergedOptions);
      
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
    }
  }
  
  /**
   * Merges user options with defaults
   * @param {Object} options - User-provided options
   * @returns {Object} - Merged options
   */
  mergeOptions(options) {
    // Default options
    const defaultOptions = {
      includeMeta: true,
      includeImages: true,
      handleDynamicContent: true,
      got: DEFAULT_URL_CONVERTER_OPTIONS.http,
      excludeSelectors: DEFAULT_URL_CONVERTER_OPTIONS.excludeSelectors,
      contentSelectors: DEFAULT_URL_CONVERTER_OPTIONS.contentSelectors
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
  
  /**
   * Fetches a web page with enhanced handling for dynamic content
   * @param {string} url - The URL to fetch
   * @param {Object} options - Fetch options
   * @returns {Promise<{html: string, finalUrl: string}>} - The page HTML and final URL
   */
  async fetchPage(url, options) {
    console.log(`📥 Fetching page: ${url}`);
    
    try {
      // Create a clean options object for got
      const gotOptions = {
        headers: options.got.headers,
        timeout: options.got.timeout,
        retry: options.got.retry,
        decompress: options.got.decompress,
        responseType: options.got.responseType,
        followRedirect: true,
        throwHttpErrors: false
      };
      
      // Add a random query parameter to avoid caching
      gotOptions.searchParams = {
        '_': Date.now()
      };
      
      // Fetch the page
      const response = await got(url, gotOptions);
      
      // Check for errors
      if (response.statusCode >= 400) {
        throw new AppError(`Failed to fetch URL: ${response.statusCode}`, 400);
      }
      
      // Get the final URL after any redirects
      const finalUrl = response.url;
      
      // Check if the page is likely a Single Page Application (SPA)
      const isSPA = this.detectSPA(response.body);
      
      // For SPAs, try multiple wait times to get the best content
      if (options.handleDynamicContent && isSPA) {
        console.log(`🔄 Detected SPA, trying multiple wait times for best content...`);
        
        let bestHtml = response.body;
        let bestContentScore = this.scoreContent(response.body);
        
        // Try different wait times for dynamic content
        const waitTimes = [1000, 3000, 5000];
        
        for (const waitTime of waitTimes) {
          try {
            console.log(`⏱️ Trying with ${waitTime}ms delay...`);
            
            // Add a delay
            await new Promise(resolve => setTimeout(resolve, waitTime));
            
            // Create options with delay and a new cache-busting parameter
            const delayedOptions = { 
              ...gotOptions,
              headers: {
                ...gotOptions.headers,
                'Cookie': `nocache=${Date.now()}`
              },
              searchParams: {
                '_': Date.now()
              }
            };
            
            // Fetch again after delay
            const delayedResponse = await got(finalUrl, delayedOptions);
            
            // Score the content quality
            const contentScore = this.scoreContent(delayedResponse.body);
            console.log(`📊 Content score for ${waitTime}ms delay: ${contentScore}`);
            
            // Keep the response with the highest content score
            if (contentScore > bestContentScore) {
              bestHtml = delayedResponse.body;
              bestContentScore = contentScore;
            }
          } catch (e) {
            console.log(`⚠️ Error with ${waitTime}ms delay: ${e.message}`);
          }
        }
        
        return { html: bestHtml, finalUrl };
      }
      
      return { html: response.body, finalUrl };
    } catch (error) {
      throw new AppError(`Failed to fetch page: ${error.message}`, 500);
    }
  }
  
  /**
   * Detects if a page is likely a Single Page Application (SPA)
   * @param {string} html - The page HTML
   * @returns {boolean} - True if the page is likely an SPA
   */
  detectSPA(html) {
    if (!html) return false;
    
    // SPA indicators
    const spaIndicators = [
      // Framework root elements
      /<div[^>]*(?:id=['"]app['"]|id=['"]root['"])/i,
      /<div[^>]*(?:data-reactroot|data-react-app)/i,
      /<div[^>]*(?:ng-app|ng-controller|ng-view)/i,
      /<div[^>]*(?:v-app|data-v-|vue-app)/i,
      /<div[^>]*(?:data-svelte|svelte-app)/i,
      
      // Framework scripts
      /<script[^>]*(?:react|vue|angular|svelte|next|nuxt|gatsby)/i,
      
      // Common SPA patterns
      /<div[^>]*(?:router-view|ui-view|page-view)/i,
      /<div[^>]*(?:data-router|data-page|data-view)/i,
      
      // Empty content containers that will be filled by JS
      /<div[^>]*(?:id=['"]content['"]|class=['"]content['"])[^>]*>\s*<\/div>/i,
      /<div[^>]*(?:id=['"]main['"]|class=['"]main['"])[^>]*>\s*<\/div>/i,
      
      // Loading indicators
      /<div[^>]*(?:loading|spinner|skeleton)/i
    ];
    
    // Check if any SPA indicators are present
    const isSPA = spaIndicators.some(pattern => pattern.test(html));
    
    // Also check if the page has minimal content but lots of scripts
    const hasMinimalContent = html.length < 20000 && 
                             (html.match(/<script/g) || []).length > 5;
    
    return isSPA || hasMinimalContent;
  }
  
  /**
   * Scores HTML content for quality
   * @param {string} html - The HTML content to score
   * @returns {number} - A quality score (higher is better)
   */
  scoreContent(html) {
    if (!html) return 0;
    
    try {
      const $ = cheerio.load(html);
      
      // Count paragraphs
      const paragraphCount = $('p').length;
      
      // Count headings
      const headingCount = $('h1, h2, h3, h4, h5, h6').length;
      
      // Count images
      const imageCount = $('img').length;
      
      // Count links
      const linkCount = $('a[href]').length;
      
      // Count words in paragraphs
      let wordCount = 0;
      $('p').each((_, el) => {
        wordCount += $(el).text().trim().split(/\s+/).length;
      });
      
      // Calculate final score
      const score = paragraphCount * 10 + 
                   headingCount * 15 + 
                   imageCount * 5 + 
                   linkCount * 2 + 
                   wordCount;
      
      return score;
    } catch (error) {
      console.error('Error scoring HTML content:', error);
      return 0;
    }
  }
  
  /**
   * Extracts content from HTML
   * @param {string} html - The HTML to extract content from
   * @param {string} baseUrl - The base URL for resolving relative URLs
   * @param {Object} options - Extraction options
   * @returns {Promise<{content: string, images: Array}>} - The extracted content and images
   */
  async extractContent(html, baseUrl, options) {
    console.log(`📄 Extracting content from: ${baseUrl}`);
    
    try {
      // Load HTML with cheerio
      const $ = cheerio.load(html);
      
      // Remove excluded elements
      if (options.excludeSelectors && options.excludeSelectors.length > 0) {
        options.excludeSelectors.forEach(selector => {
          try {
            $(selector).remove();
          } catch (e) {
            console.log(`⚠️ Error removing selector ${selector}: ${e.message}`);
          }
        });
      }
      
      // Find the main content element
      let mainContent = null;
      let mainContentScore = 0;
      
      // Try each content selector in order of priority
      for (const selector of options.contentSelectors) {
        try {
          const elements = $(selector);
          if (elements.length > 0) {
            // For each matching element, score it
            elements.each((_, el) => {
              const $el = $(el);
              
              // Skip if this element is empty or very small
              if ($el.text().trim().length < 50) return;
              
              // Score this element
              const score = this.scoreElement($, $el);
              
              // If this is the highest scoring element so far, use it
              if (score > mainContentScore) {
                mainContent = $el;
                mainContentScore = score;
              }
            });
            
            // If we found a good content element, stop looking
            if (mainContentScore > 100) break;
          }
        } catch (e) {
          console.log(`⚠️ Error with selector ${selector}: ${e.message}`);
        }
      }
      
      // If we didn't find any content, use the body
      if (!mainContent) {
        mainContent = $('body');
      }
      
      // Extract images if requested
      const images = [];
      if (options.includeImages) {
        mainContent.find('img').each((_, img) => {
          const $img = $(img);
          const src = $img.attr('src');
          const alt = $img.attr('alt') || '';
          
          if (src) {
            // Resolve relative URLs
            const absoluteSrc = new URL(src, baseUrl).href;
            
            // Only include images with supported extensions
            const ext = path.extname(absoluteSrc.split('?')[0].toLowerCase());
            if (IMAGE_EXTENSIONS.includes(ext)) {
              images.push({
                src: absoluteSrc,
                alt,
                title: $img.attr('title') || alt
              });
            }
          }
        });
      }
      
      // Clean up the content
      this.cleanContent($, mainContent);
      
      // Get the HTML content
      const contentHtml = mainContent.html();
      
      return {
        content: contentHtml || '',
        images
      };
    } catch (error) {
      console.error('Error extracting content:', error);
      throw new AppError(`Failed to extract content: ${error.message}`, 500);
    }
  }
  
  /**
   * Scores an element for content quality
   * @param {CheerioStatic} $ - Cheerio instance
   * @param {Cheerio} $el - Element to score
   * @returns {number} - Score (higher is better)
   */
  scoreElement($, $el) {
    // Count paragraphs
    const paragraphCount = $el.find('p').length;
    
    // Count headings
    const headingCount = $el.find('h1, h2, h3, h4, h5, h6').length;
    
    // Count images
    const imageCount = $el.find('img').length;
    
    // Count links
    const linkCount = $el.find('a[href]').length;
    
    // Count words
    const text = $el.text();
    const wordCount = text.trim().split(/\s+/).length;
    
    // Count code blocks
    const codeBlockCount = $el.find('pre, code').length;
    
    // Calculate text density (text length / HTML length)
    const htmlLength = $el.html()?.length || 1;
    const textDensity = text.length / htmlLength;
    
    // Calculate link density (link text / total text)
    let linkText = 0;
    $el.find('a').each((_, link) => {
      linkText += $(link).text().length;
    });
    const linkDensity = linkText / (text.length || 1);
    
    // Calculate final score
    let score = paragraphCount * 15 + 
               headingCount * 20 + 
               imageCount * 5 + 
               (linkCount * (1 - linkDensity)) + // Penalize high link density
               wordCount * 0.5 +
               codeBlockCount * 15 +
               textDensity * 100; // Reward high text density
    
    // Bonus for nested structure (indicates real content)
    if ($el.find('ul li, ol li').length > 0) score += 30;
    if ($el.find('blockquote').length > 0) score += 20;
    if ($el.find('table').length > 0) score += 40;
    
    return score;
  }
  
  /**
   * Cleans up content for better Markdown conversion
   * @param {CheerioStatic} $ - Cheerio instance
   * @param {Cheerio} $content - Content to clean
   */
  cleanContent($, $content) {
    // Remove empty paragraphs
    $content.find('p').each((_, el) => {
      const $el = $(el);
      if ($el.text().trim() === '') {
        $el.remove();
      }
    });
    
    // Remove hidden elements
    $content.find('[style*="display: none"], [style*="display:none"], [hidden], [aria-hidden="true"]').remove();
    
    // Remove script and style tags
    $content.find('script, style, noscript').remove();
    
    // Remove tracking pixels and tiny images
    $content.find('img').each((_, el) => {
      const $el = $(el);
      const width = parseInt($el.attr('width') || '100', 10);
      const height = parseInt($el.attr('height') || '100', 10);
      
      if (width <= 1 || height <= 1) {
        $el.remove();
      }
    });
    
    // Fix relative URLs in links and images
    $content.find('a[href]').each((_, el) => {
      const $el = $(el);
      const href = $el.attr('href');
      
      // Skip if it's a fragment or javascript link
      if (href && !href.startsWith('#') && !href.startsWith('javascript:')) {
        try {
          // Try to make it absolute
          const absoluteUrl = new URL(href, 'https://example.com').href;
          $el.attr('href', absoluteUrl);
        } catch (e) {
          // If it fails, leave it as is
        }
      }
    });
    
    // Remove empty divs and spans
    $content.find('div, span').each((_, el) => {
      const $el = $(el);
      if ($el.text().trim() === '' && $el.children().length === 0) {
        $el.remove();
      }
    });
  }
  
  /**
   * Generates Markdown from HTML content
   * @param {string} content - HTML content
   * @param {Object} metadata - Page metadata
   * @param {Array} images - Images to include
   * @param {string} url - Original URL
   * @param {Object} options - Conversion options
   * @returns {Promise<string>} - Markdown content
   */
  async generateMarkdown(content, metadata, images, url, options) {
    try {
      // Use the imported generateMarkdown function from htmlToMarkdown.js
      return await generateMarkdown(content, metadata, images, url, options);
    } catch (error) {
      console.error('Error generating Markdown:', error);
      throw new AppError(`Failed to generate Markdown: ${error.message}`, 500);
    }
  }
  
  /**
   * Converts HTML to Markdown
   * @param {HTMLElement} element - HTML element to convert
   * @returns {string} - Markdown content
   */
  // Use the imported htmlToMarkdown function instead of implementing it here
  
  /**
   * Generates a file name from a URL
   * @param {string} url - URL to generate name from
   * @returns {string} - Generated name
   */
  generateName(url) {
    // Use the imported generateNameFromUrl function
    return generateNameFromUrl(url);
  }
  
  /**
   * Extracts a title from a URL when metadata is missing
   * @param {string} url - URL to extract title from
   * @returns {string} - Extracted title
   */
  extractTitleFromUrl(url) {
    // Use the imported extractTitleFromUrl function
    return extractTitleFromUrl(url);
  }
}

/**
 * Convenience function to convert a URL to Markdown
 * @param {string} url - URL to convert
 * @param {Object} options - Conversion options
 * @returns {Promise<Object>} - Conversion result
 */
export async function convertUrlToMarkdown(url, options = {}) {
  const converter = new UrlConverter();
  return converter.convertToMarkdown(url, options);
}

// Export the URL converter class
export const urlConverter = {
  convertToMarkdown: async (url, options = {}) => {
    const converter = new UrlConverter();
    return converter.convertToMarkdown(url, options);
  }
};
