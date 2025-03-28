/**
 * URL Converter Adapter
 * 
 * Adapts the backend URL converter for use in the Electron main process.
 * This eliminates code duplication by reusing the existing URL conversion logic.
 * 
 * Related files:
 * - backend/src/services/converter/web/urlConverter.js: Original implementation
 * - src/electron/services/ElectronConversionService.js: Service using this adapter
 */

// Import required modules
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

// Create a function to dynamically load the ES module
async function loadUrlConverter() {
  try {
    // Get the absolute path to the backend URL converter
    const urlConverterPath = path.resolve(__dirname, '../../../backend/src/services/converter/web/urlConverter.js');
    
    // Check if the file exists
    if (!fs.existsSync(urlConverterPath)) {
      throw new Error(`URL converter module not found at: ${urlConverterPath}`);
    }
    
    // Convert the path to a file URL
    const fileUrl = pathToFileURL(urlConverterPath).href;
    console.log('Loading URL converter from:', fileUrl);
    
    // Import the ES module dynamically using the file URL
    const { urlConverter, convertUrlToMarkdown } = await import(fileUrl);
    return { urlConverter, convertUrlToMarkdown };
  } catch (error) {
    console.error('Failed to load URL converter module:', error);
    throw error;
  }
}

// Create a promise that resolves to the loaded module
const modulePromise = loadUrlConverter();

/**
 * Adapts the backend URL converter for use in Electron with enhanced options
 * @param {string} url URL to convert
 * @param {Object} options Conversion options
 * @returns {Promise<{content: string, success: boolean, metadata: Object}>}
 */
async function convertUrl(url, options = {}) {
  try {
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
          'accept-encoding': 'gzip, deflate, br',
          'accept-language': 'en-US,en;q=0.9',
          'cache-control': 'no-cache',
          'pragma': 'no-cache',
          'sec-ch-ua': '"Google Chrome";v="123", "Not:A-Brand";v="8", "Chromium";v="123"',
          'sec-ch-ua-mobile': '?0',
          'sec-ch-ua-platform': '"Windows"',
          'sec-fetch-dest': 'document',
          'sec-fetch-mode': 'navigate',
          'sec-fetch-site': 'none',
          'sec-fetch-user': '?1',
          'upgrade-insecure-requests': '1',
          'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36'
        },
        timeout: {
          request: 45000,
          response: 45000
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
    
    // Get the loaded module
    const { convertUrlToMarkdown } = await modulePromise;
    
    console.log(`🔄 Converting URL with enhanced options: ${url}`);
    
    // Call the backend URL converter with the enhanced options
    const result = await convertUrlToMarkdown(url, mergedOptions);
    
    // Return the result in a format compatible with ElectronConversionService
    return {
      content: result.content,
      success: true,
      name: result.name,
      metadata: result.metadata,
      url: result.url,
      images: result.images || []
    };
  } catch (error) {
    console.error('URL conversion failed in adapter:', error);
    return {
      success: false,
      error: error.message || 'URL conversion failed',
      url
    };
  }
}

// Export the adapter functions
module.exports = {
  convertUrl,
  // The urlConverter object will be populated when needed
  urlConverter: {}
};

// Populate the urlConverter object when the module is loaded
modulePromise.then(({ urlConverter }) => {
  Object.assign(module.exports.urlConverter, urlConverter);
}).catch(error => {
  console.error('Failed to initialize URL converter:', error);
});
