// services/converter/web/urlConverter.js

import got from 'got';
import TurndownService from 'turndown';
import * as cheerio from 'cheerio';
import { extractMetadata } from '../../../utils/metadataExtractor.js';

  /**
   * Configuration for URL conversion settings
   */
  const CONFIG = {
    http: {
      timeout: 30000,
      retry: {
        limit: 3,
        statusCodes: [408, 413, 429, 500, 502, 503, 504],
        methods: ['GET']
      },
      headers: {
        'accept': 'text/html,application/xhtml+xml',
        'accept-encoding': 'gzip, deflate',
        'accept-language': 'en-US,en;q=0.9',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'cache-control': 'no-cache',
        'pragma': 'no-cache'
      },
      decompress: true
    },
    conversion: {
      maxRetries: 3,
      retryDelay: 1000,
      timeoutMs: 300000,
      maxConcurrent: 5,
      imageSizeLimit: 5 * 1024 * 1024, // 5MB
      imageTypes: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'ico'],
      maxImages: 50,
      includeSkippedImages: true // Include information about skipped images in output
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
    }

    /**
     * Fetches HTML content from a URL, handling redirects
     */
    /**
     * Merges Got options with defaults
     */
    mergeGotOptions(options = {}) {
      const gotOptions = {
        timeout: {
          request: this.config.http.timeout,
          response: this.config.http.timeout
        },
        retry: {
          limit: this.config.http.retry.limit,
          statusCodes: this.config.http.retry.statusCodes,
          methods: this.config.http.retry.methods,
          calculateDelay: ({retryCount}) => retryCount * 1000
        },
        headers: {
          ...this.config.http.headers,
          ...(options.headers || {})
        },
        followRedirect: true,
        maxRedirects: 10,
        throwHttpErrors: false,
        decompress: true,
        responseType: 'text',
        resolveBodyOnly: false
      };

      // Merge any additional options
      return {
        ...gotOptions,
        ...(options.got || {}),
        // Ensure headers are merged properly
        headers: {
          ...gotOptions.headers,
          ...(options.got?.headers || {})
        },
        // Ensure retry config is merged properly
        retry: {
          ...gotOptions.retry,
          ...(options.got?.retry || {})
        },
        // Ensure timeout config is merged properly
        timeout: {
          ...gotOptions.timeout,
          ...(options.got?.timeout || {})
        }
      };
    }

    /**
     * Fetches HTML content from a URL, handling redirects
     */
    async fetchContent(url, options = {}) {
      console.log('Fetching URL with options:', {
        url,
        options: JSON.stringify(options, null, 2)
      });

      try {
        const gotOptions = this.mergeGotOptions(options);
        console.log('Merged Got options:', {
          url,
          options: JSON.stringify(gotOptions, null, 2)
        });

        const response = await got(url, gotOptions);

        // Log the redirect chain if any
        if (response.redirectUrls && response.redirectUrls.length > 0) {
          console.log('URL redirect chain:', {
            originalUrl: url,
            redirects: response.redirectUrls,
            finalUrl: response.url
          });
        }

        return response.body;
      } catch (error) {
        console.error('URL fetch error:', {
          url,
          error: error.message,
          code: error.code,
          statusCode: error.response?.statusCode,
          options: options
        });

        throw new UrlConversionError(
          `Failed to fetch URL: ${error.message}`,
          'NETWORK_ERROR',
          error
        );
      }
    }
  
    /**
     * Converts a URL to Markdown format
     */
    async convertToMarkdown(urlInput, options = {}) {
      const {
        includeImages = true,
        includeMeta = true,
        apiKey = null,
        originalName = null,
        got: gotOptions = {},
        ...otherOptions
      } = options;
  
      try {
        // Validate and normalize URL
        const url = UrlUtils.normalizeUrl(urlInput);
        console.log(`Converting URL: ${url} with options:`, {
          includeImages,
          includeMeta,
          hasApiKey: !!apiKey,
          originalName,
          gotOptions: Object.keys(gotOptions)
        });
  
        // Fetch HTML content with merged options
        const html = await this.fetchContent(url, {
          got: gotOptions,
          ...otherOptions
        });
        console.log(`Fetched HTML content, length: ${html.length}`);
  
        // Extract content
        const { cleanedHtml, metadata, images, skippedImages } = await this.extractContent(html, url, {
          includeImages,
          includeMeta
        });
        console.log(`Extracted and cleaned HTML content`);
  
        // Convert to Markdown
        const markdown = this.turndownService.turndown(cleanedHtml);
        console.log(`Converted to Markdown, length: ${markdown.length}`);
  
        // Format final content
        const content = this.formatContent(markdown, metadata, this.config.conversion.includeSkippedImages ? skippedImages : []);
        console.log(`Formatted content, length: ${content.length}`);
  
        return {
          content,
          images: includeImages ? images : [],
          skippedImages: includeImages && this.config.conversion.includeSkippedImages ? skippedImages : [],
          name: UrlUtils.sanitizeFilename(
            originalName || UrlUtils.getDomain(url)
          ),
          success: true,
          metadata,
          url
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
      }
    }

  /**
   * Extracts and cleans content from HTML
   */
  async extractContent(html, url, options) {
    try {
      const { includeImages, includeMeta } = options;
      const $ = cheerio.load(html);

      console.log('Cleaning HTML content for:', url);

      // Store the original content length for comparison
      const originalLength = html.length;

      // Clean up unwanted elements
      $('script, style, iframe, noscript, nav, footer, header, .navigation, .footer, .header, .ad, .advertisement, .social-share, .comments, link[rel="stylesheet"]').remove();
      console.log('Removed unwanted elements');

      // Clean empty elements
      $('p:empty, div:empty, span:empty').remove();
      console.log('Removed empty elements');

      // Clean up classes and styles
      $('*').removeAttr('class').removeAttr('style');
      console.log('Cleaned attributes');

      // Add spacing between elements for better readability
      $('h1, h2, h3, h4, h5, h6, p, ul, ol, blockquote, pre, table').after('\n');
      console.log('Added spacing');

      // Check if we still have meaningful content
      const cleanedHtml = $.html();
      if (cleanedHtml.length < originalLength * 0.1) {
        console.warn('Warning: Significant content loss during cleaning', {
          originalLength,
          newLength: cleanedHtml.length,
          url
        });
      }

      // Extract metadata if needed
      let metadata = null;
      if (includeMeta) {
        try {
          metadata = await extractMetadata(url);
          console.log('Extracted metadata:', metadata);
        } catch (error) {
          console.error('Metadata extraction failed:', error);
          // Continue without metadata
        }
      }

      // Process images if needed
      let images = [], skippedImages = [];
      if (includeImages) {
        try {
          const result = await this.extractImages($, url);
          images = result.images;
          skippedImages = result.skippedImages;
          console.log(`Processed ${images.length} images, skipped ${skippedImages.length}`);
        } catch (error) {
          console.error('Image processing failed:', error);
          // Continue without images
        }
      }

      return {
        cleanedHtml,
        metadata,
        images,
        skippedImages
      };

    } catch (error) {
      console.error('Content extraction failed:', {
        url,
        error: error.message,
        stack: error.stack
      });
      throw new UrlConversionError(
        `Failed to extract content: ${error.message}`,
        'EXTRACTION_ERROR',
        error
      );
    }
  }

  /**
   * Extracts and processes images, creating Obsidian-compatible image references
   */
  async extractImages($, baseUrl) {
    const images = [];
    const skippedImages = [];
    const seenUrls = new Set();
    const crypto = await import('crypto');
    const domain = UrlUtils.getDomain(baseUrl);

    // Replace image references in HTML with Obsidian wiki-links
    const replaceImageReference = (img, imageName) => {
      const $img = $(img);
      const alt = $img.attr('alt') || '';
      $img.replaceWith(`![[${imageName}]]`);
      return alt;
    };

    // Normalize image URL
    const normalizeImageUrl = (src) => {
      if (!src) return null;
      
      // Handle data URLs
      if (src.startsWith('data:')) {
        const match = src.match(/^data:image\/([a-zA-Z0-9]+);base64,(.+)$/);
        if (match) {
          return {
            isDataUrl: true,
            ext: match[1],
            data: match[2]
          };
        }
        return null;
      }

      // Handle protocol-relative URLs
      if (src.startsWith('//')) {
        src = 'https:' + src;
      }

      // Handle relative URLs
      if (!src.match(/^https?:\/\//i)) {
        const baseUrlObj = new URL(baseUrl);
        if (src.startsWith('/')) {
          // Absolute path
          src = `${baseUrlObj.protocol}//${baseUrlObj.host}${src}`;
        } else {
          // Relative path
          src = new URL(src, baseUrl).href;
        }
      }

      return { isDataUrl: false, url: src };
    };

    const downloadImage = async (url) => {
      try {
        const response = await got(url, {
          ...this.mergeGotOptions(),
          responseType: 'buffer',
          resolveBodyOnly: false
        });

        console.log('Image download response:', {
          url,
          statusCode: response.statusCode,
          contentType: response.headers['content-type'],
          size: response.body?.length
        });
        
        const contentType = response.headers['content-type'];
        const ext = contentType?.split('/')[1]?.split(';')[0] || 'jpg';
        
        return {
          data: response.body.toString('base64'),
          ext
        };
      } catch (error) {
        console.error('Image download error:', {
          url,
          error: error.message,
          code: error.code,
          statusCode: error.response?.statusCode
        });
        return null;
      }
    };

    const processImage = async (img) => {
      const srcAttr = $(img).attr('src');
      const normalizedSrc = normalizeImageUrl(srcAttr);
      
      if (!normalizedSrc) {
        skippedImages.push({ src: srcAttr, reason: 'Invalid source URL' });
        return null;
      }

      if (normalizedSrc.isDataUrl) {
        const { ext, data } = normalizedSrc;
        if (!this.config.conversion.imageTypes.includes(ext)) {
          skippedImages.push({ src: srcAttr, reason: `Unsupported image type: ${ext}` });
          return null;
        }

        const hash = crypto.createHash('md5').update(data).digest('hex').slice(0, 8);
        const imageName = `image-${hash}.${ext}`;
        const alt = replaceImageReference(img, imageName);

        return {
          data,
          name: `web/${domain}/assets/${imageName}`,
          type: `image/${ext}`,
          metadata: {
            originalUrl: 'data-url',
            alt: alt || undefined,
            dateAdded: new Date().toISOString()
          }
        };
      }

      const { url } = normalizedSrc;
      if (seenUrls.has(url)) return null;
      seenUrls.add(url);

      const downloadResult = await downloadImage(url);
      if (!downloadResult) {
        skippedImages.push({ src: url, reason: 'Download failed' });
        return null;
      }

      const { data, ext } = downloadResult;
      if (!this.config.conversion.imageTypes.includes(ext)) {
        skippedImages.push({ src: url, reason: `Unsupported image type: ${ext}` });
        return null;
      }

      const hash = crypto.createHash('md5').update(url).digest('hex').slice(0, 8);
      const imageName = `image-${hash}.${ext}`;
      const alt = replaceImageReference(img, imageName);

      return {
        url,
        data,
        name: `web/${domain}/assets/${imageName}`,
        type: `image/${ext}`,
        metadata: {
          originalUrl: url,
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

    return {
      images,
      skippedImages: this.config.conversion.includeSkippedImages ? skippedImages : []
    };
  }

  /**
   * Formats the final content with metadata
   */
  formatContent(markdown, metadata = null, skippedImages = []) {
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

    // Add skipped images info if any
    if (skippedImages.length > 0) {
      sections.push(
        '',
        '## Skipped Images',
        'The following images were skipped during conversion:',
        '',
        skippedImages.map(img => 
          `- ${img.src}\n  Reason: ${img.reason}`
        ).join('\n'),
        ''
      );
    }

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
