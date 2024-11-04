// services/converter/web/urlConverter.js

import puppeteer from 'puppeteer';
import TurndownService from 'turndown';
import * as cheerio from 'cheerio';
import { v4 as uuidv4 } from 'uuid';
import pLimit from 'p-limit';
import fetch from 'node-fetch';
import { extractMetadata } from '../../../utils/metadataExtractor.js';

/**
 * Configuration for the URL converter
 */
const CONFIG = {
  puppeteer: {
    launch: {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu'
      ],
      defaultViewport: { width: 1920, height: 1080 }
    },
    navigation: {
      waitUntil: 'networkidle2',
      timeout: 30000
    },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  },
  content: {
    selectors: {
      mainContent: [
        'main',
        'article',
        '[role="main"]',
        '.main-content',
        '.content',
        '#content',
        '.post-content',
        '.article-content'
      ],
      remove: [
        'script',
        'style',
        'link',
        'meta',
        'noscript',
        'iframe',
        '.hidden',
        '[style*="display: none"]',
        '[style*="display:none"]',
        '[hidden]',
        '[data-ad]',
        '[id*="google"]',
        '[class*="advert"]',
        '[class*="tracking"]',
        '[aria-hidden="true"]'
      ]
    },
    turndown: {
      headingStyle: 'atx',
      codeBlockStyle: 'fenced',
      emDelimiter: '_',
      strongDelimiter: '**',
      bulletListMarker: '-'
    }
  },
  limits: {
    maxImages: 100,
    concurrentRequests: 5,
    maxRetries: 3,
    retryDelay: 1000
  }
};

/**
 * Class to handle URL content detection and conversion
 */
class ContentTypeHandler {
  /**
   * Detects the content type of a given URL.
   * @param {string} url - The URL to detect.
   * @returns {Promise<Object>} - An object containing content type details.
   */
  static async detect(url) {
    try {
      const response = await fetch(url, { method: 'HEAD' });
      const contentType = response.headers.get('content-type') || '';
      return {
        type: contentType.split(';')[0].toLowerCase(),
        isHtml: contentType.includes('text/html'),
        isImage: contentType.startsWith('image/'),
        extension: contentType.split('/')[1]
      };
    } catch (error) {
      console.error('Content type detection failed:', error);
      return { type: 'unknown', isHtml: false, isImage: false };
    }
  }

  /**
   * Handles image URLs by downloading and encoding them.
   * @param {string} url - The image URL.
   * @param {string} name - The base name for the image file.
   * @returns {Promise<Object>} - An object containing markdown content and image data.
   */
  static async handleImage(url, name) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
      }
      const buffer = await response.arrayBuffer();
      const base64 = Buffer.from(buffer).toString('base64');
      const contentType = response.headers.get('content-type');
      const extension = contentType?.split('/')[1] || 'png';
      const imageName = `${sanitizeFilename(name || 'image')}-${uuidv4().slice(0, 8)}.${extension}`;

      return {
        content: [
          `# Image: ${imageName}`,
          '',
          `**Source:** ${url}`,
          `**Downloaded:** ${new Date().toISOString()}`,
          `**Type:** ${contentType}`,
          '',
          `![${imageName}](assets/${imageName})`,
          ''
        ].join('\n'),
        images: [{
          name: imageName,
          data: base64,
          type: contentType,
          path: `assets/${imageName}`
        }]
      };
    } catch (error) {
      throw new Error(`Image processing failed: ${error.message}`);
    }
  }
}

/**
 * Class to handle HTML content processing
 */
class HtmlProcessor {
  /**
   * Cleans up the HTML content by removing unwanted elements and attributes.
   * @param {CheerioStatic} $ - The Cheerio object containing HTML.
   * @returns {CheerioStatic} - The cleaned Cheerio object.
   */
  static cleanupContent($) {
    CONFIG.content.selectors.remove.forEach(selector => {
      $(selector).remove();
    });

    $('*').removeAttr('class').removeAttr('id');
    $('p:empty, div:empty').remove();

    return $;
  }

  /**
   * Extracts the main content from the cleaned HTML.
   * @param {CheerioStatic} $ - The cleaned Cheerio object.
   * @returns {CheerioElement} - The main content element.
   */
  static extractMainContent($) {
    for (const selector of CONFIG.content.selectors.mainContent) {
      const element = $(selector);
      if (element.length && element.text().trim().length > 100) {
        return element;
      }
    }
    return $('body');
  }

  /**
   * Cleans up and extracts the main content from the HTML.
   * @param {string} html - The raw HTML content.
   * @returns {Promise<{ $, mainContent: CheerioElement }>} - The Cheerio instance and the main content element.
   */
  static async cleanupAndExtract(html) {
    try {
      const $ = cheerio.load(html);
      this.cleanupContent($);
      const mainContent = this.extractMainContent($);
      return { $, mainContent };
    } catch (error) {
      throw new Error(`Failed to cleanup and extract content: ${error.message}`);
    }
  }

  /**
   * Processes images within the main content.
   * @param {CheerioStatic} $ - The Cheerio instance.
   * @param {CheerioElement} content - The main content element.
   * @param {string} baseName - The base name for image files.
   * @returns {Promise<{ content: string, images: Array }>} - The processed content and images.
   */
  static async processImages($, content, baseName) {
    const images = [];
    const limit = pLimit(CONFIG.limits.concurrentRequests);

    const imagePromises = [];
    $(content).find('img').each((index, img) => {
      if (images.length >= CONFIG.limits.maxImages) return;

      const src = $(img).attr('src');
      if (!src) return;

      const promise = limit(async () => {
        try {
          const imageResult = await this.processImage(src, baseName, index);
          if (imageResult) {
            images.push(imageResult.image);
            $(img).attr('src', imageResult.path);
          }
        } catch (error) {
          console.error(`Image processing failed: ${error.message}`);
        }
      });

      imagePromises.push(promise);
    });

    await Promise.all(imagePromises);
    return { content: $(content).html(), images };
  }

  /**
   * Processes a single image.
   * @param {string} src - The source URL of the image.
   * @param {string} baseName - The base name for the image file.
   * @param {number} index - The index of the image.
   * @returns {Promise<{ image: Object, path: string } | null>} - The image object and its path, or null.
   */
  static async processImage(src, baseName, index) {
    if (src.startsWith('data:')) {
      const matches = src.match(/^data:(image\/[a-zA-Z]+);base64,(.+)$/);
      if (matches) {
        const [_, type, data] = matches;
        const extension = type.split('/')[1];
        const name = `${sanitizeFilename(baseName)}-${index + 1}.${extension}`;
        return {
          image: {
            name,
            data,
            type,
            path: `assets/${name}`
          },
          path: `assets/${name}`
        };
      }
    } else if (src.startsWith('http') || src.startsWith('//')) {
      try {
        let imageUrl = src.startsWith('//') ? 'https:' + src : src;
        const response = await fetch(imageUrl);
        if (!response.ok) {
          throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
        }
        const buffer = await response.arrayBuffer();
        const type = response.headers.get('content-type');
        const extension = type?.split('/')[1] || 'png';
        const name = `${sanitizeFilename(baseName)}-${index + 1}.${extension}`;
        return {
          image: {
            name,
            data: Buffer.from(buffer).toString('base64'),
            type,
            path: `assets/${name}`
          },
          path: `assets/${name}`
        };
      } catch (error) {
        console.error(`Failed to fetch image ${src}:`, error);
      }
    }
    return null;
  }
}

/**
 * Sanitizes filenames by removing invalid characters.
 * @param {string} filename - The original filename.
 * @returns {string} - The sanitized filename.
 */
function sanitizeFilename(filename) {
  // Simple regex to remove invalid characters
  return filename.replace(/[^a-z0-9_\-\.]/gi, '_');
}

/**
 * Main URL converter function
 * @param {string|Object} urlInput - URL to convert
 * @param {string} originalName - Original name for file paths
 * @returns {Promise<{ content: string, images: Array, name: string, success: boolean }>}
 */
export async function convertUrlToMarkdown(urlInput, originalName) {
  let browser;
  try {
    // Normalize URL
    const url = typeof urlInput === 'object' ? urlInput.url || urlInput.href : urlInput.toString();
    if (!url) throw new Error('Invalid URL input');

    // Clean URL
    const cleanUrl = url.trim();
    const fullUrl = !/^https?:\/\//i.test(cleanUrl)
      ? 'https://' + cleanUrl.replace(/^\/\//, '')
      : cleanUrl;

    console.log(`Converting URL: ${fullUrl}`);

    // Detect content type
    const contentType = await ContentTypeHandler.detect(fullUrl);

    // Handle image URLs directly
    if (contentType.isImage) {
      const imageResult = await ContentTypeHandler.handleImage(fullUrl, originalName);
      return {
        content: imageResult.content,
        images: imageResult.images,
        name: originalName || sanitizeFilename(new URL(fullUrl).hostname),
        success: true
      };
    }

    // Handle non-HTML content
    if (!contentType.isHtml) {
      const metadata = await extractMetadata(fullUrl);
      const markdown = `\n\n> Non-HTML content at [${fullUrl}](${fullUrl})\n`;
      return {
        content: metadata + markdown,
        images: [],
        name: sanitizeFilename(new URL(fullUrl).hostname),
        success: true
      };
    }

    // Launch Puppeteer
    browser = await puppeteer.launch(CONFIG.puppeteer.launch);
    const page = await browser.newPage();
    await page.setUserAgent(CONFIG.puppeteer.userAgent);
    await page.goto(fullUrl, CONFIG.puppeteer.navigation);

    // Get the rendered HTML content
    const html = await page.content();

    // Close the browser
    await browser.close();
    browser = null;

    // Process HTML content
    const metadata = await extractMetadata(fullUrl);
    const { $, mainContent } = await HtmlProcessor.cleanupAndExtract(html);

    // Process images
    const { content: processedContent, images } = await HtmlProcessor.processImages($, mainContent, originalName);

    // Convert to Markdown
    const turndownService = new TurndownService(CONFIG.content.turndown);
    turndownService.addRule('strikethrough', {
      filter: ['del', 's', 'strike'],
      replacement: (content) => `~~${content}~~`,
    });

    const markdown = turndownService.turndown(processedContent);
    const finalContent = metadata + markdown;

    return {
      content: finalContent,
      images,
      name: sanitizeFilename(originalName || new URL(fullUrl).hostname),
      success: true
    };

  } catch (error) {
    console.error('URL conversion failed:', error);
    if (browser) await browser.close(); // Ensure browser is closed on error
    return {
      content: [
        `# Conversion Error`,
        '',
        `> Failed to convert URL to Markdown.`,
        '',
        '## Error Details',
        '```',
        error.message,
        '```',
        '',
        '## Request Information',
        `- **URL:** ${urlInput}`,
        `- **Time:** ${new Date().toISOString()}`,
        `- **Name:** ${originalName}`
      ].join('\n'),
      images: [],
      name: sanitizeFilename(originalName || 'unknown'),
      success: false
    };
  }
}
