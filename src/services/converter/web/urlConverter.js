// services/converter/web/urlConverter.js

import puppeteer from 'puppeteer';
import TurndownService from 'turndown';
import * as cheerio from 'cheerio';
import { extractMetadata } from '../../../utils/metadataExtractor.js';  // Fix path

/**
 * Configuration for URL conversion and browser settings
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
        '--disable-gpu',
        '--disable-notifications',
        '--disable-extensions',
        '--disable-infobars'
      ],
      defaultViewport: { width: 1920, height: 1080 }
    },
    navigation: {
      waitUntil: ['networkidle2', 'domcontentloaded'],
      timeout: 300000
    }
  },
  conversion: {
    maxRetries: 3,
    retryDelay: 1000,
    timeoutMs: 300000,
    maxConcurrent: 5,
    imageSizeLimit: 5 * 1024 * 1024, // 5MB
    imageTypes: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
    maxImages: 50
  }
};

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
    this.retryable = [
      'NETWORK_ERROR',
      'TIMEOUT_ERROR',
      'BROWSER_ERROR'
    ].includes(code);
  }

  static validation(message, details = null) {
    return new UrlConversionError(message, 'VALIDATION_ERROR', details);
  }

  static network(message, details = null) {
    return new UrlConversionError(message, 'NETWORK_ERROR', details);
  }

  static timeout(message, details = null) {
    return new UrlConversionError(message, 'TIMEOUT_ERROR', details);
  }
}

/**
 * URL processing utilities
 */
class UrlUtils {
  /**
   * Normalizes and validates a URL
   */
  static normalizeUrl(input) {
    try {
      const urlString = typeof input === 'string'
        ? input
        : input?.url || input?.href || '';

      if (!urlString.trim()) {
        throw UrlConversionError.validation('URL is required');
      }

      let normalizedUrl = urlString.trim()
        .replace(/^\/\//, '')
        .replace(/\s+/g, '');

      if (!/^https?:\/\//i.test(normalizedUrl)) {
        normalizedUrl = 'https://' + normalizedUrl;
      }

      // Validate URL format
      const urlObj = new URL(normalizedUrl);

      // Additional validation
      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        throw UrlConversionError.validation('Only HTTP/HTTPS protocols are supported');
      }

      return urlObj.href;

    } catch (error) {
      if (error instanceof UrlConversionError) throw error;
      throw UrlConversionError.validation(`Invalid URL format: ${error.message}`);
    }
  }

  /**
   * Sanitizes a filename
   */
  static sanitizeFilename(filename, maxLength = 100) {
    if (!filename) return 'unknown';

    return filename
      .replace(/[^a-z0-9_\-\.]/gi, '_')
      .replace(/_{2,}/g, '_')
      .substring(0, maxLength);
  }

  /**
   * Extracts domain from URL
   */
  static getDomain(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname;
    } catch {
      return 'unknown-domain';
    }
  }
}

/**
 * Handles browser management and web scraping
 */
class BrowserManager {
  constructor(config = CONFIG.puppeteer) {
    this.config = config;
    this.browser = null;
    this.page = null;
  }

  async initialize() {
    try {
      console.log('Initializing Puppeteer browser...');
      this.browser = await puppeteer.launch(this.config.launch);
      this.page = await this.browser.newPage();

      // Set user agent and extra headers
      await this.page.setUserAgent(CONFIG.puppeteer.userAgent || 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4324.96 Safari/537.36');
      await this.page.setExtraHTTPHeaders({
        'Accept-Language': 'en-US,en;q=0.9'
      });

      // Handle dialog windows
      this.page.on('dialog', async dialog => {
        console.log('Dismissing dialog:', dialog.message());
        await dialog.dismiss();
      });

      console.log('Browser initialized successfully.');

    } catch (error) {
      console.error('Failed to initialize browser:', error);
      throw new UrlConversionError(
        'Failed to initialize browser',
        'BROWSER_ERROR',
        error
      );
    }
  }

  async navigateToUrl(url) {
    try {
      console.log(`Navigating to URL: ${url}`);
      const response = await this.page.goto(url, this.config.navigation);

      if (!response) {
        throw new UrlConversionError('Failed to load page');
      }

      if (!response.ok()) {
        throw new UrlConversionError(
          `Page returned status ${response.status()}`,
          'HTTP_ERROR'
        );
      }

      // Wait for content to be ready
      await this.page.waitForSelector('body');
      console.log('Page loaded successfully.');

    } catch (error) {
      if (error instanceof UrlConversionError) throw error;
      console.error(`Navigation failed: ${error.message}`);
      throw new UrlConversionError(
        `Navigation failed: ${error.message}`,
        'NAVIGATION_ERROR'
      );
    }
  }

  async cleanup() {
    if (this.browser) {
      console.log('Closing Puppeteer browser...');
      await this.browser.close();
      this.browser = null;
      this.page = null;
      console.log('Browser closed.');
    }
  }
}

/**
 * Main URL converter class
 */
class UrlConverter {
    constructor(config = CONFIG) {
      this.config = config;
      this.turndownService = new TurndownService({
        headingStyle: 'atx',
        codeBlockStyle: 'fenced',
        bulletListMarker: '-',
        emDelimiter: '_',
        strongDelimiter: '**',
        hr: '---',
        preformattedCode: true
      });

      // Configure turndown rules for better formatting
      this.turndownService.addRule('codeBlocks', {
        filter: ['pre'],
        replacement: (content, node) => {
          const language = node.getAttribute('class')?.replace('language-', '') || '';
          return `\n\`\`\`${language}\n${content}\n\`\`\`\n`;
        }
      });

      // Preserve tables
      this.turndownService.addRule('tables', {
        filter: ['table'],
        replacement: (content) => content + '\n\n'
      });
      this.browserManager = new BrowserManager(config.puppeteer);
    }
  
    /**
     * Converts a URL to Markdown format
     */
    async convertToMarkdown(urlInput, options = {}) {
      const {
        includeImages = true,
        includeMeta = true,
        apiKey = null,
        originalName = null
      } = options;
  
      try {
        // Validate and normalize URL
        const url = UrlUtils.normalizeUrl(urlInput);
        console.log(`Converting URL: ${url}`);
  
        // Initialize browser
        await this.browserManager.initialize();
        await this.browserManager.navigateToUrl(url);
  
        // Extract content
        const { html, metadata, images } = await this.extractContent(url, {
          includeImages,
          includeMeta
        });
        console.log(`Extracted HTML content, length: ${html.length}`);
  
        // Convert to Markdown
        const markdown = this.turndownService.turndown(html);
        console.log(`Converted to Markdown, length: ${markdown.length}`);
  
        // Format final content
        const content = this.formatContent(markdown, metadata);
        console.log(`Formatted content, length: ${content.length}`);
  
        return {
          content,
          images: includeImages ? images : [],
          name: UrlUtils.sanitizeFilename(
            originalName || UrlUtils.getDomain(url)
          ),
          success: true,
          metadata,
          url // **Include the URL here**
        };
  
      } catch (error) {
        console.error('URL conversion failed:', error);
        return {
          content: this.formatErrorContent(error, urlInput, originalName),
          images: [],
          name: UrlUtils.sanitizeFilename(originalName || 'error'),
          success: false,
          error: error.message
        };
  
      } finally {
        await this.browserManager.cleanup();
      }
    }

  /**
   * Extracts and cleans content from webpage
   */
  async extractContent(url, options) {
    const { includeImages, includeMeta } = options;
    const page = this.browserManager.page;

    // Get page content
    const html = await page.content();
    const $ = cheerio.load(html);

    // Clean up unwanted elements
    $('script, style, iframe, noscript, nav, footer, header, .navigation, .footer, .header, .ad, .advertisement, .social-share, .comments').remove();

    // Clean empty elements
    $('p:empty, div:empty, span:empty').remove();

    // Clean up classes and styles
    $('*').removeAttr('class').removeAttr('style');

    // Extract metadata if needed
    const metadata = includeMeta ? await extractMetadata(url) : null;
    console.log(`Extracted metadata:`, metadata);

    // Extract images if needed
    const images = includeImages ? await this.extractImages($, url) : [];
    console.log(`Extracted ${images.length} images.`);

    // Add spacing between elements for better readability
    $('h1, h2, h3, h4, h5, h6, p, ul, ol, blockquote, pre, table').after('\n');

    return {
      html: $.html(),
      metadata,
      images
    };
  }

  /**
   * Extracts and processes images, creating Obsidian-compatible image references
   */
  async extractImages($, url) {
    const images = [];
    const seenUrls = new Set();
    const crypto = await import('crypto');
    const domain = UrlUtils.getDomain(url);

    // Replace image references in HTML with Obsidian wiki-links
    const replaceImageReference = (img, imageName) => {
      const $img = $(img);
      const alt = $img.attr('alt') || '';
      $img.replaceWith(`![[${imageName}]]`);
      return alt;
    };

    const downloadImage = async (url) => {
      try {
        const response = await fetch(url);
        const buffer = await response.arrayBuffer();
        return Buffer.from(buffer).toString('base64');
      } catch (error) {
        console.error(`Failed to download image: ${url}`, error);
        return null;
      }
    };

    const processImage = async (img) => {
      const src = $(img).attr('src');
      if (!src || seenUrls.has(src)) return null;
      if (!src.startsWith('http')) {
        console.warn(`Skipping non-http image source: ${src}`);
        return null;
      }

      seenUrls.add(src);

      const imageData = await downloadImage(src);
      if (!imageData) return null;

      const ext = src.split('.').pop().toLowerCase();
      if (!this.config.conversion.imageTypes.includes(ext)) {
        console.warn(`Unsupported image type: ${ext}`);
        return null;
      }

      // Create hash for unique filename
      const hash = crypto.createHash('md5').update(src).digest('hex').slice(0, 8);
      const imageName = `image-${hash}.${ext}`;
      const alt = replaceImageReference(img, imageName);

      return {
        url: src,
        data: imageData,
        name: `web/${domain}/assets/${imageName}`,
        type: `image/${ext}`,
        metadata: {
          originalUrl: src,
          alt: alt || undefined,
          dateAdded: new Date().toISOString()
        }
      };
    };

    const imageElements = $('img').toArray();
    console.log(`Found ${imageElements.length} <img> elements.`);

    for (const img of imageElements) {
      if (images.length >= this.config.conversion.maxImages) {
        console.log('Reached maximum image limit.');
        break;
      }

      const processedImage = await processImage(img);
      if (processedImage) {
        images.push(processedImage);
        console.log(`Processed image: ${processedImage.name}`);
      }
    }

    return images;
  }

  /**
   * Formats the final content with metadata
   */
  formatContent(markdown, metadata = null) {
    const sections = [];

    // Add frontmatter if metadata exists
    if (metadata) {
      sections.push(
        '---',
        // Properly format metadata as YAML frontmatter
        Object.entries(metadata)
          .map(([key, value]) => `${key}: "${value?.toString()?.replace(/"/g, '\\"') || ''}"`)
          .join('\n'),
        '---',
        ''
      );
    }

    // Add main content
    sections.push(markdown);

    return sections.join('\n');
  }

  /**
   * Formats error content
   */
  formatErrorContent(error, urlInput, originalName) {
    return [
      `# Conversion Error`,
      '',
      `> Failed to convert URL to Markdown.`,
      '',
      '## Error Details',
      '```',
      error.message,
      error.code ? `Code: ${error.code}` : '',
      error.details ? `Details: ${JSON.stringify(error.details, null, 2)}` : '',
      '```',
      '',
      '## Request Information',
      `- **URL:** ${urlInput}`,
      `- **Time:** ${new Date().toISOString()}`,
      `- **Name:** ${originalName || 'Not provided'}`,
      ''
    ].filter(Boolean).join('\n');
  }
}

// Export singleton instance
export const urlConverter = new UrlConverter();

// Export main conversion function
export const convertUrlToMarkdown = async (url, options) =>
  urlConverter.convertToMarkdown(url, options);
