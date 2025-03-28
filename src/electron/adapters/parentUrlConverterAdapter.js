/**
 * Parent URL Converter Adapter
 * 
 * Adapts the backend parent URL converter for use in the Electron main process.
 * This eliminates code duplication by reusing the existing parent URL conversion logic.
 * 
 * Related files:
 * - backend/src/services/converter/web/parentUrlConverter.js: Original implementation
 * - src/electron/services/ElectronConversionService.js: Service using this adapter
 */

// Import required modules
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

// Create a function to dynamically load the ES module
async function loadParentUrlConverter() {
  try {
    // Get the absolute path to the backend parent URL converter
    const parentUrlConverterPath = path.resolve(__dirname, '../../../backend/src/services/converter/web/parentUrlConverter.js');
    
    // Check if the file exists
    if (!fs.existsSync(parentUrlConverterPath)) {
      throw new Error(`Parent URL converter module not found at: ${parentUrlConverterPath}`);
    }
    
    // Convert the path to a file URL
    const fileUrl = pathToFileURL(parentUrlConverterPath).href;
    console.log('Loading parent URL converter from:', fileUrl);
    
    // Import the ES module dynamically using the file URL
    const { convertParentUrlToMarkdown } = await import(fileUrl);
    return { convertParentUrlToMarkdown };
  } catch (error) {
    console.error('Failed to load parent URL converter module:', error);
    throw error;
  }
}

// Create a promise that resolves to the loaded module
const modulePromise = loadParentUrlConverter();

/**
 * Adapts the backend parent URL converter for use in Electron with enhanced options
 * @param {string} url Parent URL to convert
 * @param {Object} options Conversion options
 * @returns {Promise<{content: string, success: boolean, files: Array, stats: Object}>}
 */
async function convertParentUrl(url, options = {}) {
  try {
    // Normalize the URL if needed
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }
    
    // Set default options with enhanced settings for better content extraction
    const defaultOptions = {
      // Enhanced options for better content extraction
      concurrentLimit: 30, // Limit concurrent requests to avoid overwhelming the server
      waitBetweenRequests: 500, // Add a small delay between requests to be more respectful
      maxDepth: 3, // Limit crawling depth to avoid excessive processing
      maxPages: 100, // Limit total pages to process
      includeImages: true,
      includeMeta: true,
      handleDynamicContent: true,
      // HTTP request options
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
    const { convertParentUrlToMarkdown } = await modulePromise;
    
    console.log(`🔄 Converting parent URL with enhanced options: ${url}`);
    console.log(`📊 Using concurrent limit: ${mergedOptions.concurrentLimit}`);
    console.log(`⏱️ Using wait between requests: ${mergedOptions.waitBetweenRequests}ms`);
    
    // Call the backend parent URL converter with the enhanced options
    const result = await convertParentUrlToMarkdown(url, mergedOptions);
    
    // Return the result in a format compatible with ElectronConversionService
    return {
      content: result.content,
      success: true,
      name: result.name,
      files: result.files,
      stats: result.stats,
      url: result.url
    };
  } catch (error) {
    console.error('Parent URL conversion failed in adapter:', error);
    return {
      success: false,
      error: error.message || 'Parent URL conversion failed',
      url,
      stats: {
        totalPages: 0,
        successfulPages: 0,
        failedPages: 1,
        totalImages: 0
      }
    };
  }
}

// Export the adapter function
module.exports = {
  convertParentUrl
};
