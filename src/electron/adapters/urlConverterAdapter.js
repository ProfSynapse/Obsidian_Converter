/**
 * URL Converter Adapter
 * 
 * Adapts the backend URL converter for use in the Electron main process.
 * Uses the BaseModuleAdapter for consistent module loading and error handling.
 * For single URLs, no page markers are added as they represent a single page.
 * 
 * Related files:
 * - backend/src/services/converter/web/urlConverter.js: Original implementation
 * - src/electron/services/ElectronConversionService.js: Service using this adapter
 * - src/electron/adapters/BaseModuleAdapter.js: Base adapter class
 * - src/electron/services/PageMarkerService.js: Service for adding page markers
 */
const BaseModuleAdapter = require('./BaseModuleAdapter');
const PageMarkerService = require('../services/PageMarkerService');

// Create the URL converter adapter
class UrlConverterAdapter extends BaseModuleAdapter {
  constructor() {
    super(
      'src/services/converter/web/urlConverter.js',
      'urlConverter'
    );
  }
  
  /**
   * Convert URL to Markdown
   * @param {string} url - URL to convert
   * @param {Object} options - Conversion options
   * @returns {Promise<{content: string, images: Array, pageCount: number}>}
   */
  async convertUrlToMarkdown(url, options = {}) {
    // Normalize the URL if needed
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }
    
    // Set default options with enhanced settings for better content extraction
    const defaultOptions = {
      includeMeta: true,
      includeImages: true,
      handleDynamicContent: true,
      // Enhanced options for better content extraction
      got: {
        headers: {
          'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
          'accept-language': 'en-US,en;q=0.9',
          'cache-control': 'no-cache',
          'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36'
        },
        timeout: {
          request: 45000
        },
        retry: {
          limit: 5,
          statusCodes: [408, 413, 429, 500, 502, 503, 504, 520, 521, 522, 523, 524]
        }
      }
    };
    
    // Merge options, preserving any user-provided settings
    const mergedOptions = {
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
    
    try {
      const result = await this.executeMethod('convertToMarkdown', [url, mergedOptions]);
      
      // Add page count to metadata (single URLs are treated as a single page)
      console.log(`📄 [URLConverter] Setting page count to 1 for single URL`);
      
      return {
        content: result.content,
        success: true,
        name: result.name,
        metadata: result.metadata,
        url: result.url,
        images: result.images || [],
        pageCount: 1 // Single URLs are treated as a single page
      };
    } catch (error) {
      console.error('URL conversion failed:', error);
      return {
        success: false,
        error: error.message || 'URL conversion failed',
        url
      };
    }
  }
}

// Create and export a singleton instance
const urlConverterAdapter = new UrlConverterAdapter();

module.exports = {
  convertUrl: (...args) => urlConverterAdapter.convertUrlToMarkdown(...args),
  urlConverterAdapter
};
