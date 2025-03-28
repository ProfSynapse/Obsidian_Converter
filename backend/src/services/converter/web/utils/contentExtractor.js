/**
 * Content Extractor Module
 * 
 * This module provides functionality for extracting content from HTML pages.
 * It includes methods for finding the main content element, scoring elements,
 * cleaning content, and extracting images.
 * 
 * Related files:
 * - ../urlConverter.js: Main URL converter implementation
 * - ./config.js: Configuration settings
 * - ./spaHandler.js: SPA detection and handling
 * - ./htmlToMarkdown.js: HTML to Markdown conversion
 */

import * as cheerio from 'cheerio';
import path from 'path';
import { AppError } from '../../../../utils/errorHandler.js';
import { DEFAULT_CONTENT_SELECTORS, DEFAULT_EXCLUDE_SELECTORS, IMAGE_EXTENSIONS } from './config.js';

/**
 * Extracts content from HTML
 * @param {string} html - The HTML to extract content from
 * @param {string} baseUrl - The base URL for resolving relative URLs
 * @param {Object} options - Extraction options
 * @returns {Promise<{content: string, images: Array}>} - The extracted content and images
 */
export async function extractContent(html, baseUrl, options) {
  console.log(`📄 Extracting content from: ${baseUrl}`);
  
  try {
    // Load HTML with cheerio
    const $ = cheerio.load(html);
    
    // Remove excluded elements
    const excludeSelectors = options.excludeSelectors || DEFAULT_EXCLUDE_SELECTORS;
    if (excludeSelectors && excludeSelectors.length > 0) {
      excludeSelectors.forEach(selector => {
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
    const contentSelectors = options.contentSelectors || DEFAULT_CONTENT_SELECTORS;
    for (const selector of contentSelectors) {
      try {
        const elements = $(selector);
        if (elements.length > 0) {
          // For each matching element, score it
          elements.each((_, el) => {
            const $el = $(el);
            
            // Skip if this element is empty or very small
            if ($el.text().trim().length < 50) return;
            
            // Score this element
            const score = scoreElement($, $el);
            
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
          try {
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
          } catch (e) {
            console.log(`⚠️ Error processing image ${src}: ${e.message}`);
          }
        }
      });
    }
    
    // Clean up the content
    cleanContent($, mainContent, baseUrl);
    
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
export function scoreElement($, $el) {
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
  
  // Count list items
  const listItemCount = $el.find('li').length;
  
  // Count tables
  const tableCount = $el.find('table').length;
  
  // Count blockquotes
  const blockquoteCount = $el.find('blockquote').length;
  
  // Calculate final score
  let score = paragraphCount * 15 + 
             headingCount * 20 + 
             imageCount * 5 + 
             (linkCount * (1 - linkDensity)) + // Penalize high link density
             wordCount * 0.5 +
             codeBlockCount * 15 +
             listItemCount * 3 +
             tableCount * 20 +
             blockquoteCount * 10 +
             textDensity * 100; // Reward high text density
  
  // Bonus for nested structure (indicates real content)
  if ($el.find('ul li, ol li').length > 0) score += 30;
  if ($el.find('blockquote').length > 0) score += 20;
  if ($el.find('table').length > 0) score += 40;
  
  // Bonus for article elements
  if ($el.is('article') || $el.closest('article').length > 0) score += 50;
  if ($el.is('main') || $el.closest('main').length > 0) score += 40;
  if ($el.is('section') || $el.closest('section').length > 0) score += 30;
  
  // Bonus for content-related classes and IDs
  const classAttr = $el.attr('class') || '';
  const idAttr = $el.attr('id') || '';
  const attrs = (classAttr + ' ' + idAttr).toLowerCase();
  
  if (/\b(content|article|post|entry|blog|main|body)\b/.test(attrs)) score += 50;
  if (/\b(sidebar|comment|menu|nav|footer|header|banner|ad)\b/.test(attrs)) score -= 50;
  
  return score;
}

/**
 * Cleans up content for better Markdown conversion
 * @param {CheerioStatic} $ - Cheerio instance
 * @param {Cheerio} $content - Content to clean
 * @param {string} baseUrl - Base URL for resolving relative links
 */
export function cleanContent($, $content, baseUrl) {
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
        const absoluteUrl = new URL(href, baseUrl).href;
        $el.attr('href', absoluteUrl);
      } catch (e) {
        // If it fails, leave it as is
      }
    }
  });
  
  // Fix relative URLs in images
  $content.find('img[src]').each((_, el) => {
    const $el = $(el);
    const src = $el.attr('src');
    
    if (src && !src.startsWith('data:')) {
      try {
        // Try to make it absolute
        const absoluteSrc = new URL(src, baseUrl).href;
        $el.attr('src', absoluteSrc);
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
  
  // Remove comments
  $content.contents().filter(function() {
    return this.type === 'comment';
  }).remove();
  
  // Remove social media widgets
  $content.find('[class*="social"], [id*="social"], [class*="share"], [id*="share"]').remove();
  
  // Remove newsletter signup forms
  $content.find('form, [class*="newsletter"], [id*="newsletter"], [class*="subscribe"], [id*="subscribe"]').remove();
  
  // Remove "related articles" sections
  $content.find('[class*="related"], [id*="related"], [class*="recommended"], [id*="recommended"]').remove();
  
  // Remove "read more" links
  $content.find('a').filter(function() {
    const text = $(this).text().toLowerCase();
    return /\b(read more|continue reading|more|next|previous)\b/.test(text);
  }).remove();
}

/**
 * Generates a file name from a URL
 * @param {string} url - URL to generate name from
 * @returns {string} - Generated name
 */
export function generateNameFromUrl(url) {
  try {
    const urlObj = new URL(url);
    
    // Try to use the path first
    let name = urlObj.pathname;
    
    // Remove trailing slash
    name = name.replace(/\/$/, '');
    
    // If path is empty or just a slash, use hostname
    if (!name || name === '/') {
      name = urlObj.hostname;
    }
    
    // Extract the last part of the path
    const parts = name.split('/').filter(Boolean);
    const lastPart = parts.pop() || urlObj.hostname;
    
    // Clean up the name
    let cleanName = lastPart
      .toLowerCase()
      // Remove file extensions
      .replace(/\.[^.]+$/, '')
      // Remove query parameters
      .split('?')[0]
      // Remove special characters
      .replace(/[^a-z0-9]+/g, '-')
      // Clean up dashes
      .replace(/^-+|-+$/g, '');
    
    // If the name is empty after cleaning, use the hostname
    if (!cleanName) {
      cleanName = urlObj.hostname.replace(/\./g, '-');
    }
    
    // Limit length
    if (cleanName.length > 50) {
      cleanName = cleanName.substring(0, 50);
    }
    
    return cleanName;
  } catch (error) {
    console.error('Error generating name from URL:', error);
    return 'page';
  }
}

/**
 * Extracts a title from a URL when metadata is missing
 * @param {string} url - URL to extract title from
 * @returns {string} - Extracted title
 */
export function extractTitleFromUrl(url) {
  try {
    const urlObj = new URL(url);
    
    // Try to use the path first
    let title = urlObj.pathname;
    
    // Remove trailing slash
    title = title.replace(/\/$/, '');
    
    // If path is empty or just a slash, use hostname
    if (!title || title === '/') {
      // Format the hostname nicely
      return urlObj.hostname
        .replace(/^www\./, '')
        .split('.')
        .map(part => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
    }
    
    // Extract the last part of the path
    const parts = title.split('/').filter(Boolean);
    const lastPart = parts.pop() || '';
    
    // Clean up the title
    let cleanTitle = lastPart
      // Remove file extensions
      .replace(/\.[^.]+$/, '')
      // Remove query parameters
      .split('?')[0]
      // Replace dashes and underscores with spaces
      .replace(/[-_]+/g, ' ')
      // Capitalize words
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
    
    // If the title is empty after cleaning, use the hostname
    if (!cleanTitle) {
      cleanTitle = urlObj.hostname
        .replace(/^www\./, '')
        .split('.')
        .map(part => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
    }
    
    return cleanTitle;
  } catch (error) {
    console.error('Error extracting title from URL:', error);
    return 'Untitled Page';
  }
}

/**
 * Extracts the main heading from HTML content
 * @param {string} html - HTML content
 * @returns {string} - Extracted heading
 */
export function extractMainHeading(html) {
  try {
    const $ = cheerio.load(html);
    
    // Try to find the first h1
    const h1 = $('h1').first();
    if (h1.length && h1.text().trim()) {
      return h1.text().trim();
    }
    
    // If no h1, try the title tag
    const title = $('title').text().trim();
    if (title) {
      return title;
    }
    
    // If no title, try the first h2
    const h2 = $('h2').first();
    if (h2.length && h2.text().trim()) {
      return h2.text().trim();
    }
    
    return '';
  } catch (error) {
    console.error('Error extracting main heading:', error);
    return '';
  }
}

export default {
  extractContent,
  scoreElement,
  cleanContent,
  generateNameFromUrl,
  extractTitleFromUrl,
  extractMainHeading
};
